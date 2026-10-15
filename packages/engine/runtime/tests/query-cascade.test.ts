import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import type { EffectiveQuery, DataRow } from '@metriccanvas/page/internal';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import { createFilterState } from '../src/filter-state';
import { prepareExportSnapshots } from '../src/export-snapshots';
import { applyComputation } from '../src/compute';
import type { DataGateway, DataGatewayResult } from '../src/ports';
import { resolveQueryResultInputs } from '../src/query-result-inputs';
const base = 'project-efficiency-bottom5', detail = `${base}-stages`;
const fixture = (): Page => {
  const result = parsePage(JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/query-cascade-page.json', import.meta.url), 'utf8')));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.page;
};
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const projects = (id = 'A'): DataRow[] => [{ 'commerce-id': id, 'customer-name':'customer', 'project-name':'project', 'decision-time':0 }];
const stages = (id = 'A'): DataRow[] => [
  {'commerce-id':id,'stage-name':'代表处SDT','decision-time':0,'decision-count':10},
  {'commerce-id':id,'stage-name':'地区部SDT','decision-time':null,'decision-count':2}
];
function harness(page = fixture()) {
  const calls: Array<{id:string;query:EffectiveQuery;signal?:AbortSignal;resolve(value:DataGatewayResult):void;reject(error:Error):void}> = [];
  const gateway: DataGateway = {fetchData(query, context, signal) {return new Promise((resolve,reject) => calls.push({id:context!.dataSourceIds![0],query,signal,resolve,reject}));}};
  const filters = createFilterState();
  let state: PageDataSnapshots = new Map();
  const stream = orchestrate(page,gateway,filters), stop=stream.subscribe(next=>state=next);
  return {calls,filters,stream,stop,state:()=>state};
}

describe('query cascade execution', () => {
  it('exports available content after an upstream failure without running its dependent query', async () => {
    const p=fixture(),calls:string[]=[];
    const result=await prepareExportSnapshots(p,{async fetchData(_query,context){calls.push(context!.dataSourceIds![0]);throw Object.assign(new Error('unavailable'),{code:'DQE_FORBIDDEN'});}},new Map(),new Map(),new AbortController().signal,undefined,2026,[],undefined,undefined,{allowPartial:true});
    expect(calls).toEqual([base]);
    expect(result.get(base)?.status).toBe('error');
    expect(result.get(detail)?.status).toBe('error');
  });
  it('waits for raw rows, sends a set once, pivots two measures and preserves the main order', async () => {
    const h=harness(); expect(h.calls.map(c=>c.id)).toEqual([base]);
    h.calls[0].resolve({rows:[...projects('B'),...projects('A')],totalCount:99}); await flush();
    expect(h.calls.map(c=>c.id)).toEqual([base,detail]);
    expect(h.calls[1].query.filterValues).toEqual([{target:'dimension',queryField:'商务编号',values:['A','B']}]);
    expect(h.state().get(base)?.status).toBe('loading');
    h.calls[1].resolve({rows:[...stages('A'),...stages('B')],totalCount:4}); await flush();
    expect(h.state().get(base)).toMatchObject({status:'ready',totalCount:99,rows:[
      {'commerce-id':'B','rep-office-time':0,'rep-office-count':10,'region-time':null,'region-count':2,'cloud-time':null},
      {'commerce-id':'A','rep-office-count':10}
    ]}); h.stop();
  });
  it('empty upstream does not execute an unfiltered detail request',async()=>{
    const h=harness();h.calls[0].resolve({rows:[],totalCount:0});await flush();
    expect(h.calls).toHaveLength(1);expect(h.state().get(detail)?.status).toBe('empty');h.stop();
  });
  it.each([null,'',' ',false,42,NaN,Infinity])('rejects invalid keys without submitting details: %s',async value=>{
    const h=harness();h.calls[0].resolve({rows:[{...projects()[0],'commerce-id':value}],totalCount:1});await flush();
    expect(h.calls).toHaveLength(1);expect(h.state().get(detail)?.status).toBe('error');h.stop();
  });
  it('propagates upstream failure without leaking rows or executing details',async()=>{
    const h=harness();h.calls[0].reject(new Error('SECRET_PROJECT'));await flush();
    expect(h.calls).toHaveLength(1);
    expect(h.state().get(detail)).toMatchObject({status:'error',error:{code:'UNKNOWN',message:'查询输入数据源失败'}});
    expect(JSON.stringify(h.state().get(detail))).not.toContain('SECRET_PROJECT');h.stop();
  });
  it('rejects a larger declared selection and never truncates its identifiers',async()=>{
    const h=harness();h.calls[0].resolve({rows:Array.from({length:6},(_,i)=>projects(String(i))[0]),totalCount:6});await flush();
    expect(h.calls).toHaveLength(1);expect(h.state().get(detail)?.status).toBe('error');h.stop();
  });
  it('does not dispatch waiting detail queries after disposal',async()=>{
    const h=harness();h.stop();expect(h.calls[0].signal?.aborted).toBe(true);
    h.calls[0].resolve({rows:projects(),totalCount:1});await flush();expect(h.calls).toHaveLength(1);
  });
  it('deduplicates typed keys without changing rows and detects maxValues overflow',()=>{
    const p=fixture(),sources=new Map(Object.entries(p.dataSources)),raw=new Map([[base,{status:'ready' as const,rows:[...projects('B'),...projects('A'),...projects('A')],totalCount:3}]]);
    expect(resolveQueryResultInputs(p.dataSources[detail],raw,sources)).toEqual({status:'ready',values:[{target:'dimension',queryField:'商务编号',values:['A','B']}]});
    const source=p.dataSources[detail].source;if(source.type!=='query')throw new Error('query');source.query.resultBindings![0].maxValues=1;
    expect(resolveQueryResultInputs(p.dataSources[detail],raw,sources).status).toBe('terminal');
  });
  it('resolves multiple inputs using AND, empty short-circuit and error precedence',()=>{
    const p=fixture();p.dataSources.other=structuredClone(p.dataSources[base]);
    const source=p.dataSources[detail].source;if(source.type!=='query')throw new Error('query');
    source.query.resultBindings!.push({...source.query.resultBindings![0],source:'other',queryField:'other-id'});
    const sources=new Map(Object.entries(p.dataSources));
    const raw=new Map<string,import('@metriccanvas/page/internal').DataSnapshot>([[base,{status:'ready',rows:projects(),totalCount:1}]]);
    expect(resolveQueryResultInputs(p.dataSources[detail],raw,sources)).toEqual({status:'waiting'});
    raw.set('other',{status:'ready',rows:projects('B'),totalCount:1});
    expect(resolveQueryResultInputs(p.dataSources[detail],raw,sources)).toMatchObject({status:'ready',values:[{values:['A']},{values:['B']}]});
    raw.set('other',{status:'empty',totalCount:0});expect(resolveQueryResultInputs(p.dataSources[detail],raw,sources)).toMatchObject({status:'terminal',snapshot:{status:'empty'}});
    raw.set(base,{status:'error',error:{code:'DQE_FIELD_MAPPING_ERROR',message:'PRIVATE'}});
    expect(resolveQueryResultInputs(p.dataSources[detail],raw,sources)).toMatchObject({status:'terminal',snapshot:{status:'error',error:{code:'DQE_FIELD_MAPPING_ERROR',message:'查询输入数据源失败'}}});
  });
  it('export cancellation prevents the dependent query even if main transport ignores abort',async()=>{
    const p=fixture(),h=harness(),queries=h.stream.captureQueries();h.stop();
    const controller=new AbortController(),ids:string[]=[];
    const gateway:DataGateway={async fetchData(_query,context){ids.push(context!.dataSourceIds![0]);controller.abort();return {rows:projects(),totalCount:1};}};
    await expect(prepareExportSnapshots(p,gateway,queries,new Map(),controller.signal)).rejects.toThrow();
    expect(ids).toEqual([base]);
  });
  it.each(['ready','error'])('invalidates downstream and discards an uncancellable old %s response',async outcome=>{
    const p=fixture();p.filters=[{id:'period',type:'dimension',dimension:'period'}];
    const source=p.dataSources[base].source;if(source.type!=='query')throw new Error('query');
    source.query.filterBindings={period:{target:'dimension',queryField:'period'}};
    const h=harness(p);h.calls[0].resolve({rows:projects('A'),totalCount:1});await flush();
    h.filters.write('period',{type:'dimension',dimension:'period',values:['new']});
    expect(h.calls[1].signal?.aborted).toBe(true);expect(h.state().get(detail)?.status).toBe('loading');
    h.calls[2].resolve({rows:projects('B'),totalCount:1});await flush();
    expect(h.calls[3].query.filterValues).toEqual([{target:'dimension',queryField:'商务编号',values:['B']}]);
    if(outcome==='ready')h.calls[1].resolve({rows:stages('A'),totalCount:2});else h.calls[1].reject(new Error('late failure'));
    await flush();expect(h.state().get(base)?.status).toBe('loading');
    h.calls[3].resolve({rows:stages('B'),totalCount:2});await flush();
    expect(h.state().get(base)).toMatchObject({status:'ready',rows:[{'commerce-id':'B','rep-office-count':10}]});h.stop();
  });
  it('keeps shared details alive for an unaffected cascade consumer',async()=>{
    const p=fixture(),otherMain=`${base}-copy`,otherDetail=`${detail}-copy`;
    p.dataSources[otherMain]=structuredClone(p.dataSources[base]);
    p.dataSources[otherDetail]=structuredClone(p.dataSources[detail]);
    const join=p.dataSources[otherMain].compute![0];if(join.op!=='joinAggregate')throw new Error('join');join.source=otherDetail;
    const q=p.dataSources[otherDetail].source;if(q.type!=='query')throw new Error('query');q.query.resultBindings![0].source=otherMain;
    const component=structuredClone(p.sections[0].components[0]);component.id='copy-table';component.data={main:otherMain};p.sections[0].components.push(component);
    p.filters=[{id:'period',type:'dimension',dimension:'period'}];
    const main=p.dataSources[base].source;if(main.type!=='query')throw new Error('query');main.query.filterBindings={period:{target:'dimension',queryField:'period'}};
    const h=harness(p);expect(h.calls).toHaveLength(1);h.calls[0].resolve({rows:projects('A'),totalCount:1});await flush();
    expect(h.calls).toHaveLength(2);h.filters.write('period',{type:'dimension',dimension:'period',values:['new']});
    expect(h.calls[1].signal?.aborted).toBe(false);
    h.calls[1].resolve({rows:stages('A'),totalCount:2});await flush();
    expect(h.state().get(base)?.status).toBe('loading');
    expect(h.state().get(otherMain)).toMatchObject({status:'ready',rows:[{'commerce-id':'A','rep-office-count':10}]});
    h.calls[2].resolve({rows:projects('B'),totalCount:1});await flush();h.calls[3].resolve({rows:stages('B'),totalCount:2});await flush();
    expect(h.state().get(base)).toMatchObject({status:'ready',rows:[{'commerce-id':'B'}]});h.stop();
  });
  it('uses a new detail cache key when the period changes but identifiers stay the same',async()=>{
    const p=fixture();p.filters=[{id:'period',type:'timeRange'}];
    for(const id of [base,detail]){const source=p.dataSources[id].source;if(source.type==='query')source.query.filterBindings={period:{target:'time'}};}
    const h=harness(p);h.calls[0].resolve({rows:projects(),totalCount:1});await flush();
    h.calls[1].resolve({rows:stages(),totalCount:2});await flush();
    h.filters.write('period',{type:'timeRange',from:'2026-10-01',to:'2026-10-31'});
    h.calls[2].resolve({rows:projects(),totalCount:1});await flush();
    expect(h.calls).toHaveLength(4);expect(h.calls[3].query).not.toEqual(h.calls[1].query);
    expect(h.calls[3].query.filterValues).toContainEqual({target:'dimension',queryField:'商务编号',values:['A']});h.stop();
  });
  it('rejects duplicate stage rows but retains detail rows when only totalCount disagrees',async()=>{
    const p=fixture();expect(()=>applyComputation(p.dataSources[detail].compute??[],[...stages(),...stages()])).toThrow('重复');
    const h=harness(p);h.calls[0].resolve({rows:projects(),totalCount:1});await flush();
    h.calls[1].resolve({rows:stages(),totalCount:3});await flush();expect(h.state().get(base)?.status).toBe('ready');h.stop();
  });
  it('uses supplied cascade initial without a proof envelope',()=>{
    const p=fixture();for(const id of [base,detail]){const source=p.dataSources[id].source;if(source.type==='query')source.initial={capturedAt:'2026-09-30T00:00:00Z',rows:[],totalCount:0};}
    const h=harness(p);expect(h.calls).toHaveLength(0);expect(h.state().get(base)?.status).toBe('empty');h.stop();
  });
  it('export binds its own fresh main rows and retains Top5 despite a larger total',async()=>{
    const p=fixture(),h=harness(p);
    const queries=h.stream.captureQueries();h.stop();
    const received:Array<{id:string;query:EffectiveQuery}>=[];
    const gateway:DataGateway={async fetchData(query,context){const id=context!.dataSourceIds![0];received.push({id,query});return id===base?{rows:projects('FRESH'),totalCount:99}:{rows:stages('FRESH'),totalCount:2};}};
    const result=await prepareExportSnapshots(p,gateway,queries,new Map(),new AbortController().signal);
    expect(received.map(c=>c.id)).toEqual([base,detail]);expect(received[0].query.pagination).toBeUndefined();
    expect(received[1].query.filterValues).toEqual([{target:'dimension',queryField:'商务编号',values:['FRESH']}]);
    expect(result.get(base)).toMatchObject({status:'ready',rows:[{'commerce-id':'FRESH','rep-office-count':10}]});
  });
});
