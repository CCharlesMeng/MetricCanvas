import { expect,it } from 'vitest';
import { createQueryRunner } from '../src/query-runner';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
const query=(id=1):EffectiveQuery=>({language:'dqe',body:{dsl_list:[{id}]},fieldMappings:{},filterValues:[]});
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
