import { isPagedJoinQuery, hasQueryFieldMapping, restoreCellFallbacks, dqeDefaultSort, type EffectiveQuery, type DataSnapshot, type TableQueryView, type Row } from '@metriccanvas/page/internal';
import type { QueryRunner } from '../query-runner';
import type { PagedJoinPlan } from './plan';
import { memberQuery, restrictKeys } from './member-query';
import { memberRows, projectRows, ordinalRows, rowFailure } from './rows';
import { projectRecordRows } from './record-rows';
import { validateRecordRows } from './record-batches';
import { rawSnapshot } from '../snapshots';

function readyRows(snapshot:DataSnapshot):Row[]{
  if(snapshot.status==='error')throw Object.assign(new Error(snapshot.error.message),{code:snapshot.error.code});
  if(snapshot.status==='loading')throw rowFailure('查询分页尚未完成');
  if(snapshot.status==='ready')restoreCellFallbacks(snapshot.rows,snapshot.cellFallbacks);
  return snapshot.status==='ready'?snapshot.rows:[];
}

async function runPageQuery(plan:PagedJoinPlan,id:string,query:EffectiveQuery,runner:QueryRunner,scope:string,input?:AbortSignal){
  const timeout=plan.source.source.records&&AbortSignal.timeout(plan.source.source.records.timeoutMs);
  const signal=AbortSignal.any([...(input?[input]:[]),...(timeout?[timeout]:[])]);
  try{
    const result=await runner.run(query,{pageId:plan.page.id,dataSourceIds:[plan.source.source.members[id].source]},scope,signal);
    signal.throwIfAborted();return result;
  }catch(cause){
    input?.throwIfAborted();
    if(timeout&&timeout.aborted)throw Object.assign(new Error('记录分页单批查询超时'),{code:'DQE_TIMEOUT'});
    throw cause;
  }
}

function selectionQuery(plan:PagedJoinPlan,pageIndex:number){
  const query=memberQuery(plan,plan.selection!,pageIndex);
  if(!plan.view.sort.length&&!dqeDefaultSort(query.body.dsl_list[0]).length){
    const member=plan.source.source.members[plan.selection!];
    query.sort=[{queryField:member.key.queryField,direction:'asc'}];
  }
  return query;
}

async function selectPage(plan:PagedJoinPlan,runner:QueryRunner,scope:string,signal?:AbortSignal){
  const run=(index:number)=>runPageQuery(plan,plan.selection!,selectionQuery(plan,index),runner,scope,signal);
  let pageIndex=plan.view.pageIndex,snapshot=await run(pageIndex);
  readyRows(snapshot);
  if(snapshot.status==='ready'||snapshot.status==='empty'){
    const total=snapshot.totalCount;
    if(total!==undefined&&pageIndex>0&&pageIndex*plan.view.pageSize>=total){
      pageIndex=Math.max(0,Math.ceil(total/plan.view.pageSize)-1);snapshot=await run(pageIndex);
    }
  }
  const rows=readyRows(snapshot),total='totalCount' in snapshot?snapshot.totalCount:undefined;
  if(total===undefined||!Number.isSafeInteger(total)||total<0||rows.length!==Math.min(plan.view.pageSize,Math.max(0,total-pageIndex*plan.view.pageSize)))throw rowFailure('当前页没有完整窗口或准确总数');
  validateRecordRows(rows,plan.members.get(plan.selection!)!.fields);
  return {rows,total,pageIndex};
}

async function fillMember(plan:PagedJoinPlan,id:string,keys:(string|number)[],runner:QueryRunner,scope:string,signal?:AbortSignal){
  const pagination=plan.source.source.pagination;
  if(!('batchSize' in pagination))throw rowFailure('查询分页缺少补列批次');
  const index=new Map<string|number,Row>();
  for(let offset=0;offset<keys.length;offset+=pagination.batchSize){
    const query=memberQuery(plan,id),member=plan.source.source.members[id];
    const allowed=restrictKeys(query,member.key.queryField,keys.slice(offset,offset+pagination.batchSize));
    if(!allowed.length)continue;
    query.pagination={offset:0,limit:pagination.batchSize};
    const snapshot=await runPageQuery(plan,id,query,runner,scope,signal);
    const rows=memberRows(plan,id,snapshot,allowed);
    for(const [key,row] of rows){
      if(index.has(key))throw rowFailure('补列成员返回重复关联键');
      index.set(key,row);
    }
  }
  return index;
}

function selectedKeys(plan:PagedJoinPlan,rows:Row[]):(string|number)[]{
  const member=plan.source.source.members[plan.selection!],field=plan.members.get(plan.selection!)!.fields[member.key.field];
  if(!hasQueryFieldMapping(field))throw rowFailure('关联字段缺少查询映射');
  const keys=rows.map(row=>row[member.key.field]);
  if(keys.some(key=>!(typeof key==='number'&&Number.isFinite(key)||typeof key==='string'&&key.trim())))throw rowFailure('当前页存在无效关联键');
  return [...new Set(keys)] as (string|number)[];
}

/** Never reads the next business page or the complete record population. */
export async function executeQueryPagedJoin(plan:PagedJoinPlan,runner:QueryRunner,scope:string,signal?:AbortSignal):Promise<{snapshot:DataSnapshot;viewCorrection?:TableQueryView}>{
  signal?.throwIfAborted();
  if(!isPagedJoinQuery(plan.source.source)||!plan.selection)throw rowFailure('查询分页计划无效');
  const selected=await selectPage(plan,runner,scope,signal),keys=selectedKeys(plan,selected.rows);
  const members=new Map<string,Map<string|number,Row>>();
  if(!plan.source.source.records)members.set(plan.selection,memberRows(plan,plan.selection,rawSnapshot(selected.rows,selected.rows.length)));
  for(const id of plan.members.keys())if(id!==plan.selection)members.set(id,await fillMember(plan,id,keys,runner,scope,signal));
  signal?.throwIfAborted();
  const rows=plan.source.source.records?projectRecordRows(plan,selected.rows,members):projectRows(plan,keys,members);
  enforcePageBudget(plan,rows);
  return {snapshot:rawSnapshot(ordinalRows(plan,rows,selected.pageIndex*plan.view.pageSize),selected.total),
    ...(selected.pageIndex===plan.view.pageIndex?{}:{viewCorrection:{...plan.view,pageIndex:selected.pageIndex}})};
}

function enforcePageBudget(plan:PagedJoinPlan,rows:Row[]):void{
  const budget=plan.source.source.records;
  if(budget&&new TextEncoder().encode(JSON.stringify(rows)).byteLength>budget.maxBytes)throw Object.assign(new Error('当前页关联超过字节预算'),{code:'DQE_QUERY_REJECTED'});
}
