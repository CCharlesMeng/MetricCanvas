import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {resolvePeriodSelection,type DataSnapshot,type EffectiveQuery,type Page} from '@metriccanvas/page/internal';
import {createSourceProgram,type FilterValue} from '@metriccanvas/data-execution/runtime';
import type {RuntimeDataGateway} from '../../runtime/src';
import business from '../../../../pages/temporary/business-result-pinned-diagnosis-20261102/business-result-metrics.json';

const now=new Date('2026-11-13T04:00:00Z');
function conditionsFor(page:Page) {
 const conditions=new Map<string,FilterValue>();
 for(const filter of page.filters??[]) {
  if(filter.type==='dimension'&&Array.isArray(filter.default))conditions.set(filter.id,{type:'dimension',dimension:filter.dimension,values:filter.default});
  if(filter.type==='boolean')conditions.set(filter.id,{type:'boolean',value:false});
 }
 conditions.set('region',{type:'dimension',dimension:'geo-pc-code',level:'geo',values:['全球']});
 return conditions;
}
function syntheticGateway(requests:EffectiveQuery[]):RuntimeDataGateway {
 return {
  async fetchData(query) {
   requests.push(query);
   const row=Object.fromEntries(Object.entries(query.fieldMappings).filter(([,field])=>'queryField' in field).map(([id,field])=>[id,field.type==='number'||field.type==='money'?10:id==='parent'?null:id==='value'?'all':'合成组织']));
   return {rows:[row],totalCount:1};
  },
  async fetchFilterCandidates(){return {kind:'values',candidates:[{value:'全球',label:'全球',level:'geo'}]};},
  async fetchDimensionValues(){return {kind:'values',candidates:[{value:'全球',label:'全球'}]};}
 };
}

it('renders the supplied business page with selection policies and only the matching chart change source',async()=>{
 const parsed=parsePage(business);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
 const page=parsed.page,before=structuredClone(page),requests:EffectiveQuery[]=[],conditions=conditionsFor(page);
 const program=createSourceProgram(page,{gateway:syntheticGateway(requests),now});
 try {
  for(const [mode,value,label] of [['month','2026-09','月'],['quarter','2026-Q3','季'],['year','2026','年']] as const) {
   conditions.set('mtime',{type:'timeRange',...resolvePeriodSelection({mode,value},now,'month')});
   requests.length=0;
   let snapshot:DataSnapshot|undefined;
   for await(const update of program.read({roots:['net-discount-trend'],conditions,freshness:'refresh'}))if(update.sourceId==='net-discount-trend')snapshot=update.snapshot;
   expect(snapshot).toMatchObject({status:'ready',rows:[{[`net-discount-${mode}-change`]:10,'net-discount-avg':10}]});
   const changes=requests.flatMap(query=>query.body.dsl_list.flatMap(item=>item.output_metrics??[])).filter(metric=>typeof metric==='string'&&metric.includes('变化'));
   expect(changes).toEqual([`净商务折扣（原价）${label}变化`]);
  }
  expect(page).toEqual(before);
 }finally{program.dispose();}
});
