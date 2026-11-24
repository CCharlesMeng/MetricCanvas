import fixture from '../fixtures/business-result-metrics.json';
import {sortDqeRows} from './sort';
import type {DqeSimItemResult} from './execute';

type ObjectValue = Record<string, unknown>;
type Organization = (typeof fixture.organizations)[number];
type Row = Record<string, string | number>;
const record = (value: unknown): value is ObjectValue => !!value && typeof value === 'object' && !Array.isArray(value);
const netDiscount = '净商务折扣（原价）';
const detailMetrics = ['框架执行率','重大高风险合同率','云计算BU禁止条款风险合同率'];
const mainMetrics = [netDiscount, ...detailMetrics];
const discountComparisonPeriods = new Map<string, 'month' | 'year'>([
  [netDiscount + '月变化', 'month'],
  [netDiscount + '季变化', 'year'],
  [netDiscount + '年变化', 'year']
]);
const closure = '决策闭环任务总体闭环率(投标-商务-合同)';
const metricSets = [mainMetrics,detailMetrics,[netDiscount],...[...discountComparisonPeriods.keys()].map(metric => [metric]),[closure],['净商务折扣','净商务折扣均值'],['净商务折扣'],['框架执行率','框架已达成金额','框架目标消费金额'],['已闭环任务数(投标-商务-合同)','决策闭环任务总数(投标-商务-合同)',closure],['风险合同率','风险合同数','合同总数']];
const signatures = new Set(metricSets.flatMap(metrics => dimensionsFor(metrics).map(dims => JSON.stringify([dims,metrics]))));
const failure = (): DqeSimItemResult => ({code:'DQE_SIM_UNSUPPORTED_QUERY',data:[],total_count:0,retDesc:'业务结果合成场景不支持此查询、期间或谓词',dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}});
const cloudField = '云服务';
const cloudSignature = JSON.stringify([[cloudField],[]]);
const netPayment = '净付费金额';
const cloudPaymentSignature = JSON.stringify([[cloudField],[netPayment]]);
const customerClasses = ['卓越NA','战略NA','核心NA'];
const businessCustomerClasses = [...customerClasses, '商业客户'];
const businessCustomerClass = new Map([...fixture.organizations, ...fixture.europePreviewOrganizations].map(
  (organization, index) => [organization, businessCustomerClasses[index % businessCustomerClasses.length]] as const
));
const cloudTypeValues: Record<string,string> = {
  业务类型编码: 'SERVICE_TYPE_HUAWEI_PUBLIC_CLOUD_CORE',
  子业务类型编码: 'SUB_SERVICE_TYPE_PUBLIC_REGION'
};
const businessCloudService = new Map(fixture.organizations.map((organization,index) =>
  [organization, cloudServiceName(index * 5)] as const
));

function cloudServiceName(index: number): string {
  return `模拟云服务 ${String(index + 1).padStart(2,'0')}`;
}

/** 各组织组共用模拟服务目录，相邻组织的候选有重叠。 */
function organizationCloudServices(organizations: readonly Organization[]) {
  return organizations.flatMap((organization, index) =>
    Array.from({length:25}, (_, item) => {
      const number = index * 5 + item;
      return { ...organization, [cloudField]:cloudServiceName(number), 客户级别:customerClasses[number % customerClasses.length] };
    }));
}

const cloudServices = [
  ...organizationCloudServices(fixture.organizations),
  ...organizationCloudServices(fixture.europePreviewOrganizations)
];

function dimensionsFor(metrics: string[]): string[][] {
  if (metrics[0] === closure) return [[],['地区部'],['决策业务类型','地区部'],['决策业务类型','地区部','代表处']];
  if (metrics === mainMetrics) return [[],['地区部'],['代表处']];
  if (metrics[0] === netDiscount) return [[],['地区部'],['代表处']];
  if (metrics === detailMetrics) return [[],['地区部'],['代表处']];
  if (discountComparisonPeriods.has(metrics[0])) return [[],['地区部'],['代表处']];
  return [['代表处']];
}

/** Exact synthetic query signatures; no page ids, initial rows or frontend receipt injection. */
export function executeBusinessResultMetrics(input: unknown): DqeSimItemResult | undefined {
  if (!record(input)) return;
  const signature = JSON.stringify([input.output_dims,input.output_metrics]);
  if (signature === cloudSignature || signature === cloudPaymentSignature) return cloudCandidates(input, signature === cloudPaymentSignature);
  if (!signatures.has(signature)) return;
  try {
    if (input.query_type !== undefined) return failure();
    const filter = input.filter;
    if (!record(filter) || !record(filter.time) || !validTime(filter.time)) return failure();
    if (JSON.stringify(filter.metrics) !== '[]' || !Array.isArray(filter.dims)) return failure();
    const dims = input.output_dims as string[], metrics = input.output_metrics as string[];
    if (!dims.length && !scalarResultSupported(metrics, filter.time)) return failure();
    const predicates = filter.dims;
    // Validate every predicate even when another predicate yields no organizations.
    predicates.forEach(validatePredicate);
    const selected = businessOrganizations(predicates).filter(row => predicates.every(predicate => matches(row,predicate)));
    const business = predicates.find(predicate => (predicate as ObjectValue).dim_name === '决策业务类型') as ObjectValue | undefined;
    const categories = business ? business.dim_value_list as string[] : ['商务','合同'];
    const data = aggregateRows(selected,dims,metrics,filter.time,categories);
    return result(input,data,[...dims,...metrics]);
  } catch { return failure(); }
}

function scalarResultSupported(metrics: string[], time: ObjectValue): boolean {
  return time.is_aggregate === true || (time.is_aggregate === undefined && metrics[0] === netDiscount);
}

function businessOrganizations(predicates: ObjectValue[]): Organization[] {
  const europeSelected = predicates.some(predicate =>
    predicate.dim_name === 'geo_pc_code' && (predicate.dim_value_list as string[]).includes('R05')
  );
  return europeSelected ? [...fixture.organizations, ...fixture.europePreviewOrganizations] : fixture.organizations;
}

function cloudCandidates(input:ObjectValue, includePayment:boolean):DqeSimItemResult {
  const filter = input.filter, order = input.order;
  if (input.query_type !== undefined || !record(filter) || !validCloudFilter(filter)) return failure();
  if (!record(order) || order.order_by_field !== cloudField) return failure();
  const offset = order.offset, limit = order.limit;
  if (!wholeNumber(offset,0) || !wholeNumber(limit,1)) return failure();
  const predicates = (filter.dims as ObjectValue[]);
  const values = new Set(cloudServices.filter(row => predicates.every(predicate => matchesCloud(row,predicate))).map(row => row[cloudField]));
  const candidates = [...values].map(value => {
    const row: Row = {[cloudField]:value};
    if (includePayment) row[netPayment] = 100;
    return row;
  });
  const rows = sortDqeRows(candidates, order, [cloudField]);
  if (!rows) return failure();
  const columns: DqeSimItemResult['dqe']['columns'] = [{id:cloudField,caption:cloudField,type:'dimension',data_type:'STRING'}];
  if (includePayment) columns.push({id:netPayment,caption:netPayment,type:'metric',data_type:'NUMBER'});
  return {code:'SUCCESS',data:rows.slice(offset,offset + limit),total_count:rows.length,
    dqe:{columns,orders:[],offset,limit,sql:null}};
}

function wholeNumber(value:unknown, minimum:number):value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function validCloudFilter(filter:ObjectValue):boolean {
  return record(filter.time) && validTime(filter.time) && JSON.stringify(filter.metrics) === '[]' &&
    Array.isArray(filter.dims) && filter.dims.every(validCloudPredicate);
}

function validCloudPredicate(value:unknown):boolean {
  if (!record(value) || value.is_exclude === true || !Array.isArray(value.dim_value_list)) return false;
  if (!value.dim_value_list.every(item => typeof item === 'string')) return false;
  if (value.operator === 'contains') return value.dim_name === cloudField && value.dim_value_list.length === 1;
  return (value.operator ?? '=') === '=' &&
    ['geo_pc_code','地区部','代表处','客户级别',cloudField].includes(String(value.dim_name));
}

function matchesCloud(row:(typeof cloudServices)[number], predicate:ObjectValue):boolean {
  const field = predicate.dim_name as keyof typeof row;
  const value = row[field];
  const choices = predicate.dim_value_list as string[];
  if (predicate.operator === 'contains') return String(value).includes(choices[0]);
  return matchesOrganizationValue(row, field, choices);
}

function matchesOrganizationValue(row: Organization, field: string, choices: readonly unknown[]): boolean {
  if (choices.includes(String(row[field as keyof Organization]))) return true;
  if (field === '地区部') return choices.includes(row.region_dept_code);
  return field === '代表处' && choices.includes(row.rep_office_code);
}

function validTime(time: ObjectValue): boolean {
  const patterns: Record<string, RegExp> = {year:/^202[4-6]$/,quarter:/^202[4-6]-Q[1-4]$/,month:/^202[4-6]-(0[1-9]|1[0-2])$/,day:/^202[4-6]-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/};
  const pattern = patterns[String(time.period)];
  return !!pattern && typeof time.start === 'string' && typeof time.end === 'string' && pattern.test(time.start) && pattern.test(time.end) && time.start <= time.end;
}

function validatePredicate(predicate: unknown): asserts predicate is ObjectValue {
  if (!record(predicate)) throw Error('predicate');
  const dimension = String(predicate.dim_name), values = predicate.dim_value_list;
  const allowed = ['geo_pc_code','region_dept_code','rep_office_code','地区部','代表处','国内或海外','决策业务类型','客户级别',cloudField,...Object.keys(cloudTypeValues)];
  if (!allowed.includes(dimension) || !Array.isArray(values)) throw Error('dimension');
  if ((predicate.operator ?? '=') !== '=' || (predicate.is_exclude === true) !== (dimension === cloudField)) throw Error('operator');
  if (values.some(value => typeof value !== 'string')) throw Error('value');
  if (dimension === '决策业务类型' && values.some(value => !['商务','合同'].includes(String(value)))) throw Error('business type');
}

function matches(row: Organization, predicate: unknown): boolean {
  const p = predicate as ObjectValue;
  const field = String(p.dim_name), values = p.dim_value_list as unknown[];
  if (field === '决策业务类型') return true;
  if (field === cloudField) return !values.includes(businessCloudService.get(row));
  if (field === '客户级别') return values.includes(businessCustomerClass.get(row));
  if (Object.hasOwn(cloudTypeValues,field)) return values.includes(cloudTypeValues[field]);
  return matchesOrganizationValue(row, field, values);
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

function ratePeriod(start: string): 'current' | 'previous' | 'september' | 'yearAgo' {
  if (start.startsWith('2024') || start.startsWith('2025')) return 'yearAgo';
  if (start.startsWith('2026-09')) return 'september';
  return start.startsWith('2026-10') ? 'previous' : 'current';
}

function discountChange(group: Organization[], start: string, comparison: 'month' | 'year'): number {
  const current = ratePeriod(start);
  if (comparison === 'year') return weighted(group, current) - weighted(group, 'yearAgo');
  const previous = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  return weighted(group, current) - weighted(group, ratePeriod(previous.toISOString().slice(0, 7)));
}

function weighted(group: Organization[], field: keyof Organization): number {
  const weight = group.reduce((total,row) => total + row.weight,0);
  return group.reduce((total,row) => total + Number(row[field]) * row.weight,0) / weight;
}

function metricValue(group: Organization[], metric: string, time: ObjectValue, category: string): number {
  const start = String(time.start);
  const comparison = discountComparisonPeriods.get(metric);
  if (comparison) return discountChange(group, start, comparison);
  const period = ratePeriod(start);
  const fields: Record<string,keyof Organization> = {[netDiscount]:period,'净商务折扣':period,'净商务折扣均值':period,'框架执行率':'framework','重大高风险合同率':'major','云计算BU禁止条款风险合同率':'forbidden','风险合同率':'major',[closure]:category === '合同' ? 'contract' : 'commercial'};
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
