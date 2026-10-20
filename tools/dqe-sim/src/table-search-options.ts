import fixture from '../fixtures/table-search-options.json';
import type { DqeSimItemResult } from './execute';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const dimensions = ['search_demo_code', 'search_demo_name', 'search_demo_owner'];
const metrics = ['search_demo_amount'];

/** Synthetic equality-only acceptance surface, not a claim about production DQE collation. */
export function executeTableSearchOptions(input: unknown): DqeSimItemResult | undefined {
  if (!record(input) || JSON.stringify(input.output_dims) !== JSON.stringify(dimensions) ||
      JSON.stringify(input.output_metrics) !== JSON.stringify(metrics)) return;
  const result = (valid: boolean, rows: RecordValue[], count = rows.length): DqeSimItemResult => ({
    code: valid ? 'SUCCESS' : 'DQE_SIM_UNSUPPORTED_QUERY', data: rows, total_count: count,
    dqe: { columns: [], orders: [], limit: -1, offset: -1, sql: null }
  });
  if (!record(input.filter) || !Array.isArray(input.filter.dims) ||
      (input.filter.metrics !== undefined && JSON.stringify(input.filter.metrics) !== '[]') ||
      input.filter.time !== undefined || !record(input.order)) return result(false, []);
  let rows: RecordValue[] = [...fixture];
  for (const predicate of input.filter.dims) {
    if (!record(predicate) || !dimensions.includes(String(predicate.dim_name)) || predicate.operator !== undefined ||
        !Array.isArray(predicate.dim_value_list) || !predicate.dim_value_list.length ||
        predicate.dim_value_list.some(value => typeof value !== 'string')) return result(false, []);
    const field = String(predicate.dim_name), values = predicate.dim_value_list;
    rows = rows.filter(row => values.includes(row[field]));
  }
  const order = input.order;
  if (order.by !== undefined) {
    if (!Array.isArray(order.by) || !order.by.every((rule, index) => record(rule) &&
        [...dimensions, ...metrics].includes(String(rule.field)) && ['asc', 'desc'].includes(String(rule.type)) &&
        rule.priority === index + 1)) return result(false, []);
    const rules = order.by as Array<{ field: string; type: string }>;
    rows.sort((a, b) => {
      for (const rule of rules) {
        const left = a[rule.field] as string | number, right = b[rule.field] as string | number;
        const comparison = left < right ? -1 : left > right ? 1 : 0;
        if (comparison) return rule.type === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
  }
  const offset = order.offset ?? 0, limit = order.limit;
  if (!Number.isSafeInteger(offset) || Number(offset) < 0 ||
      (limit !== undefined && (!Number.isSafeInteger(limit) || Number(limit) < 1))) return result(false, []);
  const count = rows.length;
  return result(true, limit === undefined ? rows : rows.slice(Number(offset), Number(offset) + Number(limit)), count);
}
