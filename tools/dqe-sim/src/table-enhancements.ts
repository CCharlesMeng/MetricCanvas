import { sortDqeRows } from './sort';
import type { DqeSimItemResult } from './execute';
type RecordValue = Record<string, unknown>;
const samples: RecordValue[] = [
  { '展示样例': '正常', '展示时间': '2026-10-01', '展示文本': '0012', '展示数值': 10 },
  { '展示样例': '组合时间', '展示时间': '2026-09 ~ 2026-10', '展示文本': 123, '展示数值': '待确认' },
  { '展示样例': '横杠', '展示时间': '--', '展示文本': '--', '展示数值': '--' },
  { '展示样例': '空串', '展示时间': null, '展示文本': '', '展示数值': '' },
  { '展示样例': '空白', '展示时间': null, '展示文本': '  ', '展示数值': ' ' },
  { '展示样例': '零值', '展示时间': '2026-09-01', '展示文本': false, '展示数值': 0 },
  { '展示样例': '负数', '展示时间': '2026-08-01', '展示文本': 'A-01', '展示数值': -3 },
  { '展示样例': '长横杠', '展示时间': null, '展示文本': '——', '展示数值': ' —–- ' }
];
const regions = ['华东', '华南', '华北', '西南', '西北', '东北'];
function selected(item: RecordValue, name: string): string | undefined {
  const filter = item.filter as { dims?: { dim_name: string; dim_value_list: string[] }[] } | undefined;
  return filter?.dims?.find(dim => dim.dim_name === name)?.dim_value_list[0];
}
function factor(item: RecordValue): number {
  const filter = item.filter as { time?: { start?: string } } | undefined;
  const month = filter?.time?.start?.replaceAll('-', '').slice(0, 6);
  return (month === '202610' ? 2 : 1) * (selected(item, 'product_code') === 'premium' ? 3 : 1);
}
function regionalRows(item: RecordValue): RecordValue[] {
  const scale = factor(item);
  const rows = regions.map((name, index) => ({
    region_code: 'region-' + (index + 1), region_name: name + '地区部',
    regional_target: (index + 1) * 100000 * scale,
    regional_actual: (index + 1) * 80000 * scale, regional_rate: 80
  }));
  const region = selected(item, 'region_code');
  return region ? rows.filter(row => row.region_code === region) : rows;
}
function summaryRows(item: RecordValue): RecordValue[] {
  const mode = selected(item, 'summary_mode');
  if (mode === 'empty') return [];
  const row = { summary_scope: '中国区', summary_target: 2100000 * factor(item), summary_actual: 1680000 * factor(item), summary_rate: 80 };
  return mode === 'multiple' ? [row, { ...row }] : [row];
}
function result(rows: RecordValue[], item: RecordValue, failed = false): DqeSimItemResult {
  const order = item.order as { offset?: number; limit?: number } | undefined;
  const fields = [item.output_dims, item.output_metrics].flatMap(value => Array.isArray(value) ? value.map(String) : []);
  const sorted = sortDqeRows(rows, item.order, fields, (a, b) => a.localeCompare(b));
  failed ||= sorted === undefined;
  let ordered = sorted ?? [];
  const offset = order?.offset ?? 0, limit = order?.limit ?? rows.length;
  ordered = ordered.slice(offset, offset + limit);
  return { code: failed ? 'DQE_SIM_UNSUPPORTED_QUERY' : 'SUCCESS', data: failed ? [] : ordered, total_count: failed ? 0 : rows.length,
    dqe: { columns: [], orders: [], limit: -1, offset: -1, sql: null } };
}
/** Synthetic indicator-table receipts. No page ID, transport bypass, or real permission claim. */
export function executeTableEnhancements(value: unknown): DqeSimItemResult | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const item = value as RecordValue;
  const dims = item.output_dims;
  if (!Array.isArray(dims)) return;
  if (dims.includes('展示样例')) return result(structuredClone(samples), item);
  if (dims.includes('region_code') && Array.isArray(item.output_metrics) && item.output_metrics.includes('regional_actual')) return result(regionalRows(item), item);
  if (dims.includes('summary_scope')) return result(summaryRows(item), item, selected(item, 'summary_mode') === 'error');
  return undefined;
}
