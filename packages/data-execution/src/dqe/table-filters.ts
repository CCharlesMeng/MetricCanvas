import type { EffectiveQuery, JsonObject, JsonValue } from '@metriccanvas/page/internal';

function record(value: JsonValue | undefined): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function entries(value: JsonValue | undefined): JsonObject[] {
  return Array.isArray(value) ? value.map(record) : [];
}
function accepts(entry: JsonObject, value: string | number): boolean {
  const list = Array.isArray(entry.dim_value_list) ? entry.dim_value_list : [];
  const operator = entry.operator ?? '=';
  let accepted: boolean;
  if (operator === '=' || operator === 'in' || operator === 'IN') accepted = list.includes(value);
  else if (['>=', '<=', '>', '<'].includes(String(operator)) && list.length === 1) {
    const bound = list[0];
    if (typeof bound !== typeof value || (typeof bound !== 'number' && typeof bound !== 'string')) throw unsupported();
    accepted = operator === '>=' ? value >= bound : operator === '<=' ? value <= bound : operator === '>' ? value > bound : value < bound;
  } else throw unsupported();
  if (entry.is_aggregate === true) throw unsupported();
  return entry.is_exclude === true ? !accepted : accepted;
}
export class TableFilterConflict extends Error { readonly code = 'DQE_FILTER_BINDING_ERROR'; }
function unsupported(): Error { return new TableFilterConflict('现有业务条件不能无损合并表头筛选'); }
/** Additional table predicates are AND constraints; false means a proven empty intersection. */
export function applyTableFilters(item: JsonObject, filters: EffectiveQuery['tableFilters']): boolean {
  if (!filters?.length) return true;
  if (item.filter !== undefined && (!item.filter || typeof item.filter !== 'object' || Array.isArray(item.filter))) throw unsupported();
  const filter = record(item.filter);
  if (filter.dims !== undefined && !Array.isArray(filter.dims) || filter.metrics !== undefined && !Array.isArray(filter.metrics)) throw unsupported();
  item.filter = filter;
  for (const predicate of filters ?? []) {
    if (predicate.target === 'dimension') {
      const dims = entries(filter.dims);
      const existing = dims.filter(d => d.dim_name === predicate.queryField);
      const values = predicate.values.filter(v => existing.every(d => accepts(d, v)));
      if (!values.length) return false;
      filter.dims = [...dims.filter(d => d.dim_name !== predicate.queryField), { dim_name: predicate.queryField, dim_value_list: values }];
    } else if (predicate.target === 'dimensionRange') {
      const dims = entries(filter.dims);
      if (predicate.from !== undefined) dims.push({ dim_name: predicate.queryField, dim_value_list: [predicate.from], operator: '>=' });
      if (predicate.to !== undefined) dims.push({ dim_name: predicate.queryField, dim_value_list: [predicate.to], operator: '<=' });
      filter.dims = dims;
    } else if (predicate.target === 'metricRange') {
      const metrics = entries(filter.metrics);
      if (predicate.from !== undefined) metrics.push({ metric_name: predicate.metric, metric_value_list: [predicate.from], operator: '>=' });
      if (predicate.to !== undefined) metrics.push({ metric_name: predicate.metric, metric_value_list: [predicate.to], operator: '<=' });
      filter.metrics = metrics;
    } else throw unsupported();
  }
  return !impossibleIntervals(entries(filter.dims), 'dim_name', 'dim_value_list') && !impossibleIntervals(entries(filter.metrics), 'metric_name', 'metric_value_list');
}
export class EmptyTableQuery extends Error {}

/** Only prove emptiness for scalar intervals we understand; keep other predicates intact. */
function impossibleIntervals(values: JsonObject[], name: string, list: string): boolean {
  for (const field of new Set(values.map(value => value[name]))) {
    let lower: { value: number; strict: boolean } | undefined;
    let upper: { value: number; strict: boolean } | undefined;
    for (const entry of values.filter(value => value[name] === field)) {
      const bounds = entry[list];
      if (entry.is_exclude === true || entry.is_aggregate === true || !Array.isArray(bounds) || bounds.length !== 1) continue;
      const value = bounds[0], operator = entry.operator ?? '=';
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (operator === '>' || operator === '>=' || operator === '=') {
        const strict = operator === '>';
        if (!lower || (value > lower.value || value === lower.value && strict)) lower = { value, strict };
      }
      if (operator === '<' || operator === '<=' || operator === '=') {
        const strict = operator === '<';
        if (!upper || (value < upper.value || value === upper.value && strict)) upper = { value, strict };
      }
    }
    if (lower && upper && (lower.value > upper.value || lower.value === upper.value && (lower.strict || upper.strict))) return true;
  }
  return false;
}
