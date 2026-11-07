import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { resolvePeriodSelection } from '@metriccanvas/page/internal';
import { initialFilterValues, createSourceProgram } from '@metriccanvas/data-execution/runtime';
import { createFilterState } from '../src/filter-state';
import { orchestrate } from '../src/orchestrator';
import { prepareExportSnapshots } from '../src/export-snapshots';
import type { DataGateway } from '../src/ports';
function page(){const parsed=parsePage(JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/dashboard-period-filter.json',import.meta.url),'utf8')));if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));return parsed.page;}
function gateway(){return {fetchData:vi.fn<DataGateway['fetchData']>(async()=>({rows:[{entry:'fixture',amount:42}],totalCount:1}))};}
afterEach(()=>vi.useRealTimers());
it('mode changes refetch a different grain for the same window and leave the unbound query cached',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,0,15));const p=page(),g=gateway();
  const state=createFilterState(initialFilterValues(p.filters??[]),p.filters);
  const stream=orchestrate(p,g,state);const off=stream.subscribe(()=>{});
  await vi.waitFor(()=>expect(g.fetchData).toHaveBeenCalledTimes(2));
  state.write('period-filter',{type:'timeRange',...resolvePeriodSelection({mode:'year',value:'2025'},new Date())});
  await vi.waitFor(()=>expect(g.fetchData).toHaveBeenCalledTimes(3));
  state.write('period-filter',{type:'timeRange',...resolvePeriodSelection({mode:'last12Months'},new Date())});
  await vi.waitFor(()=>expect(g.fetchData).toHaveBeenCalledTimes(4));
  expect(g.fetchData.mock.calls.filter(([query])=>query.filterValues.length===0)).toHaveLength(1);
  let selection:unknown;state.subscribe(v=>selection=v.get('period-filter'))();expect(selection).toMatchObject({selection:{mode:'last12Months'}});off();
});
it('dynamic period defaults never reuse an initial snapshot with an unrecorded historical clock',()=>{
  const p=page();const source=p.dataSources.sales.source;if(source.type!=='query')throw Error('query');
  source.initial={capturedAt:'2025-10-15T00:00:00Z',rows:[{entry:'stale',amount:999}],totalCount:1};
  const program=createSourceProgram(p,{gateway:gateway()});
  expect(program.initialSnapshots({roots:['sales'],conditions:initialFilterValues(p.filters??[])}).get('sales')).toEqual({status:'loading'});program.dispose();
});
it('reuses fixed-month results when only the selection mode changes for the same window',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,0,15));
  const input=JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/dashboard-period-filter.json',import.meta.url),'utf8'));
  input.schemaVersion='6.95';
  input.dataSources.sales.source.query.filterBindings['period-filter'].periodPolicy={kind:'fixed',period:'month'};
  delete input.dataSources.sales.source.query.body.dsl_list[0].filter.time.period;
  const parsed=parsePage(input);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const p=parsed.page,g=gateway(),state=createFilterState(initialFilterValues(p.filters??[]),p.filters);
  const stream=orchestrate(p,g,state);let status:string|undefined;
  const off=stream.subscribe(snapshots=>status=snapshots.get('sales')?.status);
  try{
    await vi.waitFor(()=>expect(g.fetchData).toHaveBeenCalledTimes(2));
    state.write('period-filter',{type:'timeRange',...resolvePeriodSelection({mode:'year',value:'2025'},new Date())});
    await vi.waitFor(()=>expect(g.fetchData).toHaveBeenCalledTimes(3));
    await vi.waitFor(()=>expect(status).toBe('ready'));
    state.write('period-filter',{type:'timeRange',...resolvePeriodSelection({mode:'last12Months'},new Date())});
    await vi.waitFor(()=>expect(status).toBe('ready'));
    expect(g.fetchData).toHaveBeenCalledTimes(3);
  }finally{off();}
});
it('export keeps the applied period when the clock moves into the next month',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,15));const p=page(),g=gateway();
  const conditions=new Map([['period-filter',{type:'timeRange' as const,...resolvePeriodSelection({mode:'last12Months'},new Date())}]]);
  vi.setSystemTime(new Date(2026,10,1));
  await prepareExportSnapshots(p,g,new Map(),conditions,new AbortController().signal);
  const query=g.fetchData.mock.calls.find(([q])=>q.filterValues.some(v=>v.target==='time'))?.[0];
  expect(query?.filterValues).toContainEqual({target:'time',period:'month',value:{from:'2025-10',to:'2026-09'}});
});
