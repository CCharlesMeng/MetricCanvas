import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {EffectiveQuery,Row} from '@metriccanvas/page/internal';
import {createFilterState,initialFilterValues} from '../src/filter-state';
import {orchestrate,type PageDataSnapshots} from '../src/orchestrator';
import type {DataGateway} from '../src/ports';

function isTrend(query:EffectiveQuery):boolean {const dims=query.body.dsl_list[0].output_dims;return Array.isArray(dims)&&dims.length>0;}

it('switching the actual query branch cancels old requests and ignores late replies',async()=>{
  const parsed=parsePage(JSON.parse(readFileSync('pages/capabilities/filters/query-mode-chart-demo.json','utf8')));if(!parsed.ok)throw Error('page');
  const page=parsed.page,filters=createFilterState(initialFilterValues(page.filters??[]));
  const calls:Array<{query:EffectiveQuery;signal?:AbortSignal;resolve:(value:{rows:Row[];totalCount:number})=>void}>=[];
  const gateway:DataGateway={fetchData(query,_diagnostics,signal){return new Promise(resolve=>calls.push({query,signal,resolve}));}};
  const snapshots:PageDataSnapshots[]=[];
  const unsubscribe=orchestrate(page,gateway,filters).subscribe(value=>snapshots.push(value));
  try{
    await vi.waitFor(()=>expect(calls).toHaveLength(2));
    filters.write('business',{type:'dimension',dimension:'business_mode',values:['opportunities']});
    await vi.waitFor(()=>expect(calls).toHaveLength(4));expect(calls.slice(0,2).every(call=>call.signal?.aborted)).toBe(true);
    for(const call of calls.slice(2))call.resolve({rows:isTrend(call.query)?[{month:'2026-01',amount:330000}]:[{amount:2430000}],totalCount:1});
    await vi.waitFor(()=>expect(snapshots.at(-1)?.get('amount-total')).toMatchObject({status:'ready',rows:[{amount:2430000}]}));
    for(const call of calls.slice(0,2))call.resolve({rows:isTrend(call.query)?[{month:'2026-01',amount:110000}]:[{amount:810000}],totalCount:1});
    await new Promise(resolve=>setTimeout(resolve,0));expect(snapshots.at(-1)?.get('amount-total')).toMatchObject({status:'ready',rows:[{amount:2430000}]});
    expect(snapshots.at(-1)?.get('amount-trend')).toMatchObject({status:'ready',rows:[{month:'2026-01',amount:330000}]});
  }finally{unsubscribe();}
});
