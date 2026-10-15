import { expect, it } from 'vitest';
import fixture from '../../../page/fixtures/contract-valid/report-date-filters-page.json';
import { parsePage } from '@metriccanvas/page';
import { prepareExportSnapshots, ExportViewError } from '../src/export-snapshots';
import { initializePageParams, resolvePageParams } from '../src/page-params';
import { createFilterState, initialFilterValues } from '../src/filter-state';
import { orchestrate } from '../src/orchestrator';
import type { DataGateway } from '../src/ports';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
function loaded() {
  const parsed=parsePage(fixture);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const params=resolvePageParams('',parsed.page.params??[]);
  return initializePageParams(parsed.page,params.values);
}
function setup(gateway:DataGateway) {
  const page=loaded(),filters=createFilterState(initialFilterValues(page.filters??[]));
  const stream=orchestrate(page,gateway,filters);const unsubscribe=stream.subscribe(()=>{});
  return {page,filters,stream,unsubscribe};
}
it('exports all matching pages, captures filters/sort/header filters before subsequent interaction',async()=>{
  const requests:EffectiveQuery[]=[];
  const gateway:DataGateway={async fetchData(query){requests.push(query);return {rows:Array.from({length:Math.min(query.pagination?.limit??10,53-(query.pagination?.offset??0))},(_,i)=>({entry:`row-${i+(query.pagination?.offset??0)}`,amount:i})),totalCount:53};}};
  const {page,filters,stream,unsubscribe}=setup(gateway);
  stream.setQuerySort('sales',[{field:'amount',direction:'desc'}]);
  stream.setQueryHeaderFilters('sales',{entry:{mode:'select',values:['target']}});
  const frozen=stream.captureQueries();
  filters.write('period-filter',{type:'timeRange',from:'2026-02',to:'2026-04'});
  requests.length=0;
  const result=await prepareExportSnapshots(page,gateway,frozen,initialFilterValues(page.filters??[]),new AbortController().signal);
  const snapshot=result.get('sales');expect(snapshot?.status==='ready'&&snapshot.rows.length).toBe(53);
  expect(requests.map(r=>r.pagination?.offset)).toEqual([0,10,20,30,40,50]);
  for(const query of requests) {
    expect(query.filterValues).toContainEqual({target:'time',value:{from:'2026-01',to:'2026-06'}});
    expect(query.filterValues).toContainEqual({target:'dimension',queryField:'entry',values:['target']});
    expect(query.sort).toEqual([{queryField:'amount',direction:'desc'}]);
  }
  unsubscribe();
});
it('fails over the row limit, on incomplete pagination and when total changes',async()=>{
  for(const mode of ['limit','incomplete','changed']) {
    let count=0;
    const gateway:DataGateway={async fetchData(query){count++;return {rows:mode==='incomplete'?[]:Array.from({length:10},(_,i)=>({entry:String(i),amount:i})),totalCount:mode==='limit'?10001:mode==='changed'&&query.pagination?.offset?51:53};}};
    const {page,filters,stream,unsubscribe}=setup(gateway);
    const expected=mode==='limit'?'EXPORT_ROW_LIMIT':'EXPORT_INCOMPLETE_DATA';
    await expect(prepareExportSnapshots(page,gateway,stream.captureQueries(),initialFilterValues(page.filters??[]),new AbortController().signal)).rejects.toMatchObject({code:expected});
    unsubscribe();
  }
});
it('ignores embedded first-screen rows and fetches partial unpaged results to completion',async()=>{
  const page=loaded();const source=page.dataSources.sales.source;if(source.type!=='query')throw Error('fixture');
  source.initial={capturedAt:'2026-01-01T00:00:00Z',rows:[{entry:'stale',amount:0}],totalCount:53};
  const calls:EffectiveQuery[]=[];
  const gateway:DataGateway={async fetchData(query){calls.push(query);return {rows:[{entry:'fresh',amount:1}],totalCount:1};}};
  const filters=createFilterState(initialFilterValues(page.filters??[]));const stream=orchestrate(page,gateway,filters);const off=stream.subscribe(()=>{});
  const result=await prepareExportSnapshots(page,gateway,stream.captureQueries(),initialFilterValues(page.filters??[]),new AbortController().signal);
  expect(result.get('sales')).toMatchObject({status:'ready',rows:[{entry:'fresh',amount:1}]});expect(calls.length).toBeGreaterThan(0);off();
});
it('explicit time-point windows share a mutable base without changing immutable parameters',async()=>{
  const raw=structuredClone(fixture) as any;
  raw.params.query.times[0].start=raw.params.query.times[0].end='2026-04';
  raw.filters[0]={id:'period-filter',type:'timePoint',granularity:'month',required:true,initialParam:'period'};
  raw.dataSources.sales.source.query.filterBindings={'period-filter':{target:'time',window:{kind:'yearToDate'}}};
  const parsed=parsePage(raw);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const params=resolvePageParams('',parsed.page.params??[]);
  const page=initializePageParams(parsed.page,params.values);const filters=createFilterState(initialFilterValues(page.filters??[]));
  const stream=orchestrate(page,{async fetchData(){return {rows:[],totalCount:0};}},filters);const off=stream.subscribe(()=>{});
  expect(stream.captureQueries().get('sales')?.filterValues).toContainEqual({target:'time',value:{from:'2026-01',to:'2026-04'}});
  filters.write('period-filter',{type:'timePoint',granularity:'month',value:'2026-07'});
  expect(stream.captureQueries().get('sales')?.filterValues).toContainEqual({target:'time',value:{from:'2026-01',to:'2026-07'}});
  expect(params.values.get('period')).toEqual({start:'2026-04',end:'2026-04'});off();
});

it('requires completeness evidence for an unpaged query',async()=>{
  const page=loaded();const source=page.dataSources.sales.source;if(source.type!=='query')throw Error('fixture');
  delete (source.query.body.dsl_list[0] as any).order;
  const table=page.sections[1].components[0];if(table.type==='table')table.props.pagination={mode:'none'};
  const filters=createFilterState(initialFilterValues(page.filters??[]));const gateway:DataGateway={async fetchData(){return {rows:[{entry:'only visible',amount:1}]};}};
  const stream=orchestrate(page,gateway,filters);const off=stream.subscribe(()=>{});
  await expect(prepareExportSnapshots(page,gateway,stream.captureQueries(),initialFilterValues(page.filters??[]),new AbortController().signal)).rejects.toMatchObject({code:'EXPORT_INCOMPLETE_DATA'});
  source.resultScope='complete';
  expect((await prepareExportSnapshots(page,gateway,stream.captureQueries(),initialFilterValues(page.filters??[]),new AbortController().signal)).get('sales')).toMatchObject({status:'ready'});
  off();
});

it('keeps a static business TopN on a graph without treating it as an export page window',async()=>{
 const page=loaded(),source=page.dataSources.sales.source;if(source.type!=='query')throw Error('query');source.query.body.dsl_list[0].order={limit:5};
 const table=page.sections[1].components[0];if(table.type==='table')table.props.pagination={mode:'none'};
 const calls:EffectiveQuery[]=[];const gateway:DataGateway={async fetchData(query){calls.push(query);return {rows:Array.from({length:5},(_,i)=>({entry:String(i),amount:i})),totalCount:100};}};
 const stream=orchestrate(page,gateway),off=stream.subscribe(()=>{});
 const result=await prepareExportSnapshots(page,gateway,stream.captureQueries(),initialFilterValues(page.filters??[]),new AbortController().signal);
 expect(result.get('sales')).toMatchObject({status:'ready',rows:expect.any(Array)});const snapshot=result.get('sales');expect(snapshot?.status==='ready'&&snapshot.rows.length).toBe(5);expect(calls.every(query=>query.pagination===undefined)).toBe(true);off();
});
