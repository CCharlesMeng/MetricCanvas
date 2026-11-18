import { pageFilesById } from '../../../tools/scripts/page-files.mjs';
import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {createPageDataExecutor} from '../src/execute';
import {parsePage} from '@metriccanvas/page';
import {initialFilterValues} from '../src/filter-values';
import {createSourceProgram} from '../src/source-program/session';
import {composeEffectiveQuery} from '../src/effective-query';
import {createCandidateGatewaySession} from '../src/candidate-session';
import type {RuntimeDataGateway} from '../src/ports';

it('evicts the least recently used receipt before exceeding the candidate count budget', async () => {
  const candidates = Array.from({ length: 5000 }, (_, index) => ({ value: String(index), label: String(index) }));
  const fetchFilterCandidates = vi.fn(async () => ({ kind: 'values' as const, candidates }));
  const session = createCandidateGatewaySession({ fetchData: async () => ({ rows: [] }), fetchFilterCandidates });
  const load = (dimension: string) => session.gateway.fetchFilterCandidates!(
    { filterId: 'f', dimension, constraints: { dimensions: {}, times: {} } },
    { signal: new AbortController().signal }
  );

  for (const dimension of ['a', 'b', 'c', 'd', 'e', 'f']) await load(dimension);
  await load('a');
  await load('g');
  await load('a');
  expect(fetchFilterCandidates).toHaveBeenCalledTimes(7);
  await load('b');
  expect(fetchFilterCandidates).toHaveBeenCalledTimes(8);
  session.dispose();
});
const load=(kind:string)=>{const result=parsePage(JSON.parse(readFileSync(pageFilesById('pages').get(`ioc-header-business-${kind}-demo`)!,'utf8')));if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;};
describe('B2 complete execution boundary',()=>{
  it('all-unrestricted omits only the dynamic enum predicate and capture/read share it',async()=>{
    const page=load('options'),values=initialFilterValues(page.filters??[]),source=page.dataSources.bound;if(source.source.type!=='query')throw Error();
    source.source.query.body!.dsl_list[0].filter={dims:[{dim_name:'breakthrough',dim_value_list:['STATIC']}]};
    const query=composeEffectiveQuery({page,dataSource:{...source,source:{...source.source,type:'query'}},filters:page.filters},values,0,[],{});
    expect(query.filterValues.some(v=>v.target==='dimension'&&v.queryField==='breakthrough')).toBe(false);expect(values.get('breakthrough')).toMatchObject({values:['1','0']});expect(query.body!.dsl_list[0].filter).toMatchObject({dims:[{dim_name:'breakthrough',dim_value_list:['STATIC']}]});
    const seen:any[]=[];const program=createSourceProgram(page,{gateway:{async fetchData(query){seen.push(query);return {rows:[],totalCount:0};}}});
    const captured=program.captureQueries(values,new Map(),new Map());expect(captured.get('bound')?.filterValues).toEqual(query.filterValues);
    for await(const _ of program.read({roots:['bound'],conditions:values,queries:captured})){}
    expect(seen).toHaveLength(1);expect(seen[0].filterValues).toEqual(query.filterValues);program.dispose();
  });
  it('required/enum validation also precedes raw seed and initial reuse',async()=>{
    const page=load('options'),conditions=initialFilterValues(page.filters??[]);conditions.delete('kind');
    const fetchData=vi.fn(async()=>({rows:[],totalCount:0}));const program=createSourceProgram(page,{gateway:{fetchData}});
    expect(program.initialSnapshots({roots:['bound'],conditions}).get('bound')).toEqual({status:'loading'});
    const updates=[];for await(const item of program.read({roots:['bound'],conditions,seeds:new Map([['bound',{status:'ready',rows:[{scope:'STALE',count:1}]}]]),useInitial:true}))updates.push(item);
    expect(fetchData).not.toHaveBeenCalled();expect(updates.at(-1)?.snapshot).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}});program.dispose();
  });
  it.each(['missing','denied','unconfigured','invalid'])( 'blocks a dynamic root with %s candidates and still reads its independent source',async(kind)=>{
    const page=load('tree'),conditions=initialFilterValues(page.filters??[]),queries:any[]=[];
    const gateway:RuntimeDataGateway={async fetchData(query){queries.push(query);return {rows:[],totalCount:0};}};
    if(kind!=='missing')gateway.fetchFilterCandidates=async()=>kind==='invalid'?{kind:'values',candidates:[{value:'unauthorized',label:'no'}]}:{kind:kind as 'denied'|'unconfigured'};
    const program=createSourceProgram(page,{gateway});expect(program.initialSnapshots({roots:['bound'],conditions}).get('bound')).toEqual({status:'loading'});
    const updates=[];for await(const item of program.read({roots:['bound','unbound'],conditions,seeds:new Map([['bound',{status:'ready',rows:[{scope:'STALE',count:1}]}]])}))updates.push(item);
    expect(updates.find(item=>item.sourceId==='bound')?.snapshot.status).toBe('error');expect(updates.find(item=>item.sourceId==='unbound')?.snapshot.status).toBe('empty');expect(queries).toHaveLength(1);expect(queries[0].filterValues).toEqual([]);program.dispose();
  });
  it.each(['real','ghost'])('checks legacy candidates for a selected dynamic ancestor: %s',async(value)=>{
    const page=load('tree');page.filters!.push({id:'ancestor',type:'dimension',dimension:'ancestor',default:[value]});
    const model=page.filters!.find(f=>f.id==='model');if(model?.type!=='dimension')throw Error();model.candidateContext!.filterIds.push('ancestor');
    const fetchData=vi.fn(async()=>({rows:[],totalCount:0}));
    const fetchDimensionValues=vi.fn(async()=>({kind:'values' as const,candidates:[{value:'real',label:'Real'}]}));
    const gateway:RuntimeDataGateway={fetchData,fetchDimensionValues,async fetchFilterCandidates(request){return request.filterId==='region'?{kind:'values',candidates:[{value:'same',label:'Dept',level:'department'}]}:{kind:'values',candidates:[{value:'A',label:'A'},{value:'B',label:'B'}]};}};
    const program=createSourceProgram(page,{gateway}),updates=[];
    for await(const item of program.read({roots:['bound'],conditions:initialFilterValues(page.filters??[])}))updates.push(item);
    expect(fetchDimensionValues).toHaveBeenCalledTimes(1);expect(fetchData).toHaveBeenCalledTimes(value==='real'?1:0);expect(updates.at(-1)?.snapshot.status).toBe(value==='real'?'empty':'error');program.dispose();
  });
  it('rejects a structural receipt with no effective candidates at the requested level',async()=>{
    const page=load('tree'),conditions=initialFilterValues(page.filters??[]);conditions.set('region',{type:'dimension',dimension:'office',level:'office',values:[]});
    const fetchData=vi.fn(async()=>({rows:[]}));const program=createSourceProgram(page,{gateway:{fetchData,async fetchFilterCandidates(){return {kind:'values',candidates:[{value:'same',label:'Parent only',level:'department'}]};}}});
    const updates=[];for await(const item of program.read({roots:['bound'],conditions}))updates.push(item);
    expect(fetchData).not.toHaveBeenCalled();expect(updates.at(-1)?.snapshot.status).toBe('error');program.dispose();
  });
  it.each(['real','ghost'])('checks a new selection-only dynamic filter through the legacy port: %s',async(value)=>{
    const page=load('options'),filter=page.filters!.find(f=>f.id==='kind');if(filter?.type!=='dimension')throw Error();delete filter.options;filter.default=[value];
    const fetchData=vi.fn(async()=>({rows:[]})),fetchDimensionValues=vi.fn(async()=>({kind:'values' as const,candidates:[{value:'real',label:'Real'}]}));
    const program=createSourceProgram(page,{gateway:{fetchData,fetchDimensionValues}});for await(const _ of program.read({roots:['bound'],conditions:initialFilterValues(page.filters??[])})){}
    expect(fetchDimensionValues).toHaveBeenCalledOnce();expect(fetchData).toHaveBeenCalledTimes(value==='real'?1:0);program.dispose();
  });
  it('a B2 page enum and an independent closed filter group share a query without requiring a candidate port',async()=>{
    const doc=JSON.parse(readFileSync('pages/capabilities/chart/chart-local-filter-page.json','utf8'));doc.filters.push({id:'kind',type:'dimension',dimension:'kind',selection:{mode:'single'},options:[{value:'A',label:'A'}],default:['A']});
    doc.dataSources['orders-data'].source.query.filterBindings.kind={target:'dimension',queryField:'kind_code'};
    const parsed=parsePage(doc);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
    const fetchData=vi.fn(async()=>({rows:[]}));const program=createSourceProgram(parsed.page,{gateway:{fetchData}}),updates=[];
    for await(const item of program.read({roots:['orders-data'],conditions:initialFilterValues(parsed.page.filters??[])}))updates.push(item);
    expect(fetchData).toHaveBeenCalledOnce();expect(updates.at(-1)?.snapshot.status).toBe('empty');program.dispose();
  });
  it.each(['denied','network'])('one-shot removes stale initial when B2 candidates are %s',async(kind)=>{
    const page=JSON.parse(readFileSync('pages/capabilities/ioc-header/scenarios/ioc-header-business-tree-demo.json','utf8'));page.dataSources.bound.source.initial={totalCount:1,capturedAt:'2026-10-19T00:00:00Z',rows:[{ioc_header_scope:'STALE',ioc_header_count:1,department_code:null,office_code:null,model_code:null,legacy_path:null}]};
    const fetchData=vi.fn(async()=>({rows:[]}));
    const result=await createPageDataExecutor({gateway:{fetchData,async fetchFilterCandidates(){if(kind==='network')throw Object.assign(new Error('upstream private details'),{code:'DQE_NETWORK_ERROR'});return {kind:'denied'};}}}).execute(page);
    expect(result.dataSources.bound.source).not.toHaveProperty('initial');expect(fetchData).toHaveBeenCalledOnce();
  });
  it('an instance receipt session reuses complete UI receipts and a forced reload cannot resurrect an old response',async()=>{
    const calls:Array<(value:any)=>void>=[];const gateway:RuntimeDataGateway={async fetchData(){return {rows:[]};},fetchFilterCandidates:()=>new Promise(resolve=>calls.push(resolve))};
    const session=createCandidateGatewaySession(gateway),request={filterId:'f',dimension:'d',constraints:{dimensions:{},times:{}}};
    const controller=new AbortController();const old=session.gateway.fetchFilterCandidates!(request,{signal:controller.signal});
    await Promise.resolve();session.invalidate(request);const fresh=session.gateway.fetchFilterCandidates!(request,{signal:new AbortController().signal});
    await Promise.resolve();calls[1]({kind:'values',candidates:[{value:'new',label:'new'}]});await fresh;calls[0]({kind:'values',candidates:[{value:'old',label:'old'}]});await old;
    expect(await session.gateway.fetchFilterCandidates!(request,{signal:new AbortController().signal})).toMatchObject({candidates:[{value:'new'}]});expect(calls).toHaveLength(2);
    const independent=createCandidateGatewaySession(gateway);const pending=independent.gateway.fetchFilterCandidates!(request,{signal:new AbortController().signal});await Promise.resolve();expect(calls).toHaveLength(3);calls[2]({kind:'values',candidates:[]});await pending;session.dispose();independent.dispose();
  });
});

it('shares an in-flight candidate read while cancelling consumers independently', async () => {
  let resolve!: (result: Awaited<ReturnType<NonNullable<RuntimeDataGateway['fetchFilterCandidates']>>>) => void;
  const fetchFilterCandidates = vi.fn<NonNullable<RuntimeDataGateway['fetchFilterCandidates']>>(
    () => new Promise(done => { resolve = done; })
  );
  const session = createCandidateGatewaySession({fetchData:async () => ({rows:[]}), fetchFilterCandidates});
  const first = new AbortController(), second = new AbortController();
  const request = {filterId:'service', dimension:'service', constraints:{times:{}, dimensions:{}}};
  const abandoned = session.gateway.fetchFilterCandidates!(request,{signal:first.signal});
  const retained = session.gateway.fetchFilterCandidates!(request,{signal:second.signal});
  await Promise.resolve();
  expect(fetchFilterCandidates).toHaveBeenCalledTimes(1);
  const firstResult = expect(abandoned).rejects.toMatchObject({name:'AbortError'});
  first.abort();
  const receipt = {kind:'values', candidates:[{value:'A',label:'A'}]} as const;
  resolve(structuredClone({...receipt,candidates:[...receipt.candidates]}));
  await firstResult;
  await expect(retained).resolves.toEqual(receipt);
  expect(fetchFilterCandidates).toHaveBeenCalledTimes(1);
  expect(fetchFilterCandidates.mock.calls[0]![1].signal.aborted).toBe(false);
  session.dispose();
});

it('abandons a candidate flight when every consumer cancels and discards its late result', async () => {
  type Fetch = NonNullable<RuntimeDataGateway['fetchFilterCandidates']>;
  const pending: Array<(result: Awaited<ReturnType<Fetch>>) => void> = [];
  const fetchFilterCandidates = vi.fn<Fetch>(() => new Promise(resolve => pending.push(resolve)));
  const session = createCandidateGatewaySession({fetchData:async () => ({rows:[]}),fetchFilterCandidates});
  const request = {filterId:'service',dimension:'service',constraints:{times:{},dimensions:{}}};
  const controller = new AbortController();
  const old = session.gateway.fetchFilterCandidates!(request,{signal:controller.signal});
  const cancelled = expect(old).rejects.toMatchObject({name:'AbortError'});
  await Promise.resolve();
  controller.abort();
  await cancelled;
  expect(fetchFilterCandidates.mock.calls[0]![1].signal.aborted).toBe(true);

  const signal = new AbortController().signal;
  const fresh = session.gateway.fetchFilterCandidates!(request,{signal});
  await Promise.resolve();
  const current = {kind:'values' as const,candidates:[{value:'new',label:'新值'}]};
  pending[1]!(current);
  await expect(fresh).resolves.toEqual(current);
  pending[0]!({kind:'values',candidates:[{value:'stale',label:'旧值'}]});
  await expect(session.gateway.fetchFilterCandidates!(request,{signal})).resolves.toEqual(current);
  session.dispose();
});
