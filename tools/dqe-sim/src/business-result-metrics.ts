import fixture from '../fixtures/business-result-metrics.json';
import {sortDqeRows} from './sort';
import type {DqeSimItemResult} from './execute';

type ObjectValue = Record<string, unknown>;
type Organization = (typeof fixture.organizations)[number];
type Row = Record<string, string | number>;
const record = (value: unknown): value is ObjectValue => !!value && typeof value === 'object' && !Array.isArray(value);
const mainMetrics = ['净商务折扣（原价）','框架执行率','重大高风险合同率','云计算BU禁止条款风险合同率'];
const closure = '决策闭环任务总体闭环率(投标-商务-合同)';
const metricSets = [mainMetrics,['净商务折扣（原价）'],[closure],['净商务折扣','净商务折扣均值'],['净商务折扣'],['框架执行率','框架已达成金额','框架目标消费金额'],['已闭环任务数(投标-商务-合同)','决策闭环任务总数(投标-商务-合同)',closure],['风险合同率','风险合同数','合同总数']];
const signatures = new Set(metricSets.flatMap(metrics => dimensionsFor(metrics).map(dims => JSON.stringify([dims,metrics]))));
const failure = (): DqeSimItemResult => ({code:'DQE_SIM_UNSUPPORTED_QUERY',data:[],total_count:0,retDesc:'业务结果合成场景不支持此查询、期间或谓词',dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}});

function dimensionsFor(metrics: string[]): string[][] {
  if (metrics[0] === closure) return [[],['地区部'],['决策业务类型','地区部'],['决策业务类型','地区部','代表处']];
  if (metrics === mainMetrics) return [[],['地区部'],['代表处']];
  if (metrics[0] === '净商务折扣（原价）') return [[],['地区部'],['代表处']];
  return [['代表处']];
}

/** Exact synthetic query signatures; no page ids, initial rows or frontend receipt injection. */
export function executeBusinessResultMetrics(input: unknown): DqeSimItemResult | undefined {
  if (!record(input) || !signatures.has(JSON.stringify([input.output_dims,input.output_metrics]))) return;
  try {
    if (input.query_type !== undefined) return failure();
    const filter = input.filter;
    if (!record(filter) || !record(filter.time) || !validTime(filter.time)) return failure();
    if (JSON.stringify(filter.metrics) !== '[]' || !Array.isArray(filter.dims)) return failure();
    const dims = input.output_dims as string[], metrics = input.output_metrics as string[];
    if (!dims.length && filter.time.is_aggregate !== true) return failure();
    const predicates = filter.dims;
    // Validate every predicate even when another predicate yields no organizations.
    predicates.forEach(validatePredicate);
    const selected = fixture.organizations.filter(row => predicates.every(predicate => matches(row,predicate)));
    const business = predicates.find(predicate => (predicate as ObjectValue).dim_name === '决策业务类型') as ObjectValue | undefined;
    const categories = business ? business.dim_value_list as string[] : ['商务','合同'];
    const data = aggregateRows(selected,dims,metrics,filter.time,categories);
    return result(input,data,[...dims,...metrics]);
  } catch { return failure(); }
}

function validTime(time: ObjectValue): boolean {
  const patterns: Record<string, RegExp> = {year:/^202[4-6]$/,quarter:/^202[4-6]-Q[1-4]$/,month:/^202[4-6]-(0[1-9]|1[0-2])$/,day:/^202[4-6]-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/};
  const pattern = patterns[String(time.period)];
  return !!pattern && typeof time.start === 'string' && typeof time.end === 'string' && pattern.test(time.start) && pattern.test(time.end) && time.start <= time.end;
}

function validatePredicate(predicate: unknown): asserts predicate is ObjectValue {
  if (!record(predicate)) throw Error('predicate');
  const allowed = ['geo_pc_code','region_dept_code','rep_office_code','地区部','代表处','国内或海外','决策业务类型'];
  if (!allowed.includes(String(predicate.dim_name)) || !Array.isArray(predicate.dim_value_list)) throw Error('dimension');
  if ((predicate.operator ?? '=') !== '=' || predicate.is_exclude === true) throw Error('operator');
  if (predicate.dim_value_list.some(value => typeof value !== 'string')) throw Error('value');
  if (predicate.dim_name === '决策业务类型' && predicate.dim_value_list.some(value => !['商务','合同'].includes(String(value)))) throw Error('business type');
}

function matches(row: Organization, predicate: unknown): boolean {
  const p = predicate as ObjectValue;
  if (p.dim_name === '决策业务类型') return true;
  return (p.dim_value_list as unknown[]).includes(row[p.dim_name as keyof Organization]);
}

function aggregateRows(organizations: Organization[], dims: string[], metrics: string[], time: ObjectValue, categories: string[]): Row[] {
  const groups = new Map<string, Organization[]>();
  const keys = dims.filter(dim => dim !== '决策业务类型');
  for (const row of organizations) {
    const key = JSON.stringify(keys.map(field => row[field as keyof Organization]));
    const group = groups.get(key) ?? [];
    group.push(row); groups.set(key,group);
  }
  return [...groups.values()].flatMap(group => {
    const types = dims.includes('决策业务类型') ? categories : categories.slice(0,1);
    return types.map(category => project(group,dims,metrics,time,category));
  });
}

function project(group: Organization[], dims: string[], metrics: string[], time: ObjectValue, category: string): Row {
  const row: Row = {};
  for (const dim of dims) row[dim] = dim === '决策业务类型' ? category : String(group[0][dim as keyof Organization]);
  for (const metric of metrics) row[metric] = metricValue(group,metric,time,category);
  return row;
}

function ratePeriod(time: ObjectValue): 'current' | 'previous' | 'yearAgo' {
  if (String(time.start).startsWith('2024') || String(time.start).startsWith('2025')) return 'yearAgo';
  return String(time.start).startsWith('2026-10') ? 'previous' : 'current';
}

function weighted(group: Organization[], field: keyof Organization): number {
  const weight = group.reduce((total,row) => total + row.weight,0);
  return group.reduce((total,row) => total + Number(row[field]) * row.weight,0) / weight;
}

function metricValue(group: Organization[], metric: string, time: ObjectValue, category: string): number {
  const fields: Record<string,keyof Organization> = {'净商务折扣（原价）':ratePeriod(time),'净商务折扣':ratePeriod(time),'净商务折扣均值':ratePeriod(time),'框架执行率':'framework','重大高风险合同率':'major','云计算BU禁止条款风险合同率':'forbidden','风险合同率':'major',[closure]:category === '合同' ? 'contract' : 'commercial'};
  if (fields[metric]) {
    const value = weighted(group,fields[metric]);
    return mainMetrics.includes(metric) ? value / 100 : value;
  }
  const weight = group.reduce((total,row) => total + row.weight,0);
  const amounts: Record<string,number> = {'框架目标消费金额':100000,'框架已达成金额':1000 * weighted(group,'framework'),'决策闭环任务总数(投标-商务-合同)':100,'已闭环任务数(投标-商务-合同)':weighted(group,fields[closure]),'合同总数':100,'风险合同数':weighted(group,'major')};
  return weight * amounts[metric];
}

function result(input: ObjectValue, rows: Row[], fields: string[]): DqeSimItemResult {
  if (!record(input.order)) return failure();
  const order = input.order;
  if (order.limit !== undefined || order.offset !== undefined) return failure();
  const sorted = sortDqeRows(rows,order,fields);
  if (!sorted) return failure();
  return {code:'SUCCESS',data:sorted,total_count:sorted.length,dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}};
}
