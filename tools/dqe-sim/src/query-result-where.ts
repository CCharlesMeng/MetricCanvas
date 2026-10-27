import { sortDqeRows } from './sort';
import fixture from '../fixtures/query-result-where-paged.json';
import type { DqeSimItemResult } from './execute';
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value);
const same = (value: unknown, expected: string[]) => Array.isArray(value) && value.length === expected.length && expected.every((v, i) => v === value[i]);
const reject = (): DqeSimItemResult => ({ code: 'DQE_SIM_UNSUPPORTED_QUERY', retDesc: '分页级联示例只接受已声明字段、202610期间及已知项目编号集合', data: [], total_count: 0, dqe: { columns: [], orders: [], limit: -1, offset: -1, sql: null } });

/** Native HTTP fixture: order the population before slicing; predicates remain engine-owned. */
export function executeQueryResultWhere(value: unknown): DqeSimItemResult | undefined {
  if (!record(value)) return undefined;
  const main = same(value.output_dims, ['项目编号', '项目名称', '状态', '启用', '日期', '采集时间']) && same(value.output_metrics, ['金额', '时长']);
  const detail = same(value.output_dims, ['项目编号', '项目名称']) && same(value.output_metrics, ['得分', '金额']);
  if (!main && !detail) return undefined;
  if (!record(value.filter) || !record(value.filter.time) || value.filter.time.period !== 'month' || value.filter.time.start !== fixture.month || value.filter.time.end !== fixture.month || !Array.isArray(value.filter.dims) || !Array.isArray(value.filter.metrics) || value.filter.metrics.length || !record(value.order)) return reject();
  const order = value.order;
  const allowed = main ? ['项目编号', '项目名称', '状态', '启用', '日期', '采集时间', '金额', '时长'] : ['项目编号', '项目名称', '金额', '得分'];
  if (Object.keys(order).some(key => !['order_by_field', 'type', 'limit', 'offset'].includes(key))) return reject();
  const limit = order.limit, offset = order.offset ?? 0;
  if ((limit !== undefined && (!Number.isSafeInteger(limit) || Number(limit) <= 0)) || !Number.isSafeInteger(offset) || Number(offset) < 0 || (order.offset !== undefined && limit === undefined) || (!main && (limit !== undefined || order.offset !== undefined))) return reject();
  let rows: RecordValue[];
  if (main) {
    if (value.filter.dims.length) return reject();
    rows = fixture.projects;
  } else {
    const dim = value.filter.dims[0];
    if (value.filter.dims.length !== 1 || !record(dim) || dim.dim_name !== '项目编号' || !Array.isArray(dim.dim_value_list) || !dim.dim_value_list.length || 'operator' in dim) return reject();
    const ids = dim.dim_value_list;
    if (!ids.every(id => fixture.projects.some(row => row['项目编号'] === id))) return reject();
    rows = fixture.details.filter(row => ids.includes(row['项目编号']));
  }
  const sorted = sortDqeRows(rows, order, allowed, (a, b) => a.localeCompare(b, 'zh-CN'));
  if (!sorted) return reject();
  rows = sorted;
  const total = rows.length;
  if (limit !== undefined) rows = rows.slice(Number(offset), Number(offset) + Number(limit));
  return { code: 'SUCCESS', data: rows.map(row => ({ ...row })), total_count: total, dqe: { columns: [
    ...(['项目编号', '项目名称', '状态', '启用', '日期', '采集时间'].filter(name => main || ['项目编号', '项目名称'].includes(name)).map(name => ({ id: name, caption: name, data_type: 'STRING' as const, type: 'dimension' as const }))),
    ...(main ? ['金额', '时长'] : ['得分', '金额']).map(name => ({ id: name, caption: name, data_type: 'NUMBER' as const, type: 'metric' as const }))
  ], orders: [], limit: limit === undefined ? -1 : Number(limit), offset: limit === undefined ? -1 : Number(offset), sql: null } };
}
