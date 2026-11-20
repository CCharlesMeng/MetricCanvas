import { expect,it,vi } from 'vitest';
import { createQueryRunner } from '../src/query-runner';
import type { ColumnCandidateProgress, ColumnCandidatesPage } from '../src/ports';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
const query=(id=1):EffectiveQuery=>({language:'dqe',body:{dsl_list:[{id}]},fieldMappings:{},filterValues:[]});
it('dispatches all fifteen independent foreground reads without waiting for a slot by default',async()=>{
 const calls:Array<{resolve:(result:{rows:[];totalCount:0})=>void}>=[];
 const runner=createQueryRunner({gateway:{fetchData(){return new Promise(resolve=>calls.push({resolve}));}}});
 try {
  const work=Array.from({length:15},(_,id)=>runner.run(query(id),{},'session'));
  expect(calls).toHaveLength(15);
  calls[14].resolve({rows:[],totalCount:0});
  expect(await work[14]).toMatchObject({status:'empty'});
  for(const call of calls)call.resolve({rows:[],totalCount:0});
  await Promise.all(work);
 } finally {runner.dispose();}
});
it('shares identical requests; cancellation detaches one consumer and aborts only the last',async()=>{
 const calls:Array<{signal?:AbortSignal;resolve:(result:{rows:[];totalCount:0})=>void}>=[];
 const runner=createQueryRunner({gateway:{fetchData(_q,_d,signal){return new Promise(resolve=>calls.push({signal,resolve}));}}});
 const a=new AbortController(),b=new AbortController();
 const first=runner.run(query(),{},'session',a.signal),second=runner.run(query(),{},'session',b.signal);
 expect(calls).toHaveLength(1);a.abort();expect((await first).status).toBe('error');expect(calls[0].signal?.aborted).toBe(false);
 calls[0].resolve({rows:[],totalCount:0});expect((await second).status).toBe('empty');
 await runner.run(query(),{},'session');expect(calls).toHaveLength(1);
 const fresh=runner.run(query(),{},'fresh',b.signal);expect(calls).toHaveLength(2);b.abort();expect(calls[1].signal?.aborted).toBe(true);expect((await fresh).status).toBe('error');runner.dispose();
});
it('caps global concurrency and removes cancelled queued consumers',async()=>{
 const calls:Array<{resolve:(result:{rows:[];totalCount:0})=>void}>=[];
 const runner=createQueryRunner({maxConcurrent:5,gateway:{fetchData(){return new Promise(resolve=>calls.push({resolve}));}}});
 const queued=new AbortController();
 const work=Array.from({length:7},(_,id)=>runner.run(query(id),{},'session',id===5?queued.signal:undefined));
 expect(calls).toHaveLength(5);queued.abort();expect((await work[5]).status).toBe('error');
 calls[0].resolve({rows:[],totalCount:0});await new Promise(resolve=>setTimeout(resolve,0));expect(calls).toHaveLength(6);
 runner.dispose();await Promise.all(work);
});

it('normalizes typed dimension sets for request identity without changing ordered query semantics',async()=>{
 let calls=0,resolve:(value:{rows:[];totalCount:0})=>void=()=>{};const runner=createQueryRunner({gateway:{fetchData(){calls++;return new Promise(done=>resolve=done);}}});
 const first={...query(),filterValues:[{target:'dimension' as const,queryField:'code',values:['B','A']}]};
 const second={...query(),filterValues:[{target:'dimension' as const,queryField:'code',values:['A','B']}]};
 const a=runner.run(first,{},'session'),b=runner.run(second,{},'session');expect(calls).toBe(1);resolve({rows:[],totalCount:0});await Promise.all([a,b]);runner.dispose();
});

it('replays candidate progress to a late consumer, detaches cancelled observers and caches only the final page', async () => {
 const candidate = {query: query(),field:'name',queryField:'name',search:'',offset:0,limit:1};
 let publish: ColumnCandidateProgress | undefined;
 let finish!: (page: ColumnCandidatesPage) => void;
 const fetchColumnCandidates = vi.fn((_request, _diagnostics, _signal, progress?: ColumnCandidateProgress) => {
  publish = progress;
  return new Promise<ColumnCandidatesPage>(resolve => { finish = resolve; });
 });
 const runner = createQueryRunner({gateway:{async fetchData(){return {rows:[]};},fetchColumnCandidates}});
 const controller = new AbortController();
 const early = vi.fn(), late = vi.fn();
 const initial = runner.runCandidates(candidate,{},'scope',controller.signal,true,early);
 const cancelled = expect(initial).rejects.toMatchObject({code:'DQE_CANCELLED'});
 const a = {value:'A',label:'A'}, b = {value:'B',label:'B'};
 publish!([b]);
 const joined = runner.runCandidates(candidate,{},'scope',undefined,false,late);
 expect(late).toHaveBeenLastCalledWith([b]);
 controller.abort();
 await cancelled;
 publish!([b,a]);
 expect(early).toHaveBeenCalledTimes(1);
 expect(late).toHaveBeenLastCalledWith([b,a]);
 const result = {kind:'values' as const,candidates:[a],totalCount:2};
 finish(result);
 expect(await joined).toEqual(result);
 const cached = vi.fn();
 expect(await runner.runCandidates(candidate,{},'scope',undefined,false,cached)).toEqual(result);
 expect(cached).not.toHaveBeenCalled();
 expect(fetchColumnCandidates).toHaveBeenCalledTimes(1);
 runner.dispose();
});
