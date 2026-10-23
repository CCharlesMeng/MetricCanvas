import {bindingOwnedDqeBody} from '@metriccanvas/page/internal';
import { intersectQueryFilters } from './intersect-filters';
import {selectQuery,requiresTimeValidation,timeFilterBoundaryError} from '@metriccanvas/page/internal';
import { numberRangeIssue,rangeContextIssue,selectedCase, dimensionSelectionIssue, bindingQueryField, hasQueryFieldMapping, timePointPredicateValue, resolveTimeWindow, type FilterDeclaration, type QueryDataSource, type EffectiveQuery, type DataSnapshot } from '@metriccanvas/page/internal';
import type { FilterValue, FilterValues } from './filter-values';
import type { DataGateway, QueryDiagnosticContext } from './ports';
import { preservedQueryError } from './query-error';
import { rawSnapshot } from './snapshots';

export type QueryHeaderFilters = import('@metriccanvas/page/internal').TableHeaderFilters;

export interface QueryBinding { now?:Date; filters?: readonly FilterDeclaration[]; dataSource: QueryDataSource; pagination?: { limit: number }; }


function mappedQueryField(
  dataSource: QueryDataSource,
  fieldId: string
): string | undefined {
  const field = dataSource.fields[fieldId];
  return field && hasQueryFieldMapping(field) ? field.queryField : undefined;
}

export function composeEffectiveQuery(
  binding: QueryBinding,
  values: FilterValues,
  pageIndex: number,
  sortRules: ReadonlyArray<{ field: string; direction: 'asc' | 'desc' }>,
  headerFilters: QueryHeaderFilters,
  search?: { fields: readonly string[]; query: string; match?: 'equals' }
): EffectiveQuery {
  const dataSource = binding.dataSource;
  const query = selectQuery(dataSource.source.query, values);
  const filterValues: EffectiveQuery['filterValues'] = [];
  for (const [filterId, target] of Object.entries(query.filterBindings ?? {})) {
    const value = values.get(filterId), declaration = binding.filters?.find(filter => filter.id === filterId);
    validateBindingValue(declaration, value, values, binding.now);
    if (unrestrictedDimension(value, declaration)) continue;
    const metric = selectedMetric(target, values);
    filterValues.push(...bindingPredicates(target, value, metric));
  }
  const tableFilters: EffectiveQuery['filterValues'] = [];
  // Header fields without queryField mappings cannot be pushed down.
  for (const [fieldId, filter] of Object.entries(headerFilters)) {
    const queryField = mappedQueryField(dataSource, fieldId);
    if (queryField !== undefined) tableFilters.push(...headerPredicates(queryField, filter));
  }
  const sort = sortRules.flatMap((rule) => {
    const queryField = mappedQueryField(dataSource, rule.field);
    return queryField === undefined ? [] : [{ queryField, direction: rule.direction }];
  });
  const searchPredicate = composeSearch(dataSource, search);
  // language 与查询体按数据源的查询定义分支原样透传,编排层不合成协议细节。
  return {
    language: query.language,
    body: bindingOwnedDqeBody(query),
    fieldMappings: dataSource.fields,
    ...(searchPredicate ? { search: searchPredicate } : {}),
    ...(sort.length > 0 ? { sort } : {}),
    ...(binding.pagination
      ? {
        pagination: {
          offset: pageIndex * binding.pagination.limit,
          limit: binding.pagination.limit
        }
      }
      : {}),
    ...(tableFilters.length ? { tableFilters, bindingValues: filterValues } : {}),
    filterValues: [...filterValues, ...tableFilters]
  };
}

type FilterBinding = NonNullable<QueryDataSource['source']['query']['filterBindings']>[string];
type Predicates = EffectiveQuery['filterValues'];

function bindingPredicates(binding: FilterBinding, value: FilterValue | undefined, metric: string | undefined): Predicates {
  switch (binding.target) {
    case 'dimension': {
      if (value?.type !== 'dimension') return [];
      // A missing hierarchy level never borrows another level's predicate field.
      const queryField = bindingQueryField(binding, value.level);
      return queryField === undefined ? [] : [{ target: 'dimension', queryField, values: value.values }];
    }
    case 'time': return timePredicates(binding, value);
    case 'timePoint':
      return value?.type === 'timePoint' ? [{ target: 'dimension', queryField: binding.queryField, values: [timePointPredicateValue(value.value, binding.valueFormat)] }] : [];
    case 'boolean': return booleanPredicates(binding, value);
    case 'numberRange': return value?.type === 'numberRange' ? metricRangePredicates(metric!, value) : [];
  }
}

function timePredicates(binding: Extract<FilterBinding, { target: 'time' }>, value: FilterValue | undefined): Predicates {
  const target = binding.queryField ? { queryField: binding.queryField, valueFormat: binding.valueFormat } : {};
  if (value?.type === 'timeRange') return [{ target: 'time', ...target, value: { from: value.from, to: value.to } }];
  if (binding.window && value?.type === 'timePoint') {
    const range = resolveTimeWindow(value.value, binding.window);
    return [{ target: 'time', ...target, value: { from: range.start, to: range.end } }];
  }
  return [];
}

function booleanPredicates(binding: Extract<FilterBinding, { target: 'boolean' }>, value: FilterValue | undefined): Predicates {
  if (value?.type !== 'boolean') return [];
  // False without whenFalse is unfiltered; it is never an implicit negation.
  const selected = value.value ? binding.whenTrue : binding.whenFalse;
  return selected === undefined ? [] : [{ target: 'dimension', queryField: binding.queryField, values: [...selected] }];
}

function metricRangePredicates(metric: string, value: { from?: number; to?: number }): Predicates {
  if (value.from === undefined && value.to === undefined) return [];
  return [{ target: 'metricRange', metric, ...(value.from !== undefined ? { from: value.from } : {}), ...(value.to !== undefined ? { to: value.to } : {}) }];
}

function headerPredicates(queryField: string, filter: QueryHeaderFilters[string]): Predicates {
  if (filter.mode === 'select') return filter.values.length > 0 ? [{ target: 'dimension', queryField, values: [...filter.values] }] : [];
  if (filter.mode === 'numberRange') return metricRangePredicates(queryField, filter);
  if (filter.from.length === 0 && filter.to.length === 0) return [];
  return [{ target: 'dimensionRange', queryField, ...(filter.from.length > 0 ? { from: filter.from } : {}), ...(filter.to.length > 0 ? { to: filter.to } : {}) }];
}

function composeSearch(dataSource: QueryDataSource, search?: { fields: readonly string[]; query: string; match?: 'equals' }): EffectiveQuery['search'] {
  const term = search?.query.trim();
  const queryFields = search?.fields.map(field => mappedQueryField(dataSource, field));
  if (term && (!queryFields?.length || queryFields.some(field => field === undefined))) throw new Error('表格搜索字段缺少查询字段映射');
  return term && queryFields ? { queryFields: queryFields as string[], query: term, ...(search?.match ? { match: search.match } : {}) } : undefined;
}


export async function executeQuery(
  query: EffectiveQuery,
  gateway: DataGateway,
  diagnosticContext: QueryDiagnosticContext,
  signal?: AbortSignal
): Promise<DataSnapshot> {
  try {
    const combined = intersectQueryFilters(query);
    if (!combined) return { status: 'empty', totalCount: 0 };
    const result = await gateway.fetchData(combined, diagnosticContext, signal);
    if (query.pagination && result.totalCount === undefined) {
      throw Object.assign(new Error('查询分页结果缺少 totalCount'), { code:'DQE_ROW_CONTRACT_ERROR' });
    }
    return rawSnapshot(result.rows, result.totalCount);
  } catch (cause) {
    return { status: 'error', error: preservedQueryError(cause) };
  }
}




/** Keep complete legacy predicates and provenance synchronized when resolving result bindings. */
export function bindQueryResultValues(query: EffectiveQuery, values: EffectiveQuery['filterValues']): void {
  const targets = new Set(values.flatMap(value => value.target === 'dimension' ? [value.queryField] : []));
  const bind = (current: EffectiveQuery['filterValues']) => [...current.filter(value => value.target !== 'dimension' || !targets.has(value.queryField)), ...values];
  query.filterValues = bind(query.filterValues);
  if (query.bindingValues) query.bindingValues = bind(query.bindingValues);
}
function invalidBoundTime(declaration: FilterDeclaration | undefined, value: FilterValue | undefined, now: Date | undefined): boolean {
  return !!declaration && (declaration.type === 'timeRange' || declaration.type === 'timePoint') && requiresTimeValidation(declaration) && !!value && (value.type === 'timeRange' || value.type === 'timePoint') && !!timeFilterBoundaryError(declaration, value, now);
}
function validateBindingValue(declaration: FilterDeclaration | undefined, value: FilterValue | undefined, values: FilterValues, now: Date | undefined): void {
  if (invalidBoundTime(declaration, value, now)) throw Object.assign(new Error('日期或时间模式不符合声明'), { code: 'DQE_QUERY_REJECTED' });
  if (declaration?.type === 'timeRange' && declaration.display === 'modes' && value?.type !== 'timeRange') throw Object.assign(new Error('模式范围必须选择'), { code: 'DQE_QUERY_REJECTED' });
  if (declaration?.type === 'dimension' && dimensionSelectionIssue(declaration, value?.type === 'dimension' ? value.values : [])) throw Object.assign(new Error('筛选值不符合已声明选择规则'), { code: 'DQE_QUERY_REJECTED' });
  if (declaration?.type === 'numberRange' && ((value?.type === 'numberRange' && numberRangeIssue(declaration, value)) || rangeContextIssue(declaration, values))) throw Object.assign(new Error('金额范围或币种不符合声明'), { code: 'DQE_QUERY_REJECTED' });
}
function unrestrictedDimension(value: FilterValue | undefined, declaration: FilterDeclaration | undefined): boolean {
  if (value?.type === 'dimension' && !value.values.length) return true;
  if (value?.type !== 'dimension' || declaration?.type !== 'dimension' || declaration.selection?.mode !== 'multiple' || declaration.selection.allBehavior !== 'unrestricted' || !declaration.options) return false;
  const enabled = declaration.options.filter(option => !option.disabled);
  return !!enabled.length && enabled.length === value.values.length && enabled.every(option => value.values.includes(option.value));
}
function selectedMetric(binding: FilterBinding, values: FilterValues): string | undefined {
  const metric = binding.target === 'numberRange' ? (binding.metricByFilter ? selectedCase(binding.metricByFilter.cases, values.get(binding.metricByFilter.filterId)?.type === 'dimension' ? (values.get(binding.metricByFilter.filterId) as { values: string[] }).values : undefined) : binding.metric) : undefined;
  if (binding.target === 'numberRange' && !metric) throw Object.assign(new Error('金额metric未配置'), { code: 'DQE_CONFIG_ERROR' });
  return metric;
}
