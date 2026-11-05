import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage,type DimensionFilterDeclaration} from '@metriccanvas/page/internal';
import {sourceCandidatesGateway,projectSourceCandidates} from '../src/source-candidates';
import {createSourceProgram} from '../src/source-program/session';
import {effectiveDqeItem} from '../src/dqe/dqe';
import {filterCandidatesRequest} from '../src/filter-candidates';
import {createSourceCandidatesPreview} from '../../../apps/playground/fixtures/source-candidates';
const document=JSON.parse(readFileSync(new URL('../../../pages/capabilities/filters/filter-source-candidates.json',import.meta.url),'utf8'));
function page(){const parsed=parsePage(document);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));return parsed.page;}
function filter(id='channel'){return page().filters!.find(filter=>filter.id===id) as DimensionFilterDeclaration;}
async function candidates(state='ready'){
 const p=page(),preview=createSourceCandidatesPreview(state),gateway=sourceCandidatesGateway(p,preview.dataGateway);
 const result=await gateway.fetchFilterCandidates!(filterCandidatesRequest(filter(),p.filters!,new Map()),{signal:new AbortController().signal});
 return {result,requests:preview.requests};
}
it('reads every query page, deduplicates the output and preserves query metrics',async()=>{
 const {result,requests}=await candidates();
 expect(result).toEqual({kind:'values',candidates:[{value:'direct',label:'直营'},{value:'partner',label:'伙伴'},{value:'online',label:'线上'}]});
 expect(requests.map(query=>query.pagination?.offset)).toEqual([0,2,4]);
 expect(requests.map(query=>query.body.dsl_list[0].output_metrics)).toEqual([['weight'],['weight'],['weight']]);
});
it('reads static inline tree nodes without HTTP and keeps parent values independent',async()=>{
 const p=page(),fetchData=vi.fn(),gateway=sourceCandidatesGateway(p,{fetchData});
 const result=await gateway.fetchFilterCandidates!(filterCandidatesRequest(filter('organization'),p.filters!,new Map()),{signal:new AbortController().signal});
 expect(result.kind==='values'&&result.candidates).toContainEqual({value:'north',label:'北区'});
 expect(result.kind==='values'&&result.candidates).toContainEqual({value:'shanghai',label:'上海',parentValue:'north'});expect(fetchData).not.toHaveBeenCalled();
});
it.each(['error','incomplete'])('does not return partial candidates on %s',async state=>{await expect(candidates(state)).rejects.toBeDefined();});
it('returns an explicit empty complete result',async()=>{expect((await candidates('empty')).result).toEqual({kind:'values',candidates:[]});});
it('rejects cancellation and never publishes a candidate result',async()=>{
 const p=page(),controller=new AbortController();controller.abort();
 await expect(sourceCandidatesGateway(p,createSourceCandidatesPreview().dataGateway).fetchFilterCandidates!(filterCandidatesRequest(filter(),p.filters!,new Map()),{signal:controller.signal})).rejects.toBeDefined();
});
it.each([
 [[{code:'child',name:'子',parent:'missing'}]],
 [[{code:'a',name:'甲',parent:'b'},{code:'b',name:'乙',parent:'a'}]],
 [[{code:'a',name:'甲',parent:null},{code:'a',name:'乙',parent:null}]]
])('rejects invalid complete tree batch %#',rows=>{expect(()=>projectSourceCandidates(filter('organization'),rows)).toThrow();});
it('rejects conflicting pagination totals and duplicate identity labels without leaking partial choices',async()=>{
 expect(()=>projectSourceCandidates(filter(),[{code:'a',name:'甲'},{code:'a',name:'乙'}])).toThrow();
 await expect(candidates('incomplete')).rejects.toBeDefined();
});
it('headless execution validates candidates and submits only chosen parent and channel values',async()=>{
 const p=page(),preview=createSourceCandidatesPreview(),program=createSourceProgram(p,{gateway:preview.dataGateway});
 const values=new Map([['organization',{type:'dimension' as const,dimension:'org',values:['north']}],['channel',{type:'dimension' as const,dimension:'channel',values:['online']}]]);
 let rows:unknown;for await(const update of program.read({roots:['chart-data'],conditions:values}))if(update.snapshot.status==='ready')rows=update.snapshot.rows;
 expect(rows).toEqual([{org:'north',amount:300}]);
 const request=preview.requests.find(query=>query.filterValues.some(value=>value.target==='dimension'&&value.queryField==='org'))!;
 expect(request.filterValues).toContainEqual(expect.objectContaining({queryField:'org',values:['north']}));program.dispose();
});
it('does not reuse partial query initial rows as a complete candidate list',async()=>{
 const p=page();const source=p.dataSources['channel-options'];if(source.source.type!=='query')throw Error();
 source.source.initial={capturedAt:'2026-11-05T00:00:00Z',rows:[{code:'stale',name:'过期',weight:1}],totalCount:5};
 const preview=createSourceCandidatesPreview(),gateway=sourceCandidatesGateway(p,preview.dataGateway);
 const result=await gateway.fetchFilterCandidates!(filterCandidatesRequest(filter(),p.filters!,new Map()),{signal:new AbortController().signal});
 expect(result.kind==='values'&&result.candidates.map(item=>item.value)).toEqual(['direct','partner','online']);
 expect(preview.requests).toHaveLength(3);
});
it('rejects excess rows even when an upstream zero total would otherwise tolerate them',async()=>{
 const p=page(),gateway=sourceCandidatesGateway(p,{fetchData:async()=>({rows:[{code:'a',name:'甲',weight:1}],totalCount:0})});
 await expect(gateway.fetchFilterCandidates!(filterCandidatesRequest(filter(),p.filters!,new Map()),{signal:new AbortController().signal})).rejects.toMatchObject({code:'DQE_ROW_CONTRACT_ERROR'});
});
it('preserves period selection metadata while reading a time-bound candidate source',async()=>{
 const p=page(),channel=p.filters![1] as DimensionFilterDeclaration;
 p.filters!.push({id:'period',type:'timeRange',display:'period',required:true,default:{mode:'month',value:'2026-10'}});
 channel.candidateContext={filterIds:['period'],reconcile:'clear'};
 const source=p.dataSources['channel-options'];if(source.source.type!=='query')throw Error();
 source.source.query.filterBindings={period:{target:'time',periodPolicy:{kind:'fixed',period:'day'}}};
 const body=source.source.query.body;if(!body)throw Error();
 body.dsl_list[0].filter={time:{is_aggregate:true},dims:[],metrics:[]};
 const value={type:'timeRange' as const,from:'2026-10-01',to:'2026-10-31',selection:{mode:'month' as const,value:'2026-10'}};
 const request=filterCandidatesRequest(channel,p.filters!,new Map([['period',value]]));
 expect(request.sourceValues?.period).toEqual(value);
 const preview=createSourceCandidatesPreview(),gateway=sourceCandidatesGateway(p,preview.dataGateway);
 const result=await gateway.fetchFilterCandidates!(request,{signal:new AbortController().signal});
 expect(result.kind==='values'&&result.candidates.length).toBe(3);
 expect(effectiveDqeItem(preview.requests[0]).filter).toMatchObject({time:{start:'2026-10-01',end:'2026-10-31'}});
});
it('retains the selected hierarchy level for candidate source predicates',async()=>{
 const p=page(),channel=p.filters![1] as DimensionFilterDeclaration;
 p.filters!.push({id:'scope',type:'dimension',dimension:'department',selection:{mode:'single'},hierarchy:[{id:'department',dimension:'department'},{id:'office',dimension:'office'}]});
 channel.candidateContext={filterIds:['scope'],reconcile:'clear'};
 const source=p.dataSources['channel-options'];if(source.source.type!=='query')throw Error();
 source.source.query.filterBindings={scope:{target:'dimension',levelQueryFields:{department:'dept_field',office:'office_field'}}};
 const request=filterCandidatesRequest(channel,p.filters!,new Map([['scope',{type:'dimension',dimension:'office',level:'office',values:['SH']}]]));
 const preview=createSourceCandidatesPreview(),gateway=sourceCandidatesGateway(p,{...preview.dataGateway,fetchDimensionValues:async()=>({kind:'values',candidates:[{value:'SH',label:'上海'}]})});
 const result=await gateway.fetchFilterCandidates!(request,{signal:new AbortController().signal});
 expect(result.kind==='values'&&result.candidates.length).toBe(3);
 expect(preview.requests[0].filterValues).toContainEqual({target:'dimension',queryField:'office_field',values:['SH']});
});
it('preserves stored dependency state when an override removes its effective candidate constraint',()=>{
 const p=page(),channel=p.filters![1] as DimensionFilterDeclaration;
 p.filters!.push({id:'scope',type:'dimension',dimension:'scope'},{id:'flag',type:'boolean',overridesFilters:['scope']});
 channel.candidateContext={filterIds:['scope','flag'],reconcile:'clear'};
 const scope={type:'dimension' as const,dimension:'scope',values:['kept']};
 const values=new Map<string,import('../src/filter-values').FilterValue>([['scope',scope],['flag',{type:'boolean',value:true}],['channel',{type:'dimension',dimension:'channel',values:['online']}]]);
 const request=filterCandidatesRequest(channel,p.filters!,values);
 expect(request.constraints.dimensions).toEqual({});expect(request.sourceValues?.scope).toEqual(scope);expect(request.sourceValues).not.toHaveProperty('channel');
});
