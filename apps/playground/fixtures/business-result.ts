import {createInjectedDqeGateway} from '@metriccanvas/application-runtime';
import {dqeRecord,type JsonObject,type Row} from '@metriccanvas/page/internal';
import {iocRegionCandidates} from '../../../tools/dqe-sim/fixtures/ioc-region-candidates.mjs';

function selected(item:JsonObject,name:string):string|undefined {
  const dims=dqeRecord(item.filter).dims;
  if(!Array.isArray(dims))return;
  const entry=dims.map(dqeRecord).find(value=>value.dim_name===name);
  return Array.isArray(entry?.dim_value_list)?String(entry.dim_value_list[0]):undefined;
}
function metricValue(name:string,narrow:boolean,business:string):number {
  if(name==='决策闭环任务总体闭环率(投标-商务-合同)')return business==='商务'?91:83;
  const values:Record<string,number>={'净商务折扣（原价）':narrow?87:90,'框架执行率':narrow?72:80,'重大高风险合同率':narrow?18:24,'云计算BU禁止条款风险合同率':narrow?3:5};
  return values[name]??60;
}
const organizations=[
  {office:'北京代表处',department:'华北地区部',code:'CN-NORTH'},
  {office:'上海代表处',department:'华东地区部',code:'CN-EAST'}
];
function organizationNames(offices:boolean,region:string|undefined):string[]{
  return organizations.filter(row=>!region||row.code===region).map(row=>offices?row.office:row.department);
}
function organizationRow(name:string):Row {
  const organization=organizations.find(row=>row.office===name);
  return {'地区部':organization?.department??name,'代表处':name};
}
function rows(item:JsonObject):Row[] {
  const dims=Array.isArray(item.output_dims)?item.output_dims.filter((v):v is string=>typeof v==='string'):[];
  const metrics=Array.isArray(item.output_metrics)?item.output_metrics.filter((v):v is string=>typeof v==='string'):[];
  const region=selected(item,'region_dept_code');
  const narrow=region!==undefined;
  const offices=dims.includes('代表处');
  const names=dims.length===0?['合计']:organizationNames(offices,region);
  const types=dims.includes('决策业务类型')?['商务','合同']:[selected(item,'决策业务类型')??'商务'];
  return names.flatMap(name=>types.map(business=>{
    const row:Row={...organizationRow(name),'决策业务类型':business};
    for(const metric of metrics)row[metric]=metricValue(metric,narrow,business);
    return Object.fromEntries([...dims,...metrics].map(field=>[field,row[field]??'合成候选']));
  }));
}
/** Local synthetic HTTP receipts verify page wiring; never a real business-service result. */
function receipt(item:JsonObject,state:string):JsonObject {
  const summary=Array.isArray(item.output_dims)&&item.output_dims.length===0;
  if(summary&&state==='summary-error')return {code:'SYNTHETIC_FAILURE',data:[],total_count:0};
  const data=summary&&state==='summary-empty'?[]:rows(item);
  return {code:'SUCCESS',data,total_count:data.length};
}
export function createBusinessResultPreview(state='ready'){
  const requests:JsonObject[]=[];
  const fetchImpl:typeof fetch=async(_url,init)=>{
    init?.signal?.throwIfAborted();
    const body=JSON.parse(String(init?.body)) as {dsl_list:JsonObject[]};
    requests.push(...structuredClone(body.dsl_list));
    return Response.json({retCode:'CBC.0000',results:body.dsl_list.map(item=>receipt(item,state))});
  };
  const base=createInjectedDqeGateway(fetchImpl,undefined,()=>({dqeEndpoint:'/synthetic-business-result',pageMetadataBaseUrl:'/synthetic-pages',authToken:'synthetic',operatorId:'synthetic',workspaceId:'synthetic'}));
  const dataGateway={...base,async fetchFilterCandidates(request:import('@metriccanvas/engine').FilterCandidatesRequest,options:{signal:AbortSignal}){
    options.signal.throwIfAborted();
    return iocRegionCandidates(request)??{kind:'values' as const,candidates:[{value:'国内',label:'国内'},{value:'海外',label:'海外'}]};
  }};
  return {dataGateway,requests};
}
