import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {resolvePeriodSelection,type DataSnapshot,type QueryDataSource,type TableQueryView} from '@metriccanvas/page/internal';
import {createSourceProgram} from '../src/source-program/session';
import {composeEffectiveQuery} from '../src/effective-query';
import {effectiveDqeItem} from '../src/dqe/dqe';
import {evaluateTableView} from '../src/table-view';
import {joinAggregate} from '../src/compute/join-aggregate';
import {createPeriodComparisonPreview,comparisonInputs} from '../../../apps/playground/fixtures/period-comparison';
const now=new Date(2026,9,29);
function fixture(){const result=parsePage(JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/period-comparison/period-comparison-demo.json',import.meta.url),'utf8')));if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;}
const conditions=()=>new Map([['period',{type:'timeRange' as const,...resolvePeriodSelection({mode:'month',value:'2026-10'},now)}]]);
it('encodes the actual derived day range while preserving aggregation and the saved query',()=>{
  const page=fixture(),source=page.dataSources.previous as QueryDataSource,before=structuredClone(source);
  const query=composeEffectiveQuery({dataSource:source,filters:page.filters,displayInputs:comparisonInputs},conditions(),0,[],{});
  expect(effectiveDqeItem(query)).toMatchObject({filter:{time:{period:'day',start:'2026-09-01',end:'2026-09-28',is_aggregate:true}}});
  expect(source).toEqual(before);
});
it('computes all periods and historical-only objects before global sorting/filtering/paging',async()=>{
  const preview=createPeriodComparisonPreview(),page=fixture();
  const program=createSourceProgram(page,{gateway:preview.dataGateway,displayInputs:()=>comparisonInputs,now});
  let snapshot:DataSnapshot={status:'loading'};
  for await(const update of program.read({roots:['comparison'],conditions:conditions()}))if(update.sourceId==='comparison')snapshot=update.snapshot;
  expect(snapshot.status).toBe('ready');if(snapshot.status!=='ready')throw Error('comparison failed');
  const rows=snapshot.rows;
  expect(rows.find(row=>row.customer==='甲')).toMatchObject({'previous-growth':20,'year-ago-growth':50,'previous-rate-delta':10});
  expect(rows.find(row=>row.customer==='丁')).toMatchObject({'current-sales':0,'previous-growth':-100,'previous-rate-delta':null});
  expect(rows.find(row=>row.customer==='仅去年')).toMatchObject({'current-sales':0,'year-ago-growth':-100});
  expect(rows.find(row=>row.customer==='乙')).toMatchObject({'previous-growth':null});
  expect(rows.find(row=>row.customer==='新增')).toMatchObject({'previous-sales':0,'previous-growth':null});
  expect(rows.find(row=>row.customer==='丙')).toMatchObject({'current-rate':null,'previous-rate-delta':null});
  const view:TableQueryView={pageIndex:0,pageSize:2,sort:[{field:'previous-growth',direction:'desc'}],predicates:[]};
  expect(evaluateTableView(rows,view).rows[0].customer).toBe('末行');
  expect(evaluateTableView(rows,{...view,predicates:[{field:'previous-growth',op:'gte',value:100}]}).totalCount).toBe(2);
  expect(evaluateTableView(rows,view,true).rows).toHaveLength(8);
  const captured=program.captureQueries(conditions(),new Map(),new Map());
  expect(captured.get('previous')?.filterValues[0]).toMatchObject({value:{from:'2026-09-01',to:'2026-09-28'}});
  program.dispose();
});
it('never turns a failed comparison request into zero or a successful complete export',async()=>{
  const preview=createPeriodComparisonPreview('error'),program=createSourceProgram(fixture(),{gateway:preview.dataGateway,displayInputs:()=>comparisonInputs,now});
  for(const purpose of [undefined,'complete'] as const){
    let result:DataSnapshot|undefined;
    for await(const update of program.read({roots:['comparison'],conditions:conditions(),purpose,allowPartial:true}))if(update.sourceId==='comparison')result=update.snapshot;
    expect(result?.status).toBe('error');
  }
  program.dispose();
});
it('only replaces absent records, never explicit null or a failed/unknown value',()=>{
  const op={op:'joinAggregate' as const,source:'base',keys:[{local:'id',foreign:'id'}],values:[{field:'value',output:'prior',aggregate:'unique' as const,onMissing:'zero' as const}],onMissing:'null' as const};
  expect(joinAggregate(op,[{id:'absent'},{id:'null'},{id:'zero'}],[{id:'null',value:null},{id:'zero',value:0}])).toEqual([{id:'absent',prior:0},{id:'null',prior:null},{id:'zero',prior:0}]);
  expect(()=>joinAggregate(op,[{id:'x'}],[{id:'x',value:1},{id:'x',value:2}])).toThrow('重复');
});

it('keeps the signed denominator and leaves all zero denominators unknown',async()=>{
  const {applyComputation}=await import('../src/compute');
  const operators=[{op:'delta' as const,minuend:'current',subtrahend:'base',output:'delta'},{op:'ratio' as const,numerator:'delta',denominator:'base',output:'growth',scale:100 as const,onZeroDenominator:'null' as const}];
  const result=applyComputation(operators,[{current:-50,base:-100},{current:0,base:0},{current:100,base:0}]);
  expect(result.map(row=>row.growth)).toEqual([-50,null,null]);
});
