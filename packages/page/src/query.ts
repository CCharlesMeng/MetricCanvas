import {
  isObjectDqeItem,
  type ObjectTimeTarget,
  setObjectFieldValues,
  setObjectTimeRange,
} from './dqe-object';
import type { QueryDataSourceFieldDefinition } from './field';
import type { TimeRangeValue } from './filter';
import type { PageParamValue } from './page-param';
import { bindingQueryFields, type DqeFilterBinding } from './query-bindings';
import { resolveQueryParamReferences } from './query-param-references';
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

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/**
 * 查询协议闭集的唯一声明(ADR-0034/issue #79)。
 *
 * `language` 是页面查询定义与生效查询的判别符;新增协议(GraphQL/REST)
 * 时在此登记并为 PageQuery/EffectiveQuery 各补一支判别分支,消费方
 * (zod schema、数据网关分发、边界校验)全部从这里派生,不得另列闭集。
 */
export const QUERY_LANGUAGES = ['dqe'] as const;

export type QueryLanguage = (typeof QUERY_LANGUAGES)[number];

export function isQueryLanguage(value: unknown): value is QueryLanguage {
  return (QUERY_LANGUAGES as readonly unknown[]).includes(value);
}

export interface DqeRequestBody {
  /**
   * 一个页面数据源表示一个命名数据集，因此页面内恰好一项；
   * 数据网关可以在传输层合并多个逻辑查询。
   */
  dsl_list: [JsonObject];
}

export { MAX_QUERY_RESULT_VALUES } from './query-result-limits';

/** Raw normalized query dimensions become bounded downstream predicates. */
export interface QueryResultBinding {
  source: string;
  field: string;
  target: 'dimension';
  queryField: string;
  maxValues: number;
  /** Select rows from this binding's raw upstream result without changing that result. */
  where?: QueryResultWhere;
}

export type QueryResultWhere =
  | { all: QueryResultWhere[] }
  | { any: QueryResultWhere[] }
  | { field: string; op: 'eq' | 'ne'; value: string | number | boolean }
  | { field: string; op: 'in' | 'notIn'; values: Array<string | number | boolean> }
  | { field: string; op: 'gt' | 'gte' | 'lt' | 'lte'; value: number }
  | { field: string; op: 'isNull' | 'isNotNull' };

export interface DqeQueryCase {
  body: DqeRequestBody;
  filterBindings: Record<string, DqeFilterBinding>;
}

export interface DqeQueryModeCase extends DqeQueryCase {
  /** 页面字段 id → 本分支的原始响应字段；属于页面元数据，不发送给 DQE。 */
  fieldMappings?: Record<string, string>;
}

export interface DqeQueryDefinition {
  periodAggregation?: import('./period-aggregation').PeriodAggregation;
  resultBindings?: QueryResultBinding[];
  language: 'dqe';
  body?: DqeRequestBody;
  timeModes?: {
    filterId: string;
    cases: Partial<Record<import('./time-mode').TimeMode, DqeQueryCase>>;
  };
  queryModes?: { filterId: string; cases: Record<string, DqeQueryModeCase> };
  filterBindings?: Record<string, DqeFilterBinding>;
  paramBindings?: Record<
    string,
    | { target: 'dimension'; queryField: string }
    | ({ target: 'time'; window: TimeWindow } & ObjectTimeTarget)
  >;
}

/** Produces a DQE-safe copy; the saved Page keeps its references. */
export function resolveInlineQueryParams(
  query: PageQuery,
  values: ReadonlyMap<string, PageParamValue>,
): PageQuery {
  const result = structuredClone(query);
  resolveQueryParamReferences(result, values);
  return result;
}

/**
 * 页面查询定义:以 `language` 为判别符的判别联合(ADR-0034)。
 * 当前闭集仅 dqe 一支;各协议分支自行声明本协议的查询体与筛选绑定形状。
 */
export type PageQuery = DqeQueryDefinition;

export function isDqeQueryDefinition(query: unknown): query is DqeQueryDefinition {
  return (
    typeof query === 'object' &&
    query !== null &&
    (query as { language?: unknown }).language === 'dqe'
  );
}

/** 统一运行时交给数据网关的一次确定性 DQE 执行请求(生效查询的 dqe 分支)。 */
export interface DqeEffectiveQuery {
  /** Internal whole-period plan; consumed before sending monthly DQE requests. */
  periodAggregation?: import('./period-aggregation').PeriodAggregationCase;
  language: 'dqe';
  /** Internal execution proof of an explicitly empty authorized membership, never a cleared control. */
  matchNone?: true;
  /** Internal bounded composition recovery; never part of the DQE wire body. */
  resultPolicy?: 'display';
  body: DqeRequestBody;
  fieldMappings: Record<string, QueryDataSourceFieldDefinition>;
  /** Omitted match preserves literal substring search; equals uses native dimension equality. */
  search?: { queryFields: string[]; query: string; match?: 'equals' };
  pagination?: {
    offset: number;
    limit: number;
  };
  /**
   * 服务端排序(ADR-0086):数组序即优先级。分页开启时排序必须由上游执行,
   * 本地排序只能排到当前页,那是错的语义而不是降级。
   */
  sort?: Array<{ queryField: string; direction: 'asc' | 'desc' }>;
  /**
   * 生效查询携带的是**已解析的谓词**,不是绑定声明:timePoint 与 boolean
   * 在编排层就化成维度谓词,因此这里只比页面协议多一支数值区间。
   */
  /** Business predicates before table-local narrowing; filterValues remains the complete legacy view. */
  bindingValues?: DqeEffectiveQuery['filterValues'];
  /** Additional table predicates narrow the already-bound business query. */
  tableFilters?: DqeEffectiveQuery['filterValues'];
  filterValues: Array<
    | {
        target: 'dimension';
        queryField: string;
        values: Array<string | number>;
        operator?: '=' | '!=';
      }
    | {
        target: 'time';
        queryField?: string;
        valueFormat?: import('./dqe-object').ObjectTimeFormat;
        value: TimeRangeValue;
        period?: import('./period-query').QueryPeriod;
      }
    | {
        target: 'metricRange';
        metric: string;
        from?: number;
        to?: number;
      }
    /** 表头筛选:区间端点各自可缺席,`>=` / `<=` 由端点存在与否决定。 */
    | {
        target: 'dimensionRange';
        queryField: string;
        from?: string;
        to?: string;
      }
  >;
}

/**
 * 生效查询:与 PageQuery 同一判别符的判别联合(ADR-0034)。
 * 统一运行时按数据源分支透传 language,不感知协议内部结构。
 */
export type EffectiveQuery = DqeEffectiveQuery;

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
