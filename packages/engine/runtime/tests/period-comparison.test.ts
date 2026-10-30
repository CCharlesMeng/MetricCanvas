import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {resolvePeriodSelection,type DisplayInputsSnapshot,type DataSnapshot} from '@metriccanvas/page/internal';
import {createFilterState} from '../src/filter-state';
import {orchestrate} from '../src/orchestrator';
import {prepareExportSnapshots} from '../src/export-snapshots';
import type {DataGateway} from '../src/ports';
import {createPeriodComparisonPreview,comparisonInputs} from '../../../../apps/playground/fixtures/period-comparison';
const now=new Date(2026,9,29);
function fixture(){const p=parsePage(JSON.parse(readFileSync(new URL('../../../../pages/capabilities/data/period-comparison/period-comparison-demo.json',import.meta.url),'utf8')));if(!p.ok)throw Error(JSON.stringify(p.errors));return p.page;}
function conditions(){return new Map([['period',{type:'timeRange' as const,...resolvePeriodSelection({mode:'month',value:'2026-10'},now)}]]);}
it('refreshes the unchanged selection when trusted cutoff changes and discards late old receipts',async()=>{
  const page=fixture();let inputs:DisplayInputsSnapshot=structuredClone(comparisonInputs);
  let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
  let first=true;
  const fetchData=vi.fn<DataGateway['fetchData']>(async()=>{
    if(first){await pending;return {rows:[{customer:'x',sales:999,rate:50}],totalCount:1};}
    return {rows:[{customer:'x',sales:200,rate:50}],totalCount:1};
  });
  const state=createFilterState(conditions(),page.filters,new Map(),{displayInputs:()=>inputs,now:()=>now});
  const stream=orchestrate(page,{fetchData},state,undefined,undefined,{displayInputs:()=>inputs,now});
  let snapshot:DataSnapshot|undefined;
  const stop=stream.subscribe(snapshots=>{snapshot=snapshots.get('comparison');});
  await vi.waitFor(()=>expect(fetchData).toHaveBeenCalledTimes(3));
  first=false;inputs={...inputs,periods:{'sales-through':{status:'ready',granularity:'date',latest:'2026-10-29'}}};
  state.refreshContext();
  await vi.waitFor(()=>expect(snapshot).toMatchObject({status:'ready',rows:[{'current-sales':200}]}));
  release();await new Promise(resolve=>setTimeout(resolve,10));
  expect(snapshot).toMatchObject({status:'ready',rows:[{'current-sales':200}]});
  stop();
});
it('cancels comparison work when the runtime unsubscribes',async()=>{
  const page=fixture();let aborted=false;
  const fetchData=vi.fn<DataGateway['fetchData']>((_query,_context,signal)=>new Promise((_resolve,reject)=>{
    signal?.addEventListener('abort',()=>{aborted=true;reject(new DOMException('aborted','AbortError'));},{once:true});
  }));
  const stream=orchestrate(page,{fetchData},createFilterState(conditions(),page.filters),undefined,undefined,{displayInputs:()=>comparisonInputs,now});
  const stop=stream.subscribe(()=>{});
  await vi.waitFor(()=>expect(fetchData).toHaveBeenCalled());stop();
  await vi.waitFor(()=>expect(aborted).toBe(true));
});
it('exports the full union and preserves errors even with partial report export enabled',async()=>{
  const page=fixture(),preview=createPeriodComparisonPreview();
  const snapshots=await prepareExportSnapshots(page,preview.dataGateway,new Map(),conditions(),new AbortController().signal,undefined,2026,[],undefined,undefined,{displayInputs:comparisonInputs,now});
  expect(snapshots.get('comparison')).toMatchObject({status:'ready',totalCount:8});
  const failed=createPeriodComparisonPreview('error');
  const result=await prepareExportSnapshots(page,failed.dataGateway,new Map(),conditions(),new AbortController().signal,undefined,2026,[],undefined,undefined,{displayInputs:comparisonInputs,now,allowPartial:true});
  expect(result.get('comparison')?.status).toBe('error');
});
