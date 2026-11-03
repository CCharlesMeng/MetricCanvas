import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {DataSnapshot, JoinAggregateOperator} from '@metriccanvas/page/internal';
import {applyComputation} from '../src/compute';
import {createSourceProgram} from '../src/source-program/session';
import {createGlobalBenchmarkPreview} from '../../../apps/playground/fixtures/global-benchmark';

const op:JoinAggregateOperator={op:'joinAggregate',source:'benchmark',keys:[],values:[{field:'average',output:'average',aggregate:'unique'}],onMissing:'null'};
const fixture=()=> {
  const result=parsePage(JSON.parse(readFileSync(new URL('../../../pages/capabilities/chart/chart-global-benchmark.json',import.meta.url),'utf8')));
  if(!result.ok)throw Error(JSON.stringify(result.errors));
  return result.page;
};
it('copies a scalar to every existing row, keeps identity/order/zero/null and does not invent rows',()=>{
  const rows=[{office:'B',actual:12},{office:'A',actual:20}];
  expect(applyComputation([op],rows,new Map([['benchmark',[{average:15}]]]))).toEqual(rows.map(row=>({...row,average:15})));
  expect(applyComputation([op],rows,new Map([['benchmark',[{average:0}]]]))[0].average).toBe(0);
  expect(applyComputation([op],rows,new Map([['benchmark',[{average:null}]]]))[0].average).toBeNull();
  expect(applyComputation([op],rows,new Map([['benchmark',[]]]))[0].average).toBeNull();
  expect(applyComputation([op],[],new Map([['benchmark',[{average:15}]]]))).toEqual([]);
  expect(rows[0]).not.toHaveProperty('average');
  expect(()=>applyComputation([op],rows,new Map([['benchmark',[{average:15},{average:15}]]]))).toThrow('重复');
});
it('keeps the global query independent of region and updates all values on shared month/site changes',async()=>{
  const preview=createGlobalBenchmarkPreview(),program=createSourceProgram(fixture(),{gateway:preview.dataGateway});
  const conditions=new Map([['dept',{type:'dimension' as const,dimension:'dept',values:['东区']}],['month',{type:'dimension' as const,dimension:'month',values:['2026-10']}],['site',{type:'dimension' as const,dimension:'site',values:['国内']}]]);
  let snapshot:DataSnapshot|undefined;
  for await(const update of program.read({roots:['offices'],conditions}))if(update.sourceId==='offices')snapshot=update.snapshot;
  expect(snapshot).toMatchObject({status:'ready',rows:[{office:'甲代表处',average:15},{office:'乙代表处',average:15}],totalCount:2});
  const benchmark=preview.requests.find(query=>!Object.hasOwn(query.fieldMappings,'office'))!;
  expect(benchmark.filterValues.some(value=>value.target==='dimension'&&value.queryField==='地区部')).toBe(false);
  conditions.set('month',{type:'dimension',dimension:'month',values:['2026-11']});
  for await(const update of program.read({roots:['offices'],conditions,purpose:'complete'}))if(update.sourceId==='offices')snapshot=update.snapshot;
  expect(snapshot).toMatchObject({status:'ready',rows:[{average:16},{average:16}]});
  program.dispose();
});
it.each(['error','duplicate','truncated','zeroTotal'])('propagates %s without publishing a fabricated scalar',async state=>{
  const preview=createGlobalBenchmarkPreview(state),gateway={fetchData:async(...args:Parameters<typeof preview.dataGateway.fetchData>)=>{
    const result=await preview.dataGateway.fetchData(...args);
    if(args[1]?.dataSourceIds?.includes('benchmark')&&state==='truncated')return {...result,totalCount:2};
    if(args[1]?.dataSourceIds?.includes('benchmark')&&state==='zeroTotal')return {...result,totalCount:0};
    return result;
  }};
  const program=createSourceProgram(fixture(),{gateway});
  let snapshot:DataSnapshot|undefined;
  for await(const update of program.read({roots:['offices'],conditions:new Map()}))if(update.sourceId==='offices')snapshot=update.snapshot;
  expect(snapshot?.status).toBe('error');
  program.dispose();
});
