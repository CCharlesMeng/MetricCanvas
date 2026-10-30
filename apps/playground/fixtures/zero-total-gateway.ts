import {createDqeGateway} from '@metriccanvas/engine/dqe';
import type {DataGateway,RuntimeDataGateway} from '@metriccanvas/engine';

const parents=[{'地区部':'甲地区部','得分':0},{'地区部':'乙地区部','得分':-2}];
const candidates=[
  {value:'甲地区部',label:'甲地区部',level:'region-dept'},
  {value:'乙地区部',label:'乙地区部',level:'region-dept'},
  {value:'甲代表处',label:'甲代表处',level:'office',parent:{level:'region-dept',value:'甲地区部'}}
];
type ReplayItem={object_type:string;filter?:{fields?:{field_name:string;value_list:string[]}[]}};
function replayResult(item:ReplayItem) {
  if(item.object_type==='Demo/Zero Total/lookup')return {code:'SUCCESS',columns:null,data:[{'地区部':'甲地区部'}],total_count:1};
  if(item.object_type==='Demo/Zero Total/detail'){
    const region=item.filter?.fields?.find(field=>field.field_name==='地区部');
    const rows=region?.value_list.includes('甲地区部')?[{'代表处':'甲代表处','得分':7}]:[];
    return {code:'SUCCESS',columns:null,data:rows,total_count:0};
  }
  const rows=item.object_type==='Demo/Zero Total/empty'?[]:parents;
  return {code:'SUCCESS',columns:null,data:rows,total_count:item.object_type==='Demo/Zero Total/normal'?rows.length:0};
}
/** Synthetic HTTP receipts for the count-mismatch scenarios; business gateways are untouched. */
export function createZeroTotalPreview(): {dataGateway:RuntimeDataGateway} {
  return {dataGateway:{...createDqeGateway({fetchImpl:async (_url, init)=>{
    init?.signal?.throwIfAborted();
    const request=JSON.parse(String(init?.body)) as {dsl_list:ReplayItem[]};
    return Response.json({retCode:'CBC.0000',results:request.dsl_list.map(replayResult)});
  }}),async fetchFilterCandidates(){return {kind:'values' as const,candidates};}}};
}

export function zeroTotalPreviewGateway(pageId:string, fallback:DataGateway):DataGateway {
  return pageId==='query-zero-total-demo'||pageId==='query-zero-total-hierarchy'?createZeroTotalPreview().dataGateway:fallback;
}
