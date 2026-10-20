import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {createPageDataExecutor} from '../src/execute';
import {parsePage} from '@metriccanvas/page';
import {initialFilterValues} from '../src/filter-values';
import {createSourceProgram} from '../src/source-program/session';
import {composeEffectiveQuery} from '../src/effective-query';
import {createCandidateGatewaySession} from '../src/candidate-session';
import type {RuntimeDataGateway} from '../src/ports';
const load=(kind:string)=>{const result=parsePage(JSON.parse(readFileSync(`pages/ioc-header-business-${kind}-demo.json`,'utf8')));if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;};
describe('B2 complete execution boundary',()=>{
  it('all-unrestricted omits only the dynamic enum predicate and capture/read share it',async()=>{
    const page=load('options'),values=initialFilterValues(page.filters??[]),source=page.dataSources.bound;if(source.source.type!=='query')throw Error();
    source.source.query.body!.dsl_list[0].filter={dims:[{dim_name:'breakthrough',dim_value_list:['STATIC']}]};
    const query=composeEffectiveQuery({dataSource:{...source,source:{...source.source,type:'query'}},filters:page.filters},values,0,[],{});
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
  it('a B2 page enum and a chart-local closed filter share a query without requiring a candidate port',async()=>{
    const doc=JSON.parse(readFileSync('pages/chart-local-filter-page.json','utf8'));doc.schemaVersion='6.33';doc.filters.push({id:'kind',type:'dimension',dimension:'kind',selection:{mode:'single'},options:[{value:'A',label:'A'}],default:['A']});
    doc.dataSources['orders-data'].source.query.filterBindings.kind={target:'dimension',queryField:'kind_code'};
    const parsed=parsePage(doc);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
    const fetchData=vi.fn(async()=>({rows:[]}));const program=createSourceProgram(parsed.page,{gateway:{fetchData}}),updates=[];
    for await(const item of program.read({roots:['orders-data'],conditions:initialFilterValues(parsed.page.filters??[])}))updates.push(item);
    expect(fetchData).toHaveBeenCalledOnce();expect(updates.at(-1)?.snapshot.status).toBe('empty');program.dispose();
  });
  it.each(['denied','network'])('one-shot removes stale initial when B2 candidates are %s',async(kind)=>{
    const page=JSON.parse(readFileSync('pages/ioc-header-business-tree-demo.json','utf8'));page.dataSources.bound.source.initial={totalCount:1,capturedAt:'2026-10-19T00:00:00Z',rows:[{ioc_header_scope:'STALE',ioc_header_count:1,department_code:null,office_code:null,model_code:null,legacy_path:null}]};
    const fetchData=vi.fn(async()=>({rows:[]}));
    const result=await createPageDataExecutor({gateway:{fetchData,async fetchFilterCandidates(){if(kind==='network')throw Object.assign(new Error('upstream private details'),{code:'DQE_NETWORK_ERROR'});return {kind:'denied'};}}}).execute(page);
    expect(result.dataSources.bound.source).not.toHaveProperty('initial');expect(fetchData).toHaveBeenCalledOnce();
  });
  it('an instance receipt session reuses complete UI receipts and a forced reload cannot resurrect an old response',async()=>{
    const calls:Array<(value:any)=>void>=[];const gateway:RuntimeDataGateway={async fetchData(){return {rows:[]};},fetchFilterCandidates:()=>new Promise(resolve=>calls.push(resolve))};
    const session=createCandidateGatewaySession(gateway),request={filterId:'f',dimension:'d',constraints:{dimensions:{},times:{}}};
    const controller=new AbortController();const old=session.gateway.fetchFilterCandidates!(request,{signal:controller.signal});
    session.invalidate(request);const fresh=session.gateway.fetchFilterCandidates!(request,{signal:new AbortController().signal});
    calls[1]({kind:'values',candidates:[{value:'new',label:'new'}]});await fresh;calls[0]({kind:'values',candidates:[{value:'old',label:'old'}]});await old;
    expect(await session.gateway.fetchFilterCandidates!(request,{signal:new AbortController().signal})).toMatchObject({candidates:[{value:'new'}]});expect(calls).toHaveLength(2);
    const independent=createCandidateGatewaySession(gateway);const pending=independent.gateway.fetchFilterCandidates!(request,{signal:new AbortController().signal});expect(calls).toHaveLength(3);calls[2]({kind:'values',candidates:[]});await pending;session.dispose();independent.dispose();
  });
});
