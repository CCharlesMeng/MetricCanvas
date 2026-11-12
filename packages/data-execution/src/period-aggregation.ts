import { hasQueryFieldMapping, type DataSnapshot, type EffectiveQuery, type PeriodAggregationCase, type Row, type TablePredicate } from '@metriccanvas/page/internal';
import type { FilterValues } from './filter-values';
import type { DqeQueryDefinition } from '@metriccanvas/page/internal';
import { rawSnapshot } from './snapshots';
import { filterTableRows, searchTableRows, sortTableRows } from './table-view';

type ReadQuery = (query: EffectiveQuery, signal: AbortSignal) => Promise<DataSnapshot>;
type Accumulator = { row: Row; values: Array<{ value: number; count: number }> };
function invalid(message: string): never {
  throw Object.assign(new Error(message), { code: 'DQE_ROW_CONTRACT_ERROR' });
}
export function appliedPeriodAggregation(query: DqeQueryDefinition, values: FilterValues): PeriodAggregationCase | undefined {
  const config = query.periodAggregation;
  if (!config) return;
  const value = values.get(config.filterId);
  if (value?.type !== 'timeRange' || !value.selection) throw Object.assign(new Error('期间聚合需要已应用的期间选择'), { code: 'DQE_QUERY_REJECTED' });
  return value.selection.mode === 'last12Months' ? config.cases.last12Months : undefined;
}
function monthWindows(query: EffectiveQuery): string[] {
  const time = query.filterValues.find(value => value.target === 'time');
  if (time?.target !== 'time' || time.queryField || time.period !== 'month') return invalid('期间聚合需要月粒度的已应用时间范围');
  const serial = (month: string) => {
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) return invalid('期间聚合的月份编码无效');
    return Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1;
  };
  const first = serial(time.value.from), last = serial(time.value.to);
  if (last - first !== 11) return invalid('近一年聚合必须覆盖十二个完整月份');
  return Array.from({ length: 12 }, (_, index) => {
    const value = first + index;
    return `${Math.floor(value / 12).toString().padStart(4, '0')}-${(value % 12 + 1).toString().padStart(2, '0')}`;
  });
}
function monthlyQuery(query: EffectiveQuery, month: string): EffectiveQuery {
  const { periodAggregation, pagination, search, sort, bindingValues, tableFilters, ...base } = structuredClone(query);
  const item = base.body.dsl_list[0];
  const filter = item.filter as Record<string, unknown>;
  item.filter = { ...filter, time: { ...(filter.time as Record<string, unknown>), period: 'month', start: month, end: month, is_aggregate: true } };
  delete item.order;
  // Business dimension predicates can be pushed down. Numeric thresholds apply to the annual result.
  base.filterValues = base.filterValues.filter(value => value.target !== 'metricRange' && value.target !== 'time');
  base.filterValues.push({ target: 'time', period: 'month', value: { from: month, to: month } });
  return base;
}
function groupKey(row: Row, fields: string[]): string {
  const values = fields.map(field => {
    const value = row[field];
    if (value == null || typeof value === 'object' || typeof value === 'number' && !Number.isFinite(value)) return invalid('期间聚合的业务分组键缺失或无效');
    return [typeof value, value];
  });
  return JSON.stringify(values);
}
function addValue(state: Accumulator['values'][number], value: Row[string]): void {
  if (value == null) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalid('期间聚合的度量不是有限数值');
  state.count++;
  state.value += value;
  if (!Number.isFinite(state.value)) invalid('期间聚合数值溢出');
}
function addMonth(groups: Map<string, Accumulator>, rows: Row[], config: PeriodAggregationCase): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = groupKey(row, config.groupBy);
    if (seen.has(key)) invalid('期间聚合同一个月存在重复业务分组键');
    seen.add(key);
    const group = groups.get(key) ?? {
      row: Object.fromEntries(config.groupBy.map(field => [field, row[field]])),
      values: config.aggregations.map(() => ({ value: 0, count: 0 }))
    };
    config.aggregations.forEach((entry, index) => addValue(group.values[index], row[entry.field]));
    groups.set(key, group);
  }
}
function completeMonthlyRows(snapshot: DataSnapshot): Row[] {
  if (snapshot.status === 'error') throw Object.assign(new Error(snapshot.error.message), { code: snapshot.error.code });
  if (snapshot.status === 'loading') return invalid('期间聚合的月度查询未完成');
  const rows = snapshot.status === 'ready' ? snapshot.rows : [];
  if (snapshot.totalCount !== undefined && snapshot.totalCount !== rows.length) return invalid('期间聚合的月度结果不完整，不能使用分页或截断结果计算');
  return rows;
}
function resultRows(groups: Map<string, Accumulator>, config: PeriodAggregationCase): Row[] {
  return [...groups.values()].map(group => ({
    ...group.row,
    ...Object.fromEntries(config.aggregations.map((entry, index) => {
      const state = group.values[index];
      return [entry.field, state.count ? state.value / (entry.aggregate === 'avg' ? state.count : 1) : null];
    }))
  }));
}
function fieldIds(query: EffectiveQuery): Map<string, string> {
  return new Map(Object.entries(query.fieldMappings).flatMap(([id, field]) => hasQueryFieldMapping(field) ? [[field.queryField, id]] : []));
}
function resultPredicates(query: EffectiveQuery, fields: Map<string, string>): TablePredicate[] {
  return query.filterValues.flatMap((value): TablePredicate[] => {
    if (value.target === 'time') return [];
    const field = fields.get(value.target === 'metricRange' ? value.metric : value.queryField);
    if (!field) return [];
    // Exclusions already constrain every monthly request; never reapply them as inclusion.
    if (value.target === 'dimension') return value.operator === '!=' ? [] : [{ field, op: 'in', values: value.values }];
    if (value.target === 'dimensionRange') return [{ field, op: 'dateRange', from: value.from, to: value.to }];
    return [
      ...(value.from === undefined ? [] : [{ field, op: 'gte' as const, value: value.from }]),
      ...(value.to === undefined ? [] : [{ field, op: 'lte' as const, value: value.to }])
    ];
  });
}
function projectResult(rows: Row[], query: EffectiveQuery): DataSnapshot {
  const fields = fieldIds(query);
  const order = query.body.dsl_list[0].order as { order_by_field?: string; type?: string } | undefined;
  const defaultSort = order?.order_by_field ? [{ queryField: order.order_by_field, direction: order.type?.toLowerCase() === 'desc' ? 'desc' as const : 'asc' as const }] : [];
  const sort = (query.sort ?? defaultSort).flatMap(rule => {
    const field = fields.get(rule.queryField);
    return field ? [{ field, direction: rule.direction }] : [];
  });
  const searched = searchTableRows(filterTableRows(rows, resultPredicates(query, fields)), query.search?.queryFields.flatMap(field => fields.get(field) ?? []) ?? [], query.search?.query, query.search?.match);
  const sorted = sortTableRows(searched, sort);
  const selected = query.pagination ? sorted.slice(query.pagination.offset, query.pagination.offset + query.pagination.limit) : sorted;
  return rawSnapshot(selected, sorted.length);
}
/** The DQE wire receives existing monthly queries only; the engine owns cross-month folding. */
export async function executePeriodAggregation(query: EffectiveQuery, read: ReadQuery, signal?: AbortSignal): Promise<DataSnapshot> {
  const config = query.periodAggregation!;
  const bounded = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(60_000)]);
  const groups = new Map<string, Accumulator>();
  let count = 0;
  for (const month of monthWindows(query)) {
    bounded.throwIfAborted();
    const snapshot = await read(monthlyQuery(query, month), bounded);
    bounded.throwIfAborted();
    const rows = completeMonthlyRows(snapshot);
    count += rows.length;
    if (count > 10_000) invalid('期间聚合的完整月度输入超过 10000 行');
    addMonth(groups, rows, config);
  }
  return projectResult(resultRows(groups, config), query);
}
