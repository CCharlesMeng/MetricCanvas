import { createDqeGateway } from '@metriccanvas/engine/dqe';
import type { DisplayInputs, DisplaySnapshot, FilterCandidatesGateway, FilterCandidatesRequest, FilterCandidatesResult } from '@metriccanvas/engine';
import type { JsonObject } from '@metriccanvas/page/internal';
import { iocHeaderFixture } from '../../../../tools/dqe-sim/fixtures/ioc-header-query.mjs';
import dimensionFixture from '../../../../tools/dqe-sim/fixtures/ioc-dimension-values.json';

const dimensions: Record<string, { parent?: string; values: { value: string; label?: string; of?: string }[] }> = dimensionFixture.dimensions;
const allowedDimensions = new Set(['geo-pc-code', 'region-dept-code', 'rep-office-code']);

function currencyRows(item: JsonObject) {
  if (!Array.isArray(item.output_dims) || !item.output_dims.includes('ioc_amount_project')) return undefined;
  let rows: Record<string, string | number>[] = [
    { ioc_amount_project: '甲项目', ioc_amount_base_cny: 2000000, ioc_amount_fee_cny: 200000, ioc_amount_base_usd: 300000, ioc_amount_fee_usd: 10000 },
    { ioc_amount_project: '乙项目', ioc_amount_base_cny: 5000000, ioc_amount_fee_cny: 500000, ioc_amount_base_usd: 700000, ioc_amount_fee_usd: 20000 }
  ];
  const fields = new Set(Object.keys(rows[0]!));
  const filter = item.filter as JsonObject | undefined;
  for (const value of Array.isArray(filter?.metrics) ? filter.metrics : []) {
    const predicate = value as JsonObject;
    const name = String(predicate.metric_name), values = predicate.metric_value_list;
    const bound = Number(Array.isArray(values) ? values[0] : undefined);
    if (!Number.isFinite(bound) || !['>=', '<='].includes(String(predicate.operator)) || !fields.has(name)) throw new Error('演示金额谓词不受支持');
    rows = rows.filter(row => predicate.operator === '>=' ? Number(row[name]) >= bound : Number(row[name]) <= bound);
  }
  const order = item.order as JsonObject | undefined, offset = Number(order?.offset ?? 0), limit = Number(order?.limit ?? rows.length);
  return { code: 'SUCCESS', data: rows.slice(offset, offset + limit).map(row => ({ ...row, ioc_amount_scope: `合成 · ${JSON.stringify(filter?.metrics ?? [])}` })), total_count: rows.length };
}

/** No network fallback: only explicit IOC synthetic queries are accepted. */
const previewFetch: typeof fetch = async (_input, init) => {
  init?.signal?.throwIfAborted();
  const body = JSON.parse(String(init?.body)) as { dsl_list: JsonObject[] };
  const results = body.dsl_list.map(item => currencyRows(item) ?? iocHeaderFixture(item) ?? { code: 'DQE_SIM_UNSUPPORTED_QUERY', data: [], total_count: 0, retDesc: '内置演示未配置此查询' });
  return Response.json({ retCode: 'CBC.0000', results });
};

function candidates(request: FilterCandidatesRequest): FilterCandidatesResult {
  if (['b2_department', 'b2_office'].includes(request.dimension) && request.filterId === 'region') return { kind: 'values', candidates: [
    { level: 'department', value: 'same', label: '北部地区部' }, { level: 'department', value: 'south', label: '南部地区部' },
    { level: 'office', value: 'same', label: '北京代表处', parent: { level: 'department', value: 'same' } },
    { level: 'office', value: 'office-south', label: '深圳代表处', parent: { level: 'department', value: 'south' } }
  ] };
  if (request.dimension === 'ioc_b4_month' && request.filterId === 'months') {
    const window = request.calendarWindow;
    if (!window || !/^\d{4}-(0[1-9]|1[0-2])$/.test(window.from) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(window.to)) return { kind: 'unconfigured' };
    const [year, month] = window.from.split('-').map(Number);
    return { kind: 'values', candidates: Array.from({ length: 12 }, (_, i) => {
      const offset = month! - 1 + i;
      const value = `${year! + Math.floor(offset / 12)}-${String(offset % 12 + 1).padStart(2, '0')}`;
      return { value, label: value };
    }).filter(item => item.value <= window.to) };
  }
  if (request.filterId !== 'model' || !['b2_model', 'ioc_b4_model'].includes(request.dimension)) return { kind: 'unconfigured' };
  const period = request.constraints.times.period;
  if (!period) return { kind: 'unconfigured' };
  const month = period.from.slice(0, 7);
  if (request.dimension === 'b2_model' && month === '2026-06') return { kind: 'denied' };
  if (request.dimension === 'b2_model' && month === '2026-05') return { kind: 'unconfigured' };
  const values = request.dimension === 'ioc_b4_model' ? (period.mode === 'day' ? ['B', 'C'] : ['A', 'B'])
    : month === '2026-04' ? [] : month === '2026-08' ? ['B'] : month === '2026-07' ? ['C'] : ['A', 'B', 'C'];
  return { kind: 'values', candidates: values.map(value => ({ value, label: `模型 ${value}` })) };
}

/** Development-tool inputs only. Never exported to Page documents or used by other groups. */
export function createIocHeaderPreview() {
  const gateway = createDqeGateway({ fetchImpl: previewFetch });
  const dataGateway: typeof gateway & FilterCandidatesGateway = {
    ...gateway,
    async fetchDimensionValues(dimension, options) {
      options?.signal?.throwIfAborted();
      if (dimension === 'ioc-header-month') return { kind: 'values', candidates: Array.from({ length: 12 }, (_, i) => ({ value: `2026-${String(i + 1).padStart(2, '0')}`, label: `2026年${i + 1}月` })) };
      if (dimension === 'ioc-header-legacy-path') return { kind: 'values', candidates: ['North/One', 'North/Two'].map(value => ({ value, label: value })) };
      const fixture = dimensions[dimension];
      if (!allowedDimensions.has(dimension) || !fixture || Object.keys(options?.constraints ?? {}).some(key => key !== fixture.parent)) return { kind: 'unavailable' };
      const parent = fixture.parent ? options?.constraints?.[fixture.parent] : undefined;
      return { kind: 'values', candidates: fixture.values.filter(item => !parent?.length || parent.includes(item.of ?? '')).map(item => ({ value: item.value, label: item.label ?? item.value })) };
    },
    async fetchFilterCandidates(request, { signal }) { signal.throwIfAborted(); return candidates(request); }
  };
  const snapshot: DisplaySnapshot = {
    permissionRevision: 'playground-ioc-synthetic', permissions: {}, values: { 'period-details': { status: 'ready', value: true } }, timeZone: 'Asia/Shanghai',
    periods: { sales: { status: 'ready', granularity: 'month', latest: '2026-10', latestComplete: '2026-09', missingRanges: [{ from: '2026-07', to: '2026-07' }], refreshedAt: '2026-10-19T02:00:00Z', generatedAt: '2026-10-19T03:00:00Z' } }
  };
  const displayInputs: DisplayInputs = { getSnapshot: () => structuredClone(snapshot), subscribe: () => () => {} };
  return { dataGateway, displayInputs };
}
