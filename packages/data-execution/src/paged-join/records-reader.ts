import {canonicalizeJson,type Row,type TableQueryView} from '@metriccanvas/page/internal';
import {evaluateTableView} from '../table-view';
import {rawSnapshot} from '../snapshots';
import {SourceRangeError,EXPORT_MAX_ROWS} from '../source-program/range-policy';
import type {QueryRunner} from '../query-runner';
import type {PagedJoinPlan} from './plan';
import {memberQuery,restrictKeys} from './member-query';
import {ordinalRows,rowFailure} from './rows';
import {memberFailure,memberKey} from './member-diagnostics';
import {chargeRows,readRecordBatches,type RecordBudget} from './record-batches';
import {recordReadOrder,projectRecordRows,filterRecordTimes} from './record-rows';
const readers=new WeakMap<QueryRunner,ReturnType<typeof createRecordReader>>();
export function recordJoinReader(runner:QueryRunner){
  let reader=readers.get(runner);
  if(!reader){reader=createRecordReader(runner);readers.set(runner,reader);}
  return reader;
}
export function clearRecordJoinCache(runner:QueryRunner):void{readers.get(runner)?.clear();}
function createRecordReader(runner:QueryRunner){
  const cache=new Map<string,Row[]>();
  let revision=0,serial=0;
  return {
    clear(){revision++;cache.clear();},
    async read(plan:PagedJoinPlan,scope:string,inputSignal?:AbortSignal,complete=false,exportLimit=false){
      const config=plan.source.source.records!,generation=revision;
      const signal=AbortSignal.any([...(inputSignal?[inputSignal]:[]),AbortSignal.timeout(config.timeoutMs)]);
      const key=canonicalizeJson([scope,plan.page.id,plan.sourceId,plan.source,[...plan.conditions].sort(([a],[b])=>a.localeCompare(b)),[...plan.members.keys()].map(id=>memberQuery(plan,id))]);
      let rows=cache.get(key);
      try{
        if(!rows){
          const operationScope=`${scope}:record:${++serial}`;
          try{rows=await collectRecords(plan,runner,operationScope,signal);}
          finally{runner.forgetScope(operationScope);}
          signal.throwIfAborted();
          if(generation===revision){cache.clear();cache.set(key,rows);}
        }
        signal.throwIfAborted();
        return recordView(plan,rows,complete,exportLimit);
      }catch(cause){
        if(signal.aborted)throw Object.assign(new Error('记录关联读取已取消或超时'),{code:signal.reason?.name==='TimeoutError'?'DQE_TIMEOUT':'DQE_CANCELLED'});
        throw cause;
      }
    }
  };
}
async function collectRecords(plan:PagedJoinPlan,runner:QueryRunner,scope:string,signal:AbortSignal):Promise<Row[]>{
  const source=plan.source.source,config=source.records!,domainId=source.domainMember;
  const budget:RecordBudget={rows:0,bytes:0,maxRows:config.maxRows,maxBytes:config.maxBytes,signal};
  const rawDomain=await readRecordBatches(plan,domainId,recordReadOrder(plan,domainId,memberQuery(plan,domainId)),runner,scope,budget,true);
  const domain=filterRecordTimes(plan,rawDomain,true);
  const keys=[...new Set(domain.map((row,index)=>memberKey(plan,domainId,row,index)))];
  const members=new Map<string,Map<string|number,Row>>();
  for(const id of plan.members.keys()){
    if(id===domainId)continue;
    members.set(id,await supplementRows(plan,id,keys,runner,scope,budget));
  }
  signal.throwIfAborted();
  const projected=projectRecordRows(plan,domain,members);
  chargeRows(budget,projected,false);
  return projected;
}
async function supplementRows(plan:PagedJoinPlan,id:string,keys:(string|number)[],runner:QueryRunner,scope:string,budget:RecordBudget):Promise<Map<string|number,Row>>{
  const index=new Map<string|number,Row>(),size=plan.source.source.records!.batchSize;
  for(let offset=0;offset<keys.length;offset+=size){
    const query=memberQuery(plan,id),member=plan.source.source.members[id];
    const allowed=restrictKeys(query,member.key.queryField,keys.slice(offset,offset+size));
    if(!allowed.length)continue;
    const rows=await readRecordBatches(plan,id,recordReadOrder(plan,id,query),runner,scope,budget);
    for(const [rowIndex,row] of rows.entries()){
      const key=memberKey(plan,id,row,rowIndex);
      if(!allowed.includes(key))throw memberFailure(plan,id,rowFailure(`补充查询第 ${rowIndex+1} 行的关联编号不在本次查询范围内。请检查编号筛选是否生效。`));
      if(index.has(key))throw memberFailure(plan,id,rowFailure(`补充查询第 ${rowIndex+1} 行的关联编号重复，无法确定该使用哪条记录。请检查是否每个编号只返回一条记录。`));
      index.set(key,row);
    }
  }
  return index;
}
function recordView(plan:PagedJoinPlan,rows:Row[],complete:boolean,exportLimit:boolean):{snapshot:ReturnType<typeof rawSnapshot>;viewCorrection?:TableQueryView}{
  const sort=[...plan.view.sort];
  if(!sort.some(rule=>rule.field===plan.source.source.rowKey))sort.push({field:plan.source.source.rowKey,direction:'asc'});
  const result=evaluateTableView(rows,{...plan.view,sort},complete);
  if(exportLimit&&result.totalCount>EXPORT_MAX_ROWS)throw new SourceRangeError('EXPORT_ROW_LIMIT','导出单表超过 10000 行');
  return {snapshot:rawSnapshot(ordinalRows(plan,result.rows,complete?0:result.pageIndex*plan.view.pageSize),result.totalCount),
    ...(result.pageIndex===plan.view.pageIndex?{}:{viewCorrection:{...plan.view,pageIndex:result.pageIndex}})};
}
