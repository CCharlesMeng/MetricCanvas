import {mount,unmount} from 'svelte';
import RuntimeView from '../../../packages/engine/runtime-ui/src/RuntimeView.svelte';
import type {RuntimeDataGateway} from '@metriccanvas/engine';
import type {DataRow,EffectiveQuery} from '@metriccanvas/page/internal';

function periodRows(id:string):DataRow[] {
  const key=id.startsWith('region-dept')?'region-dept-name':'rep-office-name';
  if(id.endsWith('year-ago'))return [{[key]:'正常','net-discount-rate':15},{[key]:'仅去年','net-discount-rate':10}];
  if(id.endsWith('previous'))return [{[key]:'正常','net-discount-rate':18}];
  return [{[key]:'正常','net-discount-rate':20},{[key]:'本期新增','net-discount-rate':12}];
}
function syntheticRows(id:string,query:EffectiveQuery):DataRow[] {
  if(id==='net-discount-global-average')return [{'net-discount-avg':16}];
  if(id.includes('decision-closure-rate'))return [];
  if(id.includes('net-discount-'))return periodRows(id);
  const rows=['正常','本期新增'].map(name=>Object.fromEntries(Object.entries(query.fieldMappings).map(([field,definition])=>[field,definition.role==='dimension'?name:20])));
  return rows;
}
/** Test-only adapter for the exact business document; no real service or fabricated page data. */
export function mountBusinessComparisonFixture(target:HTMLElement,document:unknown) {
  const requests:EffectiveQuery[]=[];
  const dataGateway:RuntimeDataGateway={
    async fetchFilterCandidates(){return {kind:'values',candidates:[{value:'GLOBAL',label:'全球',level:'geo'}]};},
    async fetchData(query,context){requests.push(structuredClone(query));const rows=syntheticRows(context!.dataSourceIds![0],query);return {rows,totalCount:rows.length};}
  };
  const snapshot={permissions:{},values:{},permissionRevision:'synthetic-business',timeZone:'Asia/Shanghai',periods:{'net-discount-through':{status:'ready' as const,granularity:'date' as const,latest:'2026-11-02'}}};
  const displayInputs={getSnapshot:()=>snapshot,subscribe(run:(value:typeof snapshot)=>void){run(snapshot);return ()=>{};}};
  const runtime=mount(RuntimeView,{target,props:{document,dataGateway,displayInputs}});
  return {requests,dispose:()=>unmount(runtime)};
}
