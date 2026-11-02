import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {dqeRecord} from '@metriccanvas/page/internal';
import {createSourceProgram,initialFilterValues} from '@metriccanvas/data-execution/runtime';
import business from '../../../../pages/temporary/business-result-pinned-diagnosis-20261102/business-result-metrics.json';
import {createBusinessResultPreview} from '../../../../apps/playground/fixtures/business-result';
it('retains time-only department summaries and sends the selected department only to office summaries',async()=>{
 const parsed=parsePage(business);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
 const preview=createBusinessResultPreview();
 const conditions=initialFilterValues(parsed.page.filters??[]);
 const roots=Object.keys(parsed.page.dataSources).filter(id=>id.endsWith('summary'));
 const program=createSourceProgram(parsed.page,{gateway:preview.dataGateway});
 const snapshots=new Map();
 try{
  for await(const update of program.read({roots,conditions,useInitial:false}))snapshots.set(update.sourceId,update.snapshot);
  expect(snapshots.get('region-dept-summary')).toMatchObject({status:'ready',rows:[{'net-discount-rate':90}]});
  const firstCount=preview.requests.length;
  conditions.set('region',{type:'dimension',dimension:'region-dept-code',level:'region-dept',values:['CN-NORTH']});
  for await(const update of program.read({roots,conditions,useInitial:false}))snapshots.set(update.sourceId,update.snapshot);
  const changed=preview.requests.slice(firstCount);
  expect(changed).toHaveLength(3);
  for(const item of changed){
   expect(item.output_dims).toEqual([]);
   expect(dqeRecord(item.filter).time).toMatchObject({is_aggregate:true});
   expect(dqeRecord(item.filter).dims).toContainEqual({dim_name:'region_dept_code',dim_value_list:['CN-NORTH']});
  }
  expect(snapshots.get('region-dept-summary')).toMatchObject({status:'ready',rows:[{'net-discount-rate':90}]});
  expect(snapshots.get('rep-office-summary')).toMatchObject({status:'ready',rows:[{'net-discount-rate':87}]});
  expect(snapshots.get('rep-office-commercial-summary')).toMatchObject({status:'ready',rows:[{'commercial-closure-rate':91}]});
  expect(snapshots.get('rep-office-contract-summary')).toMatchObject({status:'ready',rows:[{'contract-closure-rate':83}]});
  const beforeTime=preview.requests.length;
  conditions.set('mtime',{type:'timeRange',from:'2026-10',to:'2026-10'});
  for await(const update of program.read({roots,conditions,useInitial:false}))snapshots.set(update.sourceId,update.snapshot);
  const timed=preview.requests.slice(beforeTime);expect(timed).toHaveLength(6);
  for(const item of timed)expect(dqeRecord(item.filter).time).toMatchObject({start:'2026-10',end:'2026-10',is_aggregate:true});
 }finally{program.dispose();}
});
