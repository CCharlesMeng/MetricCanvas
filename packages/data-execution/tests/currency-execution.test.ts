import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {createSourceProgram} from '../src/source-program/session';
import {initialFilterValues} from '../src/filter-values';
import {composeEffectiveQuery} from '../src/effective-query';
const load=()=>{const result=parsePage(JSON.parse(readFileSync('pages/ioc-header-currency-demo.json','utf8')));if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;};
describe('currency execution boundary',()=>{
 it('uses currency as an implicit dependency and never rescales basic amounts',async()=>{
  const page=load(),values=initialFilterValues(page.filters??[]);values.set('currency',{type:'dimension',dimension:'currency_code',values:['USD']});values.set('amount',{type:'numberRange',from:1000000});
  const source=page.dataSources.main;if(source.source.type!=='query')throw Error();const query=composeEffectiveQuery({dataSource:{...source,source:{...source.source,type:'query'}},filters:page.filters},values,0,[],{});
  expect(query.filterValues).toContainEqual({target:'metricRange',metric:'ioc_amount_base_usd',from:1000000});
  const fetchData=vi.fn(async()=>({rows:[],totalCount:0}));const program=createSourceProgram(page,{gateway:{fetchData}});const captured=program.captureQueries(values,new Map(),new Map());expect(captured.get('main')?.filterValues).toEqual(query.filterValues);
  for await(const _ of program.read({roots:['main'],conditions:values,queries:captured})){}expect(fetchData).toHaveBeenCalledOnce();program.dispose();
 });
 it.each(['negative','equal','missing-currency','unknown-currency'])( 'blocks %s before old seeds/initial and still executes an independent root',async(kind)=>{
  const page=load(),values=initialFilterValues(page.filters??[]);
  if(kind==='negative')values.set('amount',{type:'numberRange',from:-1});if(kind==='equal')values.set('amount',{type:'numberRange',from:1,to:1});
  if(kind==='missing-currency')values.delete('currency');if(kind==='unknown-currency')values.set('currency',{type:'dimension',dimension:'currency_code',values:['BAD']});
  const fetchData=vi.fn(async()=>({rows:[],totalCount:0}));const program=createSourceProgram(page,{gateway:{fetchData}}),updates=[];
  expect(program.initialSnapshots({roots:['main'],conditions:values}).get('main')).toEqual({status:'loading'});
  for await(const update of program.read({roots:['main','unbound'],conditions:values,seeds:new Map([['main',{status:'ready',rows:[]}]])}))updates.push(update);
  expect(fetchData).toHaveBeenCalledOnce();expect(updates.find(v=>v.sourceId==='main')).toMatchObject({candidateRejected:true,snapshot:{status:'error'}});program.dispose();
 });
});
