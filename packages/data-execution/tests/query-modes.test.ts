import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {isQueryDataSource} from '@metriccanvas/page/internal';
import {createSourceProgram} from '../src/source-program/session';
import {initialFilterValues} from '../src/filter-values';
import type {EffectiveQuery} from '@metriccanvas/page/internal';
import {composeEffectiveQuery} from '../src/effective-query';
import {defaultSourceView} from '../src/runtime';
import {officeGateway} from './fixtures/office-gateway';
const load=()=>{const result=parsePage(JSON.parse(readFileSync('pages/capabilities/filters/query-mode-chart-demo.json','utf8')));if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;};
async function collect(program:ReturnType<typeof createSourceProgram>,request:Parameters<ReturnType<typeof createSourceProgram>['read']>[0]){const updates=[];for await(const update of program.read(request))updates.push(update);return updates;}
const gateway=()=>({fetchData:vi.fn(async(query:EffectiveQuery)=>({rows:[{month:'2026-01',amount:JSON.stringify(query.body).includes('商机金额')?330000:110000}],totalCount:1}))});

describe('query mode source execution',()=>{
  it('resolves branch mappings before filtering upstream rows for a dependent query',async()=>{
    const page=load(),upstream=page.dataSources['amount-trend'],downstream=page.dataSources['amount-total'];
    if(!isQueryDataSource(upstream)||!isQueryDataSource(downstream))throw Error('query');
    for(const leaf of Object.values(upstream.source.query.queryModes!.cases))leaf.body.dsl_list[0].order={limit:100};
    downstream.source.query.resultBindings=[{source:'amount-trend',field:'month',target:'dimension',queryField:'month-input',maxValues:100,where:{field:'amount',op:'gt',value:0}}];
    const port=gateway(),program=createSourceProgram(page,{gateway:port});
    const updates=await collect(program,{roots:['amount-total'],conditions:initialFilterValues(page.filters??[])});
    expect(updates.at(-1)?.snapshot).toMatchObject({status:'ready'});
    expect(port.fetchData.mock.calls[1][0].filterValues).toContainEqual({target:'dimension',queryField:'month-input',values:['2026-01']});program.dispose();
  });
  it('uses the active raw field for remote column candidates',async()=>{
    const page=load(),source=page.dataSources['amount-trend'];if(!isQueryDataSource(source))throw Error('query');
    delete source.source.resultScope;
    const leaf=source.source.query.queryModes!.cases.opportunities;leaf.fieldMappings!.month='商机月份';leaf.body.dsl_list[0].output_dims=['商机月份'];
    const values=initialFilterValues(page.filters??[]);values.set('business',{type:'dimension',dimension:'business_mode',values:['opportunities']});
    const requests:any[]=[],port={...gateway(),fetchColumnCandidates:async(request:any)=>{requests.push(request);return {kind:'values' as const,candidates:[],totalCount:0};}};
    const program=createSourceProgram(page,{gateway:port});
    await program.readColumnCandidates({sourceId:'amount-trend',field:'month',conditions:values,view:defaultSourceView(page,'amount-trend')});
    expect(requests[0]).toMatchObject({queryField:'商机月份',query:{fieldMappings:{month:{queryField:'商机月份'}}}});program.dispose();
  });
  it('selects and pages a joined member using its branch response mapping',async()=>{
    const document=JSON.parse(readFileSync('packages/page/fixtures/contract-valid/paged-join-page.json','utf8'));document.schemaVersion='6.57';
    document.filters.push({id:'mode',type:'dimension',dimension:'mode',default:['b'],selection:{mode:'single',required:true},options:[{label:'A',value:'a'},{label:'B',value:'b'}]});
    const source=document.dataSources['office-support'],mapping:Record<string,string>={};
    for(const [id,field]of Object.entries(source.fields)as Array<[string,any]>){mapping[id]=field.queryField;delete field.queryField;}
    const leaf={body:source.source.query.body,filterBindings:source.source.query.filterBindings,fieldMappings:mapping},other=structuredClone(leaf);
    other.body.dsl_list[0].output_metrics=['alternate_support_rate'];other.fieldMappings['support-rate']='alternate_support_rate';
    source.source.query={language:'dqe',queryModes:{filterId:'mode',cases:{a:leaf,b:other}}};
    const parsed=parsePage(document);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
    const page=parsed.page,calls:EffectiveQuery[]=[],program=createSourceProgram(page,{gateway:officeGateway(calls)});
    const view={...defaultSourceView(page,'office-overview'),sort:[{field:'support-rate',direction:'desc' as const}]};
    const updates=await collect(program,{roots:['office-overview'],conditions:initialFilterValues(page.filters??[]),views:new Map([['office-overview',view]])});
    expect(updates.at(-1)?.snapshot).toMatchObject({status:'ready',totalCount:8,rows:expect.any(Array)});
    expect(calls.find(query=>JSON.stringify(query.body.dsl_list[0].output_metrics).includes('alternate_support_rate'))).toMatchObject({pagination:{limit:3},sort:[{queryField:'alternate_support_rate',direction:'desc'}]});program.dispose();
  });
  it('uses the active native mapping for sorting, table filters and captured exports',async()=>{
    const page=load(),values=initialFilterValues(page.filters??[]),source=page.dataSources['amount-trend'];
    if(!isQueryDataSource(source))throw Error('query');
    values.set('business',{type:'dimension',dimension:'business_mode',values:['opportunities']});
    const query=composeEffectiveQuery({dataSource:source},values,0,[{field:'amount',direction:'desc'}],{amount:{mode:'numberRange',from:100,to:500}});
    expect(query.sort).toEqual([{queryField:'商机金额',direction:'desc'}]);
    expect(query.tableFilters).toEqual([{target:'metricRange',metric:'商机金额',from:100,to:500}]);
    expect(query.fieldMappings.amount).toMatchObject({queryField:'商机金额'});
    const port=gateway(),program=createSourceProgram(page,{gateway:port});
    const frozen=program.captureQueries(values,new Map(),new Map());frozen.get('amount-trend')!.fieldMappings.amount={type:'money',role:'measure',currency:'CNY',queryField:'伪造字段'};
    await collect(program,{roots:['amount-trend'],conditions:values,queries:frozen,purpose:'complete'});
    expect(port.fetchData.mock.calls[0][0].fieldMappings.amount).toMatchObject({queryField:'商机金额'});program.dispose();
  });
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
    expect(port.fetchData.mock.calls[0][0].body.dsl_list[0].output_metrics).toEqual(['商机金额']);program.dispose();
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
