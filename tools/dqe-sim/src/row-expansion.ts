import fixture from '../fixtures/table-row-expansion.json';
import type { DqeSimItemResult } from './execute';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const dimensions = ['row_customer', 'row_order_id', 'row_product'];
const fields = [...dimensions, 'row_amount'];
const rejected = (): DqeSimItemResult => ({ code: 'DQE_SIM_UNSUPPORTED_QUERY', retDesc: '子表格仿真要求已知父行输入与有界窗口', data: [], total_count: 0, dqe: { columns: [], orders: [], limit: -1, offset: -1, sql: null } });

/** Only this synthetic field signature is supported; never broaden unknown inputs. */
export function executeRowExpansion(item: unknown): DqeSimItemResult | undefined {
  if (!record(item) || !Array.isArray(item.output_dims) || !item.output_dims.includes('row_order_id')) return;
  if (JSON.stringify(item.output_dims) !== JSON.stringify(dimensions) || JSON.stringify(item.output_metrics) !== '["row_amount"]' ||
    !record(item.filter) || item.filter.time !== undefined || !Array.isArray(item.filter.dims) || item.filter.dims.length !== 1 ||
    !Array.isArray(item.filter.metrics) || item.filter.metrics.length || !record(item.order)) return rejected();
  const parent = item.filter.dims[0], order = item.order;
  if (!record(parent) || parent.dim_name !== 'row_customer' || parent.operator !== undefined ||
    !Array.isArray(parent.dim_value_list) || parent.dim_value_list.length !== 1 || !['C01', 'C02', 'C03'].includes(String(parent.dim_value_list[0])) ||
    !Number.isSafeInteger(order.offset) || Number(order.offset) < 0 || !Number.isSafeInteger(order.limit) || Number(order.limit) < 1 ||
    !Array.isArray(order.by) || !order.by.every((rule, index) => record(rule) && fields.includes(String(rule.field)) && ['asc', 'desc'].includes(String(rule.type)) && rule.priority === index + 1)) return rejected();
  const customer = (parent.dim_value_list as unknown[])[0];
  const rows = fixture.filter(row => row.row_customer === customer);
  const rules = order.by as Array<{ field: keyof typeof fixture[number]; type: 'asc' | 'desc' }>;
  rows.sort((left, right) => {
    for (const rule of rules) { const a = left[rule.field], b = right[rule.field], diff = a < b ? -1 : a > b ? 1 : 0; if (diff) return rule.type === 'asc' ? diff : -diff; }
    return 0;
  });
  return { code: 'SUCCESS', data: rows.slice(Number(order.offset), Number(order.offset) + Number(order.limit)), total_count: rows.length,
    dqe: { columns: [...dimensions.map(id => ({ id, caption: id, data_type: 'STRING' as const, type: 'dimension' as const })), { id: 'row_amount', caption: 'row_amount', data_type: 'NUMBER', type: 'metric' }], orders: [], limit: Number(order.limit), offset: Number(order.offset), sql: null } };
}
