import { sortDqeRows } from './sort';
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
  const sorted = sortDqeRows(rows, order, [...dimensions, ...metrics]);
  if (!sorted) return result(false, []);
  rows = sorted;
  const offset = order.offset ?? 0, limit = order.limit;
  if (!Number.isSafeInteger(offset) || Number(offset) < 0 ||
      (limit !== undefined && (!Number.isSafeInteger(limit) || Number(limit) < 1))) return result(false, []);
  const count = rows.length;
  return result(true, limit === undefined ? rows : rows.slice(Number(offset), Number(offset) + Number(limit)), count);
}
