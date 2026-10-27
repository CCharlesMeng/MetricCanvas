import type {DataGateway} from '../../../../packages/data-execution/src/ports';
import {calendarEndpoint,objectDateBoundary,type EffectiveQuery,type Row} from '@metriccanvas/page/internal';
import {sortTableRows} from '../../../../packages/data-execution/src/table-view';
export interface RejectionPreviewOptions {rows?:number;duplicateBasic?:boolean;failure?:boolean;delayMs?:number}
/** Synthetic approvals: two independent records per business, current basic rows and one missing match. */
export function rejectionRows(count=1205):Row[]{
  return Array.from({length:count},(_,index)=>{
    const business=Math.floor(index/2);
    return {'biz-id':`B-${String(business).padStart(5,'0')}`,'biz-code':`BIZ-${String(business).padStart(5,'0')}`,
      'region-dept-name':business%2?'测试东区':'测试西区','rep-office-name':`测试代表处${business%3}`,
      'biz-approve-time':`2026-09-${String(index%28+1).padStart(2,'0')} 12:00:00`,
      'approval-result':'驳回','approval-opinion':index%2?'请补充材料':null,'review-organizer':'测试评审人','approval-stage':index%2?'复审':'初审',
      'biz-owner-name':`测试责任人${business%4}`,'life-status':business%2?'已关闭':'进行中'};
  });
}
function valuesForQuery(query:EffectiveQuery,source:Row[]):Row[]{
  let rows=source;
  for(const predicate of query.filterValues){
    if(predicate.target==='time'){rows=filterPreviewTime(rows,query,predicate);continue;}
    if(predicate.target!=='dimension')continue;
    const field=Object.entries(query.fieldMappings).find(([,field])=>'queryField' in field&&field.queryField===predicate.queryField)?.[0];
    if(field)rows=rows.filter(row=>predicate.values.includes(row[field] as string));
    else if(predicate.queryField==='region_dept_code')rows=rows.filter(row=>predicate.values.includes(row['region-dept-name']==='测试东区'?'east':'west'));
  }
  return rows;
}
export function createRejectionPreview(options:RejectionPreviewOptions={}){
  const records=rejectionRows(options.rows),calls:EffectiveQuery[]=[];
  const basics=[...new Map(records.map(row=>[row['biz-id'],row])).values()].filter(row=>row['biz-id']!=='B-00000');
  if(options.duplicateBasic)basics.push(basics[0]);
  const dataGateway:DataGateway={async fetchData(query,_context,signal){
    calls.push(structuredClone(query));
    if(options.delayMs)await delay(options.delayMs,signal);
    signal?.throwIfAborted();
    if(options.failure)throw Object.assign(new Error('测试上游失败'),{code:'DQE_TRANSPORT_ERROR'});
    let rows=valuesForQuery(query,'approval-stage' in query.fieldMappings?records:basics);
    if(query.sort)rows=sortTableRows(rows,query.sort.map(rule=>({field:Object.entries(query.fieldMappings).find(([,field])=>'queryField' in field&&field.queryField===rule.queryField)![0],direction:rule.direction})));
    const totalCount=rows.length;
    if(query.pagination)rows=rows.slice(query.pagination.offset,query.pagination.offset+query.pagination.limit);
    return {totalCount,rows:rows.map(row=>Object.fromEntries(Object.keys(query.fieldMappings).map(field=>[field,row[field]])))};
  }};
  return {dataGateway,calls};
}
async function delay(ms:number,signal?:AbortSignal):Promise<void>{
  await new Promise<void>((resolve,reject)=>{
    const finish=()=>{signal?.removeEventListener('abort',abort);resolve();};
    const timer=setTimeout(finish,ms);
    const abort=()=>{clearTimeout(timer);reject(signal?.reason);};
    signal?.addEventListener('abort',abort,{once:true});
  });
}

function filterPreviewTime(rows:Row[],query:EffectiveQuery,predicate:Extract<EffectiveQuery['filterValues'][number],{target:'time'}>):Row[]{
  const field=Object.entries(query.fieldMappings).find(([,field])=>'queryField' in field&&field.queryField===predicate.queryField)?.[0];
  if(!field||!predicate.valueFormat)throw new Error('合成记录时间筛选要求字段和格式');
  const from=objectDateBoundary(calendarEndpoint(predicate.value.from,false),false,predicate.valueFormat);
  const to=objectDateBoundary(calendarEndpoint(predicate.value.to,true),true,predicate.valueFormat);
  return rows.filter(row=>String(row[field])>=from&&String(row[field])<=to);
}
