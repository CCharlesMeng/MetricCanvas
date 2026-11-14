import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import {parsePage,normalizePageDocument} from '@metriccanvas/page';
import type {Page} from '@metriccanvas/page/internal';
import {createSourceProgram} from '../src/source-program/session';
import type {RuntimeDataGateway,FilterCandidatesResult} from '../src/ports';
import type {FilterValues} from '../src/filter-values';
import {sourceCandidatesGateway} from '../src/source-candidates';
import {filterCandidatesRequest} from '../src/filter-candidates';

function document(version='6.120',id='key-office') {
  const page=JSON.parse(readFileSync('pages/capabilities/filters/key-office-priority-demo.json','utf8').replaceAll('key-office',id));
  page.schemaVersion=version;
  delete page.dataSources.offices.source.query.filterBindings[id];
  return page;
}
function selected(id='key-office'):FilterValues {return new Map([[id,{type:'boolean',value:true}]]);}
function deferred<T>() {let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
const members:FilterCandidatesResult={kind:'values',candidates:[{value:'上海代表处',label:'上海代表处'}]};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function collect(program:ReturnType<typeof createSourceProgram>,conditions:FilterValues,purpose:'screen'|'complete'='screen') {
  const updates=[];
  for await(const update of program.read({roots:['offices'],conditions,purpose}))updates.push(update);
  return updates;
}

describe('native IOC membership preparation at the shared execution interface',()=>{
  it.each(['key-office','key-national-only','key-rep-only'])('6.120 reads %s only after complete membership and never mutates the document',async id=>{
    const raw=document('6.120',id),original=structuredClone(raw),parsed=parsePage(raw);
    expect(parsed.ok).toBe(true);if(!parsed.ok)return;
    const receipt=deferred<FilterCandidatesResult>(),fetchData=vi.fn<RuntimeDataGateway['fetchData']>(async()=>({rows:[],totalCount:0}));
    const gateway:RuntimeDataGateway={fetchData,fetchFilterCandidates:vi.fn(()=>receipt.promise)};
    const program=createSourceProgram(parsed.page,{gateway});
    expect(program.initialSnapshots({roots:['offices'],conditions:selected(id)}).get('offices')).toEqual({status:'loading'});
    const pending=collect(program,selected(id));await tick();
    expect(fetchData).not.toHaveBeenCalled();
    receipt.resolve(members);await pending;
    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(fetchData.mock.calls[0][0]).toMatchObject({filterValues:[{target:'dimension',queryField:'代表处',values:['上海代表处']}]});
    expect(raw).toEqual(original);program.dispose();
  });
  it('does not add native membership bindings to older documents',async()=>{
    const raw=document('6.119'),parsed=parsePage(raw);expect(parsed.ok).toBe(true);if(!parsed.ok)return;
    expect(parsed.page.schemaVersion).toBe('6.119');
    const normalized=normalizePageDocument(raw);expect(normalized.ok&&normalized.document.schemaVersion).toBe('6.119');
    const page=parsed.page,fetchData=vi.fn<RuntimeDataGateway['fetchData']>(async()=>({rows:[],totalCount:0})),fetchFilterCandidates=vi.fn();
    const program=createSourceProgram(page,{gateway:{fetchData,fetchFilterCandidates}});
    await collect(program,selected());expect(fetchFilterCandidates).not.toHaveBeenCalled();
    expect(fetchData.mock.calls[0][0].filterValues).toEqual([]);program.dispose();
  });
  it('does not infer a business-private ID from its label or declaration',async()=>{
    const raw=document('6.120','key-account-only'),parsed=parsePage(raw);expect(parsed.ok).toBe(true);if(!parsed.ok)return;
    const fetchData=vi.fn<RuntimeDataGateway['fetchData']>(async()=>({rows:[],totalCount:0})),fetchFilterCandidates=vi.fn();
    const program=createSourceProgram(parsed.page,{gateway:{fetchData,fetchFilterCandidates}});
    await collect(program,selected('key-account-only'));
    expect(fetchFilterCandidates).not.toHaveBeenCalled();expect(fetchData.mock.calls[0][0].filterValues).toEqual([]);program.dispose();
  });
  it('does not request membership when unchecked and preserves explicit boolean bindings',async()=>{
    const raw=document(),fetchData=vi.fn<RuntimeDataGateway['fetchData']>(async()=>({rows:[],totalCount:0})),fetchFilterCandidates=vi.fn();
    let program=createSourceProgram(raw as Page,{gateway:{fetchData,fetchFilterCandidates}});
    await collect(program,new Map());program.dispose();
    raw.dataSources.offices.source.query.filterBindings['key-office']={target:'boolean',queryField:'重点国代',whenTrue:['true']};
    program=createSourceProgram(raw as Page,{gateway:{fetchData,fetchFilterCandidates}});
    await collect(program,selected());expect(fetchFilterCandidates).not.toHaveBeenCalled();
    expect(fetchData.mock.calls[1][0].filterValues).toEqual([{target:'dimension',queryField:'重点国代',values:['true']}]);program.dispose();
  });
  it.each(['screen','complete'] as const)('empty membership suppresses %s HTTP and unsafe initial rows',async purpose=>{
    const raw=document();raw.dataSources.offices.source.initial={capturedAt:'2026-11-14T00:00:00Z',rows:[{'代表处':'南京代表处','金额':999,'客户级别':'战略'}],totalCount:1};
    const fetchData=vi.fn<RuntimeDataGateway['fetchData']>(async()=>({rows:[],totalCount:0})),program=createSourceProgram(raw as Page,{gateway:{fetchData,async fetchFilterCandidates(){return {kind:'values',candidates:[]};}}});
    const updates=await collect(program,selected(),purpose);
    expect(updates.at(-1)?.snapshot).toMatchObject({status:'empty'});expect(fetchData).not.toHaveBeenCalled();program.dispose();
  });
  it('membership failure never falls through to an unrestricted request',async()=>{
    const fetchData=vi.fn<RuntimeDataGateway['fetchData']>(async()=>({rows:[],totalCount:0})),program=createSourceProgram(document() as Page,{gateway:{fetchData,async fetchFilterCandidates(){return {kind:'denied'};}}});
    expect((await collect(program,selected())).at(-1)?.snapshot).toMatchObject({status:'error',error:{code:'DQE_CONFIG_ERROR'}});
    expect(fetchData).not.toHaveBeenCalled();program.dispose();
  });
  it('column candidates wait for the same authorized scope before calling the gateway',async()=>{
    const receipt=deferred<FilterCandidatesResult>(),fetchData=vi.fn<RuntimeDataGateway['fetchData']>(async()=>({rows:[],totalCount:0}));
    const fetchColumnCandidates=vi.fn<NonNullable<RuntimeDataGateway['fetchColumnCandidates']>>(async()=>({kind:'values',candidates:[],totalCount:0}));
    const program=createSourceProgram(document() as Page,{gateway:{fetchData,fetchColumnCandidates,fetchFilterCandidates:()=>receipt.promise}});
    const pending=program.readColumnCandidates({sourceId:'offices',field:'office',conditions:selected(),view:{pageIndex:0,pageSize:20,sort:[],predicates:[]}});
    await tick();expect(fetchColumnCandidates).not.toHaveBeenCalled();receipt.resolve(members);await pending;
    expect(fetchColumnCandidates.mock.calls[0][0].query.filterValues).toContainEqual({target:'dimension',queryField:'代表处',values:['上海代表处']});program.dispose();
  });
  it('the standard key-national-only preserves the Region intersection',async()=>{
    const page=document('6.120','key-national-only');page.filters[1].overridesFilters=['region'];
    const fetchData=vi.fn<RuntimeDataGateway['fetchData']>(async()=>({rows:[],totalCount:0}));
    const program=createSourceProgram(page as Page,{gateway:{fetchData,async fetchFilterCandidates(request){
      if(request.filterId!=='region')return members;
      return {kind:'values',candidates:[{value:'全球',label:'全球',level:'geo'},{value:'华东地区部',label:'华东地区部',level:'region-dept',parent:{level:'geo',value:'全球'}},{value:'南京代表处',label:'南京代表处',level:'office',parent:{level:'region-dept',value:'华东地区部'}}]};
    }}});
    const values=new Map(selected('key-national-only'));values.set('region',{type:'dimension',dimension:'demo_office',level:'office',values:['南京代表处']});
    expect((await collect(program,values)).at(-1)?.snapshot).toMatchObject({status:'empty'});
    expect(fetchData).not.toHaveBeenCalled();program.dispose();
  });
  it('page-source candidates inherit the native membership dependency without editing authored JSON',async()=>{
    const raw=document();
    raw.filters.push({id:'scoped-office',type:'dimension',dimension:'scoped-office',candidates:{dataSource:'options',valueField:'office'},candidateContext:{filterIds:['region'],reconcile:'clear'}});
    raw.dataSources.options=structuredClone(raw.dataSources.offices);
    delete raw.dataSources.options.source.query.filterBindings.mtime;
    delete raw.dataSources.options.source.query.filterBindings['customer-category'];
    const before=structuredClone(raw),parsed=parsePage(raw);expect(parsed.ok,JSON.stringify(parsed.errors)).toBe(true);if(!parsed.ok)return;
    const filter=parsed.page.filters!.find(item=>item.id==='scoped-office');if(filter?.type!=='dimension')throw Error('dimension');
    expect(filter.candidateContext?.filterIds).toEqual(['region','key-office']);expect(raw).toEqual(before);
    const fetchData=vi.fn<RuntimeDataGateway['fetchData']>(async()=>({rows:[{office:'上海代表处',amount:10,customer:'战略'}],totalCount:1}));
    const gateway=sourceCandidatesGateway(parsed.page,{fetchData,async fetchFilterCandidates(){return members;}});
    const result=await gateway.fetchFilterCandidates!(filterCandidatesRequest(filter,parsed.page.filters!,selected()),{signal:new AbortController().signal});
    expect(result).toMatchObject({kind:'values',candidates:[{value:'上海代表处'}]});
    expect(fetchData.mock.calls[0][0].filterValues).toContainEqual({target:'dimension',queryField:'代表处',values:['上海代表处']});
  });
});
