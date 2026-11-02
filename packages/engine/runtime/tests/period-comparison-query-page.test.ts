import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {resolvePeriodSelection,type DataSnapshot,type DisplayInputsSnapshot} from '@metriccanvas/page/internal';
import {createFilterState} from '../src/filter-state';
import {orchestrate} from '../src/orchestrator';
import {prepareExportSnapshots} from '../src/export-snapshots';
import type {DataGateway} from '../src/ports';
import {createQueryComparisonPreview} from '../../../../apps/playground/fixtures/query-comparison-gateway';
import {comparisonInputs} from '../../../../apps/playground/fixtures/period-comparison';

const now=new Date(2026,9,30);
function fixture(){const result=parsePage(JSON.parse(readFileSync(new URL('../../../../pages/capabilities/data/period-comparison/period-comparison-query-page.json',import.meta.url),'utf8')));if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;}
const conditions=()=>new Map([['period',{type:'timeRange' as const,...resolvePeriodSelection({mode:'month',value:'2026-10'},now)}]]);
function expectFirst(snapshot:DataSnapshot|undefined,customer:string){
  expect(snapshot).toMatchObject({status:'ready',totalCount:23});
  if(snapshot?.status==='ready')expect(snapshot.rows[0].customer).toBe(customer);
}

it('changes page while an old request ignores cancellation without mixing its receipts',async()=>{
  const page=fixture(),preview=createQueryComparisonPreview();let release!:()=>void,first=true,aborted=false;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const fetchData=vi.fn<DataGateway['fetchData']>(async(query,context,signal)=>{
    if(first){first=false;signal?.addEventListener('abort',()=>{aborted=true;});await pending;return preview.dataGateway.fetchData(query,context);}
    return preview.dataGateway.fetchData(query,context,signal);
  });
  const state=createFilterState(conditions(),page.filters),stream=orchestrate(page,{fetchData},state,undefined,undefined,{displayInputs:()=>comparisonInputs,now});
  let snapshot:DataSnapshot|undefined;const stop=stream.subscribe(values=>{snapshot=values.get('comparison');});
  try{
    await vi.waitFor(()=>expect(fetchData).toHaveBeenCalled());stream.setQueryPage('comparison',1);
    await vi.waitFor(()=>expectFirst(snapshot,'C000013'));
    release();await new Promise(resolve=>setTimeout(resolve,10));
    expect(aborted).toBe(true);expectFirst(snapshot,'C000013');
  }finally{release();stop();}
});
it('refreshes a paged comparison when the trusted cutoff changes without a selection change',async()=>{
  const page=fixture(),preview=createQueryComparisonPreview();let inputs:DisplayInputsSnapshot=structuredClone(comparisonInputs);
  const state=createFilterState(conditions(),page.filters,new Map(),{displayInputs:()=>inputs,now:()=>now});
  const stream=orchestrate(page,preview.dataGateway,state,undefined,undefined,{displayInputs:()=>inputs,now});
  let snapshot:DataSnapshot|undefined;const stop=stream.subscribe(values=>{snapshot=values.get('comparison');});
  try{
    await vi.waitFor(()=>expect(snapshot?.status).toBe('ready'));
    inputs={...inputs,periods:{'sales-through':{status:'ready',granularity:'date',latest:'2026-10-27'}}};state.refreshContext();
    await vi.waitFor(()=>expect(preview.calls.some(query=>query.filterValues.some(value=>value.target==='time'&&value.value.to==='2026-10-27'))).toBe(true));
    await vi.waitFor(()=>expect(snapshot).toMatchObject({status:'empty',totalCount:0}));
  }finally{stop();}
});
it('exports the entire main domain with calculations and refuses partial comparison export',async()=>{
  const page=fixture(),preview=createQueryComparisonPreview();
  const result=await prepareExportSnapshots(page,preview.dataGateway,new Map(),conditions(),new AbortController().signal,undefined,2026,[],undefined,undefined,{displayInputs:comparisonInputs,now});
  expect(result.get('comparison')).toMatchObject({status:'ready',totalCount:23});
  const snapshot=result.get('comparison');if(snapshot?.status!=='ready')throw Error('ready');
  expect(snapshot.rows).toHaveLength(23);expect(snapshot.rows[0]['previous-growth']).toBe(75);
  const failed=createQueryComparisonPreview('error');
  const incomplete=await prepareExportSnapshots(page,failed.dataGateway,new Map(),conditions(),new AbortController().signal,undefined,2026,[],undefined,undefined,{displayInputs:comparisonInputs,now,allowPartial:true});
  expect(incomplete.get('comparison')?.status).toBe('error');
});
