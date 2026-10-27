import {restoreCellFallbacks,queryResultFieldContract,validateContractRows,type EffectiveQuery,type Row,type FieldDefinition} from '@metriccanvas/page/internal';
import type {QueryRunner} from '../query-runner';
import {intersectQueryFilters} from '../intersect-filters';
import type {PagedJoinPlan} from './plan';
import {rowFailure} from './rows';
export const recordLimit=(message:string)=>Object.assign(new Error(message),{code:'DQE_QUERY_REJECTED'});
export interface RecordBudget {rows:number;bytes:number;maxRows:number;maxBytes:number;signal:AbortSignal}

export function chargeRows(budget:RecordBudget,rows:readonly Row[],domain:boolean):void{
  budget.signal.throwIfAborted();
  budget.bytes+=new TextEncoder().encode(JSON.stringify(rows)).byteLength;
  if(domain)budget.rows+=rows.length;
  if(budget.rows>budget.maxRows||budget.bytes>budget.maxBytes)throw recordLimit('记录关联超过行数或字节预算，请缩小筛选范围');
}
function batchRows(result:Awaited<ReturnType<QueryRunner['run']>>,offset:number,limit:number,expected:number|undefined):{rows:Row[];total:number}{
  if(result.status==='error')throw Object.assign(new Error(result.error.message),{code:result.error.code});
  if(result.status==='loading')throw rowFailure('成员结果尚未完成');
  const rows=result.status==='ready'?result.rows:[],total=result.totalCount;
  if(total===undefined||!Number.isSafeInteger(total)||total<0)throw rowFailure('记录分批读取必须返回准确总数');
  if(expected!==undefined&&expected!==total)throw rowFailure('记录分批读取期间总数变化，请刷新');
  if(rows.length!==Math.min(limit,Math.max(0,total-offset)))throw rowFailure('记录分批读取窗口被截断');
  if(result.status==='ready')restoreCellFallbacks(rows,result.cellFallbacks);
  return {rows,total};
}
export function validateRecordRows(rows:Row[],fields:Record<string,FieldDefinition>):void{
  const contract=Object.fromEntries(Object.entries(fields).map(([id,field])=>[id,queryResultFieldContract(field)]));
  if(!validateContractRows(rows,contract).ok)throw rowFailure('记录结果违反字段契约');
}
export async function readRecordBatches(plan:PagedJoinPlan,id:string,query:EffectiveQuery,runner:QueryRunner,scope:string,budget:RecordBudget,domain=false):Promise<Row[]>{
  if(!intersectQueryFilters(query))return [];
  const rows:Row[]=[],limit=plan.source.source.records!.batchSize;
  let expected:number|undefined;
  do{
    budget.signal.throwIfAborted();
    const result=await runner.run({...query,pagination:{offset:rows.length,limit}},{pageId:plan.page.id,dataSourceIds:[plan.sourceId,plan.source.source.members[id].source]},scope,budget.signal);
    budget.signal.throwIfAborted();
    const batch=batchRows(result,rows.length,limit,expected);
    expected=batch.total;
    if(domain&&expected>budget.maxRows)throw recordLimit('记录关联超过行数预算，请缩小筛选范围');
    validateRecordRows(batch.rows,plan.members.get(id)!.fields);
    chargeRows(budget,batch.rows,domain);
    rows.push(...batch.rows);
  }while(rows.length<expected);
  return rows;
}
