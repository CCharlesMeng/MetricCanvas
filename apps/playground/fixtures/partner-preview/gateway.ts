import {createDqeGateway} from '@metriccanvas/engine/dqe';
import type {DataGateway} from '@metriccanvas/engine';
import {offices,organizationFields,scopeScores,scoreMetrics,type Office,type ScoreVector} from './data';

interface Predicate {dim_name:string;dim_value_list:string[]}
export interface PartnerHealthQuery {
  output_dims:string[];output_metrics:string[];
  filter?:{dims?:Predicate[];time?:{start?:string;end?:string;period?:string}};
}
type RawRow = Record<string,string|number|null>;
const organizationDimensions = new Set(Object.keys(organizationFields(offices[0]!)));
const unsupported = () => ({code:'DQE_SIM_UNSUPPORTED_QUERY',data:[],total_count:0,retDesc:'伙伴健康度本地模拟未配置此查询'});
const result = (data: RawRow[]) => ({code:'SUCCESS',data,total_count:data.length});

function selectedOffices(item: PartnerHealthQuery): Office[] {
  return offices.filter(office => (item.filter?.dims ?? []).every(predicate =>
    predicate.dim_value_list.includes(organizationFields(office)[predicate.dim_name]!)));
}
function presetScores(group: readonly Office[]): ScoreVector {
  if (group.length === 1) return group[0]!.scores;
  const departments = new Set(group.map(office=>office.department));
  if (departments.size === 1) return scopeScores[group[0]!.department]!;
  const sites = new Set(group.map(office=>office.site));
  if (sites.size === 1) return scopeScores[group[0]!.site]!;
  return scopeScores['全部']!;
}
function periodScore(value:number|null, item:PartnerHealthQuery):number|null {
  if (value === null || value === 0) return value;
  const start = item.filter?.time?.start ?? '2026-10';
  const month = Number(start.slice(5,7)) || 1;
  const year = Number(start.slice(0,4));
  return Math.round((value+(month-10)*0.1+(year-2026)*0.15)*10)/10;
}
function scoreRows(item:PartnerHealthQuery, selected:Office[]):RawRow[] {
  const groups = new Map<string,Office[]>();
  for (const office of selected) {
    const values = organizationFields(office);
    const key = JSON.stringify(item.output_dims.map(dimension=>values[dimension]));
    const group = groups.get(key) ?? [];
    group.push(office);groups.set(key,group);
  }
  return [...groups.values()].map(group=>{
    const fields = organizationFields(group[0]!);
    const row:RawRow=Object.fromEntries(item.output_dims.map(dim=>[dim,fields[dim]!]));
    const scores = presetScores(group);
    for (const metric of item.output_metrics) row[metric]=periodScore(scores[scoreMetrics.indexOf(metric)]!,item);
    return row;
  });
}
function detailFields(office:Office,index:number):RawRow {
  return {...organizationFields(office),partner_company_name:`${office.name} · 伙伴${index+1}`,
    partner_customer_name:`P-${String(index+1).padStart(3,'0')}`,partner_plan:'优选伙伴',partner_id:`demo-${index+1}`,
    first_level_tag_name:index%2===0?'云迁移服务':'技术支持服务',metrics_cnt_number:20+index*3,
    metrics_cnt_number_close:18+index*2};
}
function detailRows(item:PartnerHealthQuery, selected:Office[]):RawRow[] {
  const rows=selected.map(detailFields);
  const fields=[...item.output_dims,...item.output_metrics];
  return rows.map(row=>Object.fromEntries(fields.map(field=>[field,row[field]??null])));
}

/** 模拟后端返回原始queryField，仍经过真实DQE归一化和页面compute，不在此处计算页面总分。 */
export function partnerHealthResult(item:PartnerHealthQuery) {
  const selected=selectedOffices(item);
  if (item.output_metrics.length && item.output_metrics.every(metric=>scoreMetrics.includes(metric))) {
    if (!item.output_dims.every(dim=>organizationDimensions.has(dim))) return unsupported();
    return result(scoreRows(item,selected));
  }
  if (!item.output_metrics.length && item.output_dims.length===1 && organizationDimensions.has(item.output_dims[0]!)) {
    const dimension=item.output_dims[0]!;
    const values=[...new Set(selected.map(office=>organizationFields(office)[dimension]!))];
    return result(values.map(value=>({[dimension]:value})));
  }
  const detail=detailFields(offices[0]!,0);
  if ([...item.output_dims,...item.output_metrics].every(field=>Object.hasOwn(detail,field))) return result(detailRows(item,selected));
  return unsupported();
}
const previewFetch:typeof fetch=async (_input,init)=>{
  init?.signal?.throwIfAborted();
  const body=JSON.parse(String(init?.body)) as {dsl_list:PartnerHealthQuery[]};
  return Response.json({retCode:'CBC.0000',results:body.dsl_list.map(partnerHealthResult)});
};
export function createPartnerHealthPreview() {
  return {dataGateway:createDqeGateway({fetchImpl:previewFetch})};
}
/** 仅受信任的页面入口选择模拟网关，不由编辑中的JSON决定，也不访问真实服务。 */
export function partnerHealthPreviewGateway(pageId:string,fallback:DataGateway):DataGateway {
  return pageId==='partner-health'?createPartnerHealthPreview().dataGateway:fallback;
}
