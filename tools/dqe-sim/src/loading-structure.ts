import { sortDqeRows } from './sort';
import type { DqeSimItemResult } from './execute';
import galleryRows from '../fixtures/loading-structure-gallery.json';

type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const rows: Row[] = ['CN', 'OVERSEAS'].flatMap((region, regionIndex) =>
  Array.from({ length: 4 }, (_, index) => ({ chart_demo_region: region,
    chart_demo_category: `合成类别${index + 1}`, chart_demo_orders: (index + 1) * 10 * (regionIndex + 1),
    chart_demo_revenue: (index + 1) * 100 * (regionIndex + 1) })));
const galleryDimensions = ['preview_category', 'preview_name', 'preview_region', 'preview_date', 'preview_description'];
const galleryMetrics = ['preview_value', 'preview_change', 'preview_progress'];
const fixtures = [
  { dimensions: ['chart_demo_category'], metrics: ['chart_demo_orders'], rows },
  { dimensions: ['chart_demo_category'], metrics: ['chart_demo_revenue'], rows },
  { dimensions: galleryDimensions, metrics: galleryMetrics, rows: galleryRows }
];
const rejected = (): DqeSimItemResult => ({ code: 'DQE_SIM_UNSUPPORTED_QUERY', data: [], total_count: 0,
  dqe: { columns: [], orders: [], limit: -1, offset: -1, sql: null } });

function queryFixture(item: Row) {
  return fixtures.find(fixture => JSON.stringify(item.output_dims) === JSON.stringify(fixture.dimensions) &&
    JSON.stringify(item.output_metrics) === JSON.stringify(fixture.metrics));
}

function dimensionInput(dimension: unknown) {
  if (!record(dimension) || !['chart_demo_region', 'chart_demo_category', 'loading_demo_round'].includes(String(dimension.dim_name)) ||
    !Array.isArray(dimension.dim_value_list) || dimension.operator !== undefined) return;
  const values = dimension.dim_value_list, field = String(dimension.dim_name);
  if (values.some(value => typeof value !== 'string')) return;
  if (field === 'loading_demo_round' && (values.length !== 1 || !['1', '2', '3'].includes(String(values[0])))) return;
  return { values, field };
}

function filteredRows(filter: unknown, source: Row[]): Row[] | undefined {
  if (!record(filter) || !Array.isArray(filter.dims) || !Array.isArray(filter.metrics) || filter.metrics.length || filter.time !== undefined) return;
  let result = source;
  for (const dimension of filter.dims) {
    const input = dimensionInput(dimension);
    if (!input) return;
    // The explicit review round changes request identity without changing business rows.
    if (input.field === 'loading_demo_round') continue;
    result = result.filter(row => input.values.includes(row[input.field]));
  }
  return result;
}

function queryWindow(order: Row, count: number) {
  const offset = order.offset ?? 0, limit = order.limit ?? (count || 1);
  if (!Number.isSafeInteger(offset) || Number(offset) < 0 || !Number.isSafeInteger(limit) || Number(limit) < 1) return;
  return { offset: Number(offset), limit: Number(limit) };
}

/** Dedicated signatures keep the review gallery isolated from other Sim scenarios. */
export function executeLoadingStructure(item: unknown): DqeSimItemResult | undefined {
  if (!record(item) || item.schema_id !== 'MC_LOADING_STRUCTURE_DEMO') return;
  const fixture = queryFixture(item);
  if (!fixture) return rejected();
  const selected = filteredRows(item.filter, fixture.rows);
  if (!selected || !record(item.order)) return rejected();
  const fields = [...fixture.dimensions, ...fixture.metrics];
  const sorted = sortDqeRows(selected, item.order, fields);
  if (!sorted) return rejected();
  const window = queryWindow(item.order, sorted.length);
  if (!window) return rejected();
  return { code: 'SUCCESS', total_count: sorted.length,
    data: sorted.slice(window.offset, window.offset + window.limit).map(row => Object.fromEntries(fields.map(field => [field, row[field]]))),
    dqe: { columns: [], orders: [], limit: window.limit, offset: window.offset, sql: null } };
}
