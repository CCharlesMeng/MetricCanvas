import { sortDqeRows } from './sort';
import fixture from '../fixtures/object-query.json';
import type { DqeSimItemResult } from './execute';

type Row = Record<string, string | number>;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const failure = (): DqeSimItemResult => ({ code: 'DQE_SIM_UNSUPPORTED_QUERY', data: [], total_count: 0, dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}, retDesc: 'object 合成场景不支持此查询' });
/** An explicit synthetic surface; production operator, ordering and count semantics remain unverified. */
export function executeObjectQuery(input: unknown): (DqeSimItemResult & { columns?: null }) | undefined {
  if (!record(input)) return;
  if (Array.isArray(input.output_metrics) && input.output_metrics.includes('示例合同金额')) return metricRows(input);
  if (input.query_type !== 'object') return;
  if (input.object_type !== 'Demo/Approval Details' || !Array.isArray(input.output_fields)) return failure();
  if (input.output_fields.some(field => !Object.hasOwn(fixture[0], String(field)))) return failure();
  try {
    const filter = record(input.filter) ? input.filter : {};
    const fields = filter.fields ?? [];
    if (!Array.isArray(fields)) return failure();
    const rows: Row[] = fixture.filter(row => fields.every(field => matches(row, field)));
    return windowResult(input, rows, input.output_fields.map(String));
  } catch { return failure(); }
}
function matches(row: Row, raw: unknown): boolean {
  if (!record(raw) || !Array.isArray(raw.value_list) || !Object.hasOwn(row, String(raw.field_name))) throw new Error('predicate');
  const value = row[String(raw.field_name)], bounds = raw.value_list, operator = raw.operator ?? '=';
  let accepted: boolean;
  if (operator === '=') accepted = bounds.includes(value);
  else if (operator === 'contains') accepted = bounds.some(bound => String(value).includes(String(bound)));
  else if (operator === '!=') accepted = !bounds.includes(value);
  else accepted = compare(value, bounds[0], String(operator));
  return raw.is_exclude === true ? !accepted : accepted;
}
function compare(value: string | number, bound: unknown, operator: string): boolean {
  if (typeof value !== typeof bound || (typeof bound !== 'string' && typeof bound !== 'number')) throw new Error('comparison');
  switch (operator) {
    case '>=': return value >= bound;
    case '<=': return value <= bound;
    case '>': return value > bound;
    case '<': return value < bound;
    default: throw new Error('operator');
  }
}
function windowResult(input: Record<string, unknown>, rows: Row[], fields: string[]): DqeSimItemResult & { columns?: null } {
  const order = record(input.order) ? input.order : {};
  const sorted = sortDqeRows(rows, order, fields);
  if (!sorted) return failure();
  rows = sorted;
  const offset=Number(order.offset ?? 0), limit=Number(order.limit ?? (rows.length || 1));
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1)return failure();
  return { code: 'SUCCESS', columns: null, dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}, data: rows.slice(offset,offset+limit).map(row => Object.fromEntries(fields.map(field=>[field,row[field]]))), total_count: rows.length };
}
function metricRows(input: Record<string, unknown>): DqeSimItemResult {
  const filter=record(input.filter)?input.filter:{},dims=Array.isArray(filter.dims)?filter.dims:[];
  let rows: Row[]=[...new Set(fixture.map(row=>row['商务编号']))].map((business,index)=>({'商务编号':business,'示例合同金额':(index+1)*1000}));
  for(const raw of dims){if(!record(raw)||raw.dim_name!=='商务编号'||!Array.isArray(raw.dim_value_list))return failure();const values=raw.dim_value_list;rows=rows.filter(row=>values.includes(row['商务编号']));}
  return windowResult(input,rows,['商务编号','示例合同金额']);
}
