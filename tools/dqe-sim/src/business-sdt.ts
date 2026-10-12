import september from '../fixtures/business-sdt-cascade.json';
import october from '../fixtures/business-sdt-cascade-october.json';
import type { DqeSimItemResult } from './execute';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value);
const same = (actual: unknown, expected: string[]) => Array.isArray(actual) && actual.length === expected.length && expected.every(value => actual.includes(value));

/** Normal DQE requests only; the simulator never executes cascade or compute. */
export function executeBusinessSdt(value: unknown, scenario = 'normal'): DqeSimItemResult | undefined {
  if (!record(value) || !Array.isArray(value.output_metrics) || !value.output_metrics.includes('SDT成员决策时长')) return undefined;
  const reject = (): DqeSimItemResult => ({code:'DQE_SIM_UNSUPPORTED_QUERY',data:[],total_count:0,retDesc:'商务SDT仿真不支持该查询条件',dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}});
  if (!record(value.filter) || !record(value.filter.time)) return reject();
  const month = value.filter.time.start;
  const fixture = [september, october].find(candidate => candidate.month === month);
  if (!fixture) return reject();
  if ('cascade' in value || 'pivot' in value || !record(value.filter) || !record(value.filter.time) ||
      value.filter.time.period !== 'month' || value.filter.time.start !== fixture.month || value.filter.time.end !== fixture.month ||
      !Array.isArray(value.filter.dims) || !Array.isArray(value.filter.metrics) || value.filter.metrics.length || !record(value.order)) return reject();
  let rows: RecordValue[];
  if (same(value.output_dims,['客户名称','项目名称','商务编号']) && same(value.output_metrics,['SDT成员决策时长'])) {
    if (value.filter.dims.length || value.order.order_by_field !== 'SDT成员决策时长' || !['asc','desc'].includes(String(value.order.type)) || value.order.limit !== 5 || 'offset' in value.order) return reject();
    const direction = value.order.type === 'asc' ? 1 : -1;
    rows = [...fixture.projects].sort((a,b)=>direction*(a['SDT成员决策时长']-b['SDT成员决策时长'])).slice(0,5);
    if (scenario === 'main-error') return reject();
    if (scenario === 'empty') rows = [];
  } else if (same(value.output_dims,['商务编号','阶段名称']) && same(value.output_metrics,['SDT成员决策时长','SDT成员决策次数'])) {
    const dim = value.filter.dims[0];
    if (value.filter.dims.length !== 1 || !record(dim) || dim.dim_name !== '商务编号' || !Array.isArray(dim.dim_value_list) || !dim.dim_value_list.length || Object.keys(value.order).length) return reject();
    const ids = dim.dim_value_list;
    if (!ids.every(id=>fixture.projects.some(project=>project['商务编号']===id))) return reject();
    rows = fixture.stages.filter(row=>ids.includes(row['商务编号']));
    if (scenario === 'detail-error') return reject();
  } else return reject();
  return {code:'SUCCESS',data:rows,total_count:rows.length,dqe:{
    columns:[...(value.output_dims as string[]).map(caption=>({id:caption,caption,data_type:'STRING' as const,type:'dimension' as const})),
      ...(value.output_metrics as string[]).map(caption=>({id:caption,caption,data_type:'NUMBER' as const,type:'metric' as const}))],
    orders:[],limit:-1,offset:-1,sql:null
  }};
}
