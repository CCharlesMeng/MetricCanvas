import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { resolvePeriodSelection } from '@metriccanvas/page/internal';
import { initialFilterValues, createSourceProgram } from '@metriccanvas/data-execution/runtime';
import { createFilterState } from '../src/filter-state';
import { orchestrate } from '../src/orchestrator';
import { prepareExportSnapshots } from '../src/export-snapshots';
import type { DataGateway } from '../src/ports';
function page(){const parsed=parsePage(JSON.parse(readFileSync(new URL('../../../../pages/dashboard-period-filter.json',import.meta.url),'utf8')));if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));return parsed.page;}
function gateway(){return {fetchData:vi.fn<DataGateway['fetchData']>(async()=>({rows:[{entry:'fixture',amount:42}],totalCount:1}))};}
afterEach(()=>vi.useRealTimers());
it('mode-only changes update state without refetching the same window or the unbound query',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,0,15));const p=page(),g=gateway();
  const state=createFilterState(initialFilterValues(p.filters??[]),p.filters);
  const stream=orchestrate(p,g,state);const off=stream.subscribe(()=>{});
  await vi.waitFor(()=>expect(g.fetchData).toHaveBeenCalledTimes(2));
  state.write('period-filter',{type:'timeRange',...resolvePeriodSelection({mode:'year',value:'2025'},new Date())});
  await vi.waitFor(()=>expect(g.fetchData).toHaveBeenCalledTimes(3));
  state.write('period-filter',{type:'timeRange',...resolvePeriodSelection({mode:'last12Months'},new Date())});
  await Promise.resolve();expect(g.fetchData).toHaveBeenCalledTimes(3);
  let selection:unknown;state.subscribe(v=>selection=v.get('period-filter'))();expect(selection).toMatchObject({selection:{mode:'last12Months'}});off();
});
it('dynamic period defaults never reuse an initial snapshot with an unrecorded historical clock',()=>{
  const p=page();const source=p.dataSources.sales.source;if(source.type!=='query')throw Error('query');
  source.initial={capturedAt:'2025-10-15T00:00:00Z',rows:[{entry:'stale',amount:999}],totalCount:1};
  const program=createSourceProgram(p,{gateway:gateway()});
  expect(program.initialSnapshots({roots:['sales'],conditions:initialFilterValues(p.filters??[])}).get('sales')).toEqual({status:'loading'});program.dispose();
});
it('export keeps the applied period when the clock moves into the next month',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,15));const p=page(),g=gateway();
  const conditions=new Map([['period-filter',{type:'timeRange' as const,...resolvePeriodSelection({mode:'last12Months'},new Date())}]]);
  vi.setSystemTime(new Date(2026,10,1));
  await prepareExportSnapshots(p,g,new Map(),conditions,new AbortController().signal);
  const query=g.fetchData.mock.calls.find(([q])=>q.filterValues.some(v=>v.target==='time'))?.[0];
  expect(query?.filterValues).toContainEqual({target:'time',value:{from:'2025-10-01',to:'2026-09-30'}});
});
