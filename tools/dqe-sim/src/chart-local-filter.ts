import fixtures from '../fixtures/chart-local-filter.json';
import type { DqeSimItemResult } from './execute';

/** Fixed synthetic data; unknown predicates fail instead of silently broadening. */
export function executeChartLocalFilter(input: unknown): DqeSimItemResult | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return;
  const item = input as Record<string, unknown>;
  const fixture = fixtures.find(f => JSON.stringify(item.output_dims) === JSON.stringify(f.output_dims) && JSON.stringify(item.output_metrics) === JSON.stringify(f.output_metrics));
  if (!fixture) return;
  const result = (valid: boolean, rows: Record<string, unknown>[]): DqeSimItemResult => ({
    code: valid ? 'SUCCESS' : 'DQE_SIM_UNSUPPORTED_QUERY', data: rows, total_count: rows.length,
    dqe: { columns: [], orders: [], limit: -1, offset: -1, sql: null }
  });
  const filter = item.filter as {dims?: Array<{dim_name: string; dim_value_list: string[]; operator?: string}>; metrics?: unknown[]; time?: unknown} | undefined;
  if (!filter || !Array.isArray(filter.dims) || !Array.isArray(filter.metrics) || filter.metrics.length || filter.time !== undefined || JSON.stringify(item.order) !== '{}') return result(false, []);
  let rows: Array<Record<string, unknown>> = fixture.rows;
  for (const dimension of filter.dims) {
    if (!dimension || !fixture.filterableDims.includes(dimension.dim_name) || !Array.isArray(dimension.dim_value_list) || dimension.dim_value_list.some(v => typeof v !== 'string') || dimension.operator !== undefined) return result(false, []);
    if (dimension.dim_value_list.length) rows = rows.filter(row => dimension.dim_value_list.includes(String(row[dimension.dim_name])));
  }
  const outputs = [...fixture.output_dims, ...fixture.output_metrics];
  return result(true, rows.map(row => Object.fromEntries(outputs.map(field => [field, (row as Record<string, unknown>)[field]]))));
}
