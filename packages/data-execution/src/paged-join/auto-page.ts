import type {Row} from '@metriccanvas/page/internal';
import type {PagedJoinPlan} from './plan';
import type {QueryRunner} from '../query-runner';
import type {ScreenProgressSink} from '../screen-progress';
import {rawSnapshot} from '../snapshots';
import {selectPage,selectedKeys} from './query-page';
import {supplementRows} from './records-reader';
import {chargeRows,type RecordBudget} from './record-batches';
import {projectRecordRows} from './record-rows';
import {createJoinProgress} from './progress';
import {ordinalRows} from './rows';

/** A complete domain window is authoritative; supplements never change its rows or total. */
export async function executeAutoPage(plan:PagedJoinPlan,runner:QueryRunner,scope:string,inputSignal?:AbortSignal,progress?:ScreenProgressSink){
  const signal=inputSignal??new AbortController().signal;
  const budget:RecordBudget={rows:0,bytes:0,maxBytes:plan.source.source.records!.maxBytes,signal};
  const selected=await selectPage(plan,runner,scope,signal),keys=selectedKeys(plan,selected.rows);
  chargeRows(budget,selected.rows,true);
  const rowKeys=selected.rows.map(row=>row[plan.source.source.members[plan.selection!].key.field] as string|number);
  const state=createJoinProgress(plan,{...selected,keys:rowKeys},progress&&(value=>{
    chargeRows({...budget},value.snapshot.rows,false);progress(value);
  }));
  state.accept(plan.selection!,new Map(selected.rows.map((row,index)=>[rowKeys[index],row])),keys);
  const members=new Map<string,Map<string|number,Row>>();
  await Promise.all([...plan.members.keys()].filter(id=>id!==plan.selection).map(async id=>{
    try{members.set(id,await supplementRows(plan,id,keys,runner,scope,budget,(rows,done)=>{
      signal.throwIfAborted();state.accept(id,rows,done);
    }));}
    catch(cause){signal.throwIfAborted();state.fail(id,cause);}
  }));
  signal.throwIfAborted();state.finish();
  const offset=selected.pageIndex*plan.view.pageSize,rows=projectRecordRows(plan,selected.rows,members,offset);
  chargeRows(budget,rows,false);
  return {snapshot:rawSnapshot(ordinalRows(plan,rows,offset),selected.total),
    ...(selected.pageIndex===plan.view.pageIndex?{}:{viewCorrection:{...plan.view,pageIndex:selected.pageIndex}})};
}
