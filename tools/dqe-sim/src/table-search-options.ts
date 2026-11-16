import { sortDqeRows } from './sort';
import fixture from '../fixtures/table-search-options.json';
import type { DqeSimItemResult } from './execute';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const dimensions = ['search_demo_code', 'search_demo_name', 'search_demo_owner'];
const metrics = ['search_demo_amount'];

function searchPredicate(input: unknown) {
  if (!record(input) || !dimensions.includes(String(input.dim_name))) return;
  const { operator, dim_value_list: values } = input;
  if (operator !== undefined && operator !== 'contains') return;
  if (!Array.isArray(values) || !values.length || values.some(value => typeof value !== 'string')) return;
  const field = String(input.dim_name);
  if (operator === 'contains') {
    const terms = values.map(value => value.toLowerCase());
    return (row: RecordValue) => {
      const value = String(row[field]).toLowerCase();
      return terms.some(term => value.includes(term));
    };
  }
  return (row: RecordValue) => values.includes(row[field]);
}

function pageWindow(order: RecordValue) {
  const offset = order.offset ?? 0, limit = order.limit;
  if (!Number.isSafeInteger(offset) || Number(offset) < 0) return;
  if (limit !== undefined && (!Number.isSafeInteger(limit) || Number(limit) < 1)) return;
  return { offset: Number(offset), end: limit === undefined ? undefined : Number(offset) + Number(limit) };
}

/** Synthetic acceptance for dimension conditions and pagination. */
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
  const window = pageWindow(input.order);
  if (!window) return result(false, []);
  let rows: RecordValue[] = [...fixture];
  for (const predicate of input.filter.dims) {
    const matches = searchPredicate(predicate);
    if (!matches) return result(false, []);
    rows = rows.filter(matches);
  }
  const order = input.order;
  const sorted = sortDqeRows(rows, order, [...dimensions, ...metrics]);
  if (!sorted) return result(false, []);
  return result(true, sorted.slice(window.offset, window.end), sorted.length);
}
