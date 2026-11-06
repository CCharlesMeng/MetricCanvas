import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {DataSnapshot,Page,TableQueryView} from '@metriccanvas/page/internal';
import {createSourceProgram,defaultSourceView,initialFilterValues} from '../src/runtime';
import {createQueryComparisonPreview} from '../../../apps/playground/fixtures/query-comparison-gateway';
import {comparisonInputs} from '../../../apps/playground/fixtures/period-comparison';
import {effectiveDqeItem} from '../src/dqe/dqe';

const now=new Date(2026,9,30);
function fixture():Page {
  const result=parsePage(JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/period-comparison/period-comparison-query-page.json',import.meta.url),'utf8')));
  if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;
}
async function read(preview:ReturnType<typeof createQueryComparisonPreview>,patch:Partial<TableQueryView>={},complete=false,page=fixture()) {
  const program=createSourceProgram(page,{gateway:preview.dataGateway,displayInputs:()=>comparisonInputs,now});
  let snapshot:DataSnapshot|undefined,initial:unknown;
  try{
    for await(const update of program.read({roots:['comparison'],conditions:initialFilterValues(page.filters??[],now),
      views:new Map([['comparison',{...defaultSourceView(page,'comparison'),...patch}]]),purpose:complete?'complete':'screen'})){
      if(update.sourceId==='comparison'){snapshot=update.snapshot;initial=update.initial;}
    }
    return {snapshot:snapshot!,initial};
  }finally{program.dispose();}
}
function rows(snapshot:DataSnapshot){if(snapshot.status!=='ready')throw Error(JSON.stringify(snapshot));return snapshot.rows;}

it('reads only a ten-row page from a hundred-thousand-object domain and fills exactly those keys',async()=>{
  const preview=createQueryComparisonPreview('large'),{snapshot,initial}=await read(preview,{pageIndex:1});
  expect(snapshot).toMatchObject({status:'ready',totalCount:100000});expect(rows(snapshot)).toHaveLength(10);expect(initial).toBeUndefined();
  expect(preview.calls).toHaveLength(3);expect(preview.calls[0].pagination).toEqual({offset:10,limit:10});
  for(const query of preview.calls.slice(1)){
    expect(query.pagination).toEqual({offset:0,limit:10});
    expect(query.filterValues).toContainEqual({target:'dimension',queryField:'customer',values:rows(snapshot).map(row=>row.customer)});
  }
});
it('computes exact results and distinguishes absent records, explicit null, zero and negative baselines',async()=>{
  const preview=createQueryComparisonPreview(),{snapshot}=await read(preview,{sort:[{field:'customer',direction:'asc'}]});
  const list=rows(snapshot);
  expect(list[0]).toMatchObject({'previous-growth':20,'year-ago-growth':50,'previous-rate-delta':10,'year-ago-rate-delta':20});
  expect(list[1]['previous-growth']).toBeNull();expect(list[2]['previous-rate-delta']).toBeNull();
  expect(list[3]).toMatchObject({'previous-sales':0,'previous-growth':null,'previous-rate':null});
  expect(list[4]).toMatchObject({'previous-sales':null,'previous-growth':null});
  expect(list[5]).toMatchObject({'previous-sales':-50,'previous-growth':null});
});
it('keeps metric selection predicates on the current query and only carries keys to history',async()=>{
  const preview=createQueryComparisonPreview(),{snapshot}=await read(preview,{sort:[],predicates:[{field:'current-sales',op:'gte',value:300}]});
  expect(rows(snapshot)).toHaveLength(10);
  expect(preview.calls[0].tableFilters).toContainEqual({target:'metricRange',metric:'sales',from:300});
  expect(preview.calls.slice(1).every(query=>!query.tableFilters?.length)).toBe(true);
});
it('preserves sales-area and fixed product conditions in every native period request',async()=>{
  const page=fixture();page.filters!.push({id:'sales-area',type:'dimension',dimension:'sales-area',default:['east']});
  for(const id of ['current','previous','year-ago']){
    const source=page.dataSources[id];if(source.source.type!=='query')throw Error('query');
    source.source.query.filterBindings!['sales-area']={target:'dimension',queryField:'sales-area'};
    const item=source.source.query.body!.dsl_list[0];item.filter={...item.filter as object,dims:[{dim_name:'product',dim_value_list:['A']}]};
  }
  expect(parsePage(page)).toMatchObject({ok:true});
  const preview=createQueryComparisonPreview();expect((await read(preview,{},false,page)).snapshot.status).toBe('ready');
  for(const query of preview.calls){
    expect(effectiveDqeItem(query)).toMatchObject({filter:{dims:expect.arrayContaining([{dim_name:'product',dim_value_list:['A']},{dim_name:'sales-area',dim_value_list:['east']}])}});
  }
});
it('splits supplement key batches without reading another business page',async()=>{
  const page=fixture(),source=page.dataSources.comparison.source;if(source.type!=='pagedJoin')throw Error('join');
  if(!('batchSize' in source.pagination))throw Error('query');source.pagination.batchSize=3;
  const preview=createQueryComparisonPreview();expect(rows((await read(preview,{},false,page)).snapshot)).toHaveLength(10);
  expect(preview.calls).toHaveLength(9);expect(preview.calls.slice(1).every(query=>query.pagination?.offset===0&&query.pagination.limit===3)).toBe(true);
});
it('exports all pages with computed values and preserves the captured ordering',async()=>{
  const preview=createQueryComparisonPreview(),{snapshot}=await read(preview,{},true);
  expect(rows(snapshot)).toHaveLength(23);expect(rows(snapshot)[0]['previous-growth']).toBe(75);
  expect(preview.calls.filter(query=>query.filterValues.length===1).map(query=>query.pagination?.offset)).toEqual([0,10,20]);
  expect(new Set(rows(snapshot).map(row=>row.customer)).size).toBe(23);
});
it.each(['error','duplicate','truncated'])('rejects %s supplements without a complete recovery scan',async state=>{
  const preview=createQueryComparisonPreview(state),{snapshot}=await read(preview);
  expect(snapshot.status).toBe('error');expect(preview.calls.length).toBeLessThanOrEqual(3);
  expect(preview.calls.every(query=>query.pagination?.limit===10)).toBe(true);
});
it('fails before making a request without a trusted cutoff and rejects calculated-field view operations',async()=>{
  const page=fixture(),preview=createQueryComparisonPreview(),program=createSourceProgram(page,{gateway:preview.dataGateway,now});
  const view=defaultSourceView(page,'comparison'),conditions=initialFilterValues(page.filters??[],now);
  expect(()=>program.prepareView('comparison',conditions,view)).toThrow('统计截止时间');
  const ready=createSourceProgram(page,{gateway:preview.dataGateway,now,displayInputs:()=>comparisonInputs});
  expect(()=>ready.prepareView('comparison',conditions,{...view,predicates:[{field:'previous-growth',op:'gte',value:20}]})).toThrow();
  expect(preview.calls).toHaveLength(0);program.dispose();ready.dispose();
});
it('times out a stalled comparison request without reading a complete population',async()=>{
  const timeout=AbortSignal.timeout.bind(AbortSignal),spy=vi.spyOn(AbortSignal,'timeout').mockImplementation(milliseconds=>timeout(milliseconds===60000?5:milliseconds));
  const preview=createQueryComparisonPreview();
  preview.dataGateway.fetchData=(_query,_context,signal)=>new Promise((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  try{expect((await read(preview)).snapshot).toMatchObject({status:'error',error:{code:'DQE_TIMEOUT'}});}
  finally{spy.mockRestore();}
});
it('freezes the period fact across all pages of a complete comparison read',async()=>{
  const page=fixture(),inputs=structuredClone(comparisonInputs),preview=createQueryComparisonPreview();
  const program=createSourceProgram(page,{gateway:{async fetchData(query,context,signal){
    const result=await preview.dataGateway.fetchData(query,context,signal);
    inputs.periods={'sales-through':{status:'ready',granularity:'date',latest:'2026-10-27'}};return result;
  }},now,displayInputs:()=>inputs});
  let snapshot:DataSnapshot|undefined;
  try{
    for await(const update of program.read({roots:['comparison'],conditions:initialFilterValues(page.filters??[],now),purpose:'complete'}))if(update.sourceId==='comparison')snapshot=update.snapshot;
    expect(snapshot).toMatchObject({status:'ready',totalCount:23});
    expect(preview.calls.filter(query=>query.filterValues.some(value=>value.target==='time'&&value.value.from==='2026-10-01')).every(query=>query.filterValues.some(value=>value.target==='time'&&value.value.to==='2026-10-28'))).toBe(true);
  }finally{program.dispose();}
});
it('uses the frozen period fact for explicit candidate reads and rejects calculated candidates',async()=>{
  const page=fixture(),preview=createQueryComparisonPreview(),candidate=vi.spyOn(preview.dataGateway,'fetchColumnCandidates');
  const program=createSourceProgram(page,{gateway:preview.dataGateway,now,displayInputs:()=>comparisonInputs});
  const request={sourceId:'comparison',field:'customer',conditions:initialFilterValues(page.filters??[],now),view:defaultSourceView(page,'comparison')};
  try{
    expect(await program.readColumnCandidates(request)).toMatchObject({kind:'values',totalCount:23});
    expect(candidate.mock.calls[0][0].query.filterValues).toContainEqual({target:'time',period:'day',value:{from:'2026-10-01',to:'2026-10-28'}});
    expect(await program.readColumnCandidates({...request,field:'previous-growth'})).toEqual({kind:'unavailable'});
    expect(candidate).toHaveBeenCalledTimes(1);
  }finally{program.dispose();}
});
