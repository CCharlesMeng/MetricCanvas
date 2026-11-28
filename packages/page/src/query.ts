import {
  isObjectDqeItem,
  setObjectFieldValues,
  setObjectTimeRange,
} from './dqe-object';
import type { TimeRangeValue } from './filter-types';
import type { PageParamValue } from './page-param-types';
import { bindingQueryFields } from './query-bindings';
import { resolveQueryParamReferences } from './query-param-references';
import {
  QUERY_LANGUAGES,
  isDqeQueryDefinition,
  isQueryLanguage,
  type DqeEffectiveQuery,
  type DqeFilterBinding,
  type DqeQueryCase,
  type DqeQueryDefinition,
  type DqeQueryModeCase,
  type DqeRequestBody,
  type EffectiveQuery,
  type JsonObject,
  type JsonValue,
  type PageQuery,
  type QueryLanguage,
  type QueryResultBinding,
  type QueryResultWhere,
} from './query-primitives';
import { ordinaryQuery, queryLeaves, querySelection } from './query-selection';
import { resolveTimeWindow, type TimeWindow } from './time-param';

export {
  bindingQueryField,
  bindingQueryFields,
  type DqeBooleanFilterBinding,
  type DqeDimensionFilterBinding,
  type DqeFilterBinding,
  type DqeNumberRangeFilterBinding,
  type DqeTimePointFilterBinding,
  isLevelDimensionBinding,
  timePointPredicateValue,
} from './query-bindings';
export {
  MAX_QUERY_RESULT_VALUES,
  QUERY_LANGUAGES,
  isDqeQueryDefinition,
  isQueryLanguage,
  type DqeEffectiveQuery,
  type DqeQueryCase,
  type DqeQueryDefinition,
  type DqeQueryModeCase,
  type DqeRequestBody,
  type EffectiveQuery,
  type JsonObject,
  type JsonValue,
  type PageQuery,
  type QueryLanguage,
  type QueryResultBinding,
  type QueryResultWhere,
} from './query-primitives';

/** Produces a DQE-safe copy; the saved Page keeps its references. */
export function resolveInlineQueryParams(
  query: PageQuery,
  values: ReadonlyMap<string, PageParamValue>,
): PageQuery {
  const result = structuredClone(query);
  resolveQueryParamReferences(result, values);
  return result;
}

/** 判别联合分支与协议闭集互相覆盖的编译期守护:任一侧漂移即报错。 */
type _BranchLanguage = PageQuery['language'] | EffectiveQuery['language'];
type _ClosedSetMatchesBranches = [_BranchLanguage] extends [QueryLanguage]
  ? [QueryLanguage] extends [_BranchLanguage]
    ? true
    : never
  : never;
const _queryLanguageClosedSetGuard: _ClosedSetMatchesBranches = true;
void _queryLanguageClosedSetGuard;

/**
 * 查询定义自述的分页能力(协议中立,ADR-0034/issue #79):查询定义声明了
 * 合法的每页行数时返回它,否则返回 undefined。统一运行时只经由本能力
 * 读取分页声明,不解析任何协议分支的内部结构。
 */
export function declaredPaginationLimit(query: PageQuery): number | undefined {
  if (querySelection(query)) {
    const limits = queryLeaves(query).map(declaredPaginationLimit);
    return limits.every((value) => value === limits[0]) ? limits[0] : undefined;
  }
  switch (query.language) {
    case 'dqe': {
      const order = ordinaryQuery(query).body.dsl_list[0].order;
      if (
        typeof order !== 'object' ||
        order === null ||
        Array.isArray(order) ||
        !Number.isInteger(order.limit) ||
        Number(order.limit) <= 0
      ) {
        return undefined;
      }
      return Number(order.limit);
    }
  }
  // 未在上方自述分页能力的协议分支落到这里:视为未声明分页(失败安全)。
  return undefined;
}

/** A first window can be paged without discarding a caller's explicit offset. */
export function isFirstQueryWindow(query: PageQuery): boolean {
  if (querySelection(query)) return queryLeaves(query).every(isFirstQueryWindow);
  switch (query.language) {
    case 'dqe': {
      const order = ordinaryQuery(query).body.dsl_list[0].order;
      return (
        order === undefined ||
        (typeof order === 'object' &&
          order !== null &&
          !Array.isArray(order) &&
          (order.offset === undefined || order.offset === 0))
      );
    }
  }
  return false;
}

/** 参数对查询定义的协议内初始化；有筛选绑定的目标由筛选状态接管。 */
type ParamBinding = NonNullable<PageQuery['paramBindings']>[string];

export function initializeQueryParams(
  query: PageQuery,
  values: ReadonlyMap<string, import('./page-param').PageParamValue>,
): PageQuery {
  const initialized = structuredClone(query),
    selection = querySelection(initialized);
  if (selection) {
    for (const leaf of Object.values(selection.cases)) {
      const resolved = initializeQueryParams({ language: 'dqe', ...leaf }, values);
      leaf.body = ordinaryQuery(resolved).body;
    }
    return initialized;
  }
  for (const [id, binding] of Object.entries(initialized.paramBindings ?? {})) {
    if (binding.target === 'time') initializeTimeParam(initialized, id, binding, values);
    else initializeDimensionParam(initialized, id, binding, values);
  }
  return resolveInlineQueryParams(initialized, values);
}
function initializeTimeParam(
  query: PageQuery,
  id: string,
  binding: Extract<ParamBinding, { target: 'time' }>,
  values: ReadonlyMap<string, PageParamValue>,
): void {
  const value = values.get(id);
  if (typeof value !== 'string') throw new Error(`时间绑定缺少有效参数:${id}`);
  const item = ordinaryQuery(query).body.dsl_list[0],
    filter = item.filter;
  if (isObjectDqeItem(item)) {
    const range = resolveTimeWindow(value, binding.window);
    setObjectTimeRange(item, binding, range.start, range.end);
    return;
  }
  if (!filter || typeof filter !== 'object' || Array.isArray(filter))
    throw new Error('时间绑定需要 filter.time');
  const time = filter.time;
  if (!time || typeof time !== 'object' || Array.isArray(time))
    throw new Error('时间绑定需要 filter.time');
  filter.time = { ...time, ...resolveTimeWindow(value, binding.window) };
}
function initializeDimensionParam(
  query: PageQuery,
  id: string,
  binding: Extract<ParamBinding, { target: 'dimension' }>,
  values: ReadonlyMap<string, PageParamValue>,
): void {
  if (
    Object.values(query.filterBindings ?? {}).some((filter) =>
      bindingQueryFields(filter).includes(binding.queryField),
    )
  )
    return;
  const value = values.get(id);
  if (value === undefined) return;
  const item = ordinaryQuery(query).body.dsl_list[0],
    rawFilter = item.filter;
  if (isObjectDqeItem(item)) {
    setObjectFieldValues(
      item,
      binding.queryField,
      Array.isArray(value) ? [...value] : [String(value)],
    );
    return;
  }
  const filter =
    rawFilter && typeof rawFilter === 'object' && !Array.isArray(rawFilter) ? rawFilter : {};
  const dims = Array.isArray(filter.dims) ? filter.dims : [];
  item.filter = {
    ...filter,
    dims: [
      ...dims,
      {
        dim_name: binding.queryField,
        dim_value_list: Array.isArray(value) ? [...value] : [String(value)],
      },
    ],
  };
}
