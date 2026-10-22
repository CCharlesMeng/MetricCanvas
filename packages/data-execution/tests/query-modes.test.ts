import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {createSourceProgram} from '../src/source-program/session';
import {initialFilterValues} from '../src/filter-values';
import type {EffectiveQuery} from '@metriccanvas/page/internal';
const load=()=>{const result=parsePage(JSON.parse(readFileSync('pages/capabilities/filters/query-mode-chart-demo.json','utf8')));if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;};
async function collect(program:ReturnType<typeof createSourceProgram>,request:Parameters<ReturnType<typeof createSourceProgram>['read']>[0]){const updates=[];for await(const update of program.read(request))updates.push(update);return updates;}
const gateway=()=>({fetchData:vi.fn(async(query:EffectiveQuery)=>({rows:[{month:'2026-01',amount:JSON.stringify(query.body).includes('商机金额')?330000:110000}],totalCount:1}))});

describe('query mode source execution',()=>{
  it('switches complete bodies and table-specific region bindings, caching each effective request separately',async()=>{
    const page=load(),values=initialFilterValues(page.filters??[]),port=gateway(),program=createSourceProgram(page,{gateway:port});
    const read=()=>collect(program,{roots:['amount-trend'],conditions:values});
    expect((await read()).at(-1)?.snapshot).toMatchObject({rows:[{amount:110000}]});
    values.set('business',{type:'dimension',dimension:'business_mode',values:['opportunities']});expect((await read()).at(-1)?.snapshot).toMatchObject({rows:[{amount:330000}]});
    expect(port.fetchData.mock.calls[1][0]).toMatchObject({filterValues:[{queryField:'商机区域',values:['east']}]});
    values.set('region',{type:'dimension',dimension:'business_region',values:['south']});await read();expect(port.fetchData.mock.calls[2][0]).toMatchObject({filterValues:[{queryField:'商机区域',values:['south']}]});
    values.set('business',{type:'dimension',dimension:'business_mode',values:['contracts']});values.set('region',{type:'dimension',dimension:'business_region',values:['east']});await read();expect(port.fetchData).toHaveBeenCalledTimes(3);program.dispose();
  });
  it('does not reuse unproved initial rows or seeds for a branch',async()=>{
    const page=load(),source=page.dataSources['amount-trend'].source;if(source.type!=='query')throw Error('query');source.initial={capturedAt:'2026-10-22T00:00:00Z',rows:[{'月份':'old','金额':999}]};
    const values=initialFilterValues(page.filters??[]),port=gateway(),program=createSourceProgram(page,{gateway:port});
    expect(program.initialSnapshots({roots:['amount-trend'],conditions:values}).get('amount-trend')).toEqual({status:'loading'});
    await collect(program,{roots:['amount-trend'],conditions:values,useInitial:true,seeds:new Map([['amount-trend',{status:'ready',rows:[{month:'old',amount:999}]}]])});expect(port.fetchData).toHaveBeenCalledOnce();program.dispose();
  });
  it('rejects captured requests from another branch and exports only the frozen current branch',async()=>{
    const page=load(),values=initialFilterValues(page.filters??[]),port=gateway(),program=createSourceProgram(page,{gateway:port});
    const old=program.captureQueries(values,new Map(),new Map());values.set('business',{type:'dimension',dimension:'business_mode',values:['opportunities']});
    await expect(collect(program,{roots:['amount-trend'],conditions:values,queries:old})).rejects.toMatchObject({code:'DQE_QUERY_REJECTED'});expect(port.fetchData).not.toHaveBeenCalled();
    const frozen=program.captureQueries(values,new Map(),new Map());await collect(program,{roots:['amount-trend'],conditions:values,queries:frozen,purpose:'complete'});
    expect(port.fetchData.mock.calls[0][0].body.dsl_list[0].output_metrics).toEqual([{name:'商机金额',alias:'金额'}]);program.dispose();
  });
  it('blocks an illegal selection before any business request',async()=>{
    const page=load(),port=gateway(),program=createSourceProgram(page,{gateway:port}),values=initialFilterValues(page.filters??[]);values.set('business',{type:'dimension',dimension:'business_mode',values:['unknown']});
    const updates=await collect(program,{roots:['amount-trend'],conditions:values});expect(updates[0]).toMatchObject({candidateRejected:true,snapshot:{status:'error'}});expect(port.fetchData).not.toHaveBeenCalled();program.dispose();
  });
  it('keeps a failed selected branch in error without requesting the other table',async()=>{
    const page=load(),values=initialFilterValues(page.filters??[]);values.set('business',{type:'dimension',dimension:'business_mode',values:['opportunities']});
    const fetchData=vi.fn(async()=>{throw Object.assign(new Error('upstream unavailable'),{code:'DQE_UPSTREAM_ERROR'});});
    const program=createSourceProgram(page,{gateway:{fetchData}});
    const updates=await collect(program,{roots:['amount-trend'],conditions:values});expect(updates.at(-1)?.snapshot).toMatchObject({status:'error'});expect(fetchData).toHaveBeenCalledOnce();program.dispose();
  });
  it('validates only the active branch inputs while retaining static invalidation dependencies',async()=>{
    const page=load(),source=page.dataSources['amount-trend'].source;if(source.type!=='query')throw Error('query');
    source.query.queryModes!.cases.contracts.filterBindings['contract-only']={target:'dimension',queryField:'签约专属条件'};
    page.filters!.push({id:'contract-only',type:'dimension',dimension:'contract_only',visible:false,default:['pending'],candidateContext:{filterIds:[],reconcile:'clear'}});
    const values=initialFilterValues(page.filters??[]);values.set('business',{type:'dimension',dimension:'business_mode',values:['opportunities']});
    const port=gateway(),program=createSourceProgram(page,{gateway:port});
    expect((await collect(program,{roots:['amount-trend'],conditions:values})).at(-1)?.snapshot).toMatchObject({status:'ready'});expect(port.fetchData).toHaveBeenCalledOnce();
    values.set('business',{type:'dimension',dimension:'business_mode',values:['contracts']});
    expect((await collect(program,{roots:['amount-trend'],conditions:values})).at(-1)).toMatchObject({candidateRejected:true,snapshot:{status:'error'}});expect(port.fetchData).toHaveBeenCalledOnce();program.dispose();
  });
});
