import {initialFilterValues} from '../src/filter-values';
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {queryLeaves,type Page,type QueryDataSource} from '@metriccanvas/page/internal';
import {composeEffectiveQuery} from '../src/effective-query';
import {effectiveDqeItem} from '../src/dqe/dqe';
import {filterCandidatesRequest,candidateContextKey} from '../src/filter-candidates';
import {createSourceProgram} from '../src/source-program/session';
import type {FilterValue} from '../src/filter-values';
import {createKeyOfficePriorityGateway,prepareIocHeaderFilters,normalizeIocRegionCandidates} from '../../../apps/playground/fixtures/key-office-filter/gateway';
import {pageFilesById} from '../../../tools/scripts/page-files.mjs';

const raw=JSON.parse(readFileSync('pages/capabilities/filters/key-office-priority-demo.json','utf8'));
const selected=()=>new Map<string,FilterValue>([
 ['region',{type:'dimension',dimension:'demo_geo',level:'geo',values:['全球']}],
 ['mtime',{type:'timePoint',granularity:'month',value:'2026-04'}],
 ['customer-category',{type:'dimension',dimension:'customer-level',values:['战略']}]
]);
function pageOf(document:unknown=raw):Page {const p=parsePage(document);if(!p.ok)throw Error(JSON.stringify(p.errors));return p.page;}
function compose(page:Page,values=selected()){return composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources.offices as QueryDataSource},values,0,[],{});}

describe('IOC global Region is unrestricted',()=>{
 it('omits every Region predicate while preserving the selected node, month and customer',()=>{
  const page=pageOf(),values=selected(),query=compose(page,values);
  expect(effectiveDqeItem(query).filter).toEqual({dims:[{dim_name:'客户级别',dim_value_list:['战略']},{dim_name:'数据月份',dim_value_list:['202604']}],metrics:[]});
  expect(values.get('region')).toMatchObject({level:'geo',values:['全球']});
  values.set('key-office',{type:'boolean',value:true});expect(compose(page,values).filterValues).toContainEqual({target:'dimension',queryField:'重点国代',values:['true']});
 });
 it('keeps ordinary hierarchy geo filtering without an IOC header owner',()=>{
  const document=structuredClone(raw);delete document.iocHeader;
  const query=compose(pageOf(document));
  expect(query.filterValues).toContainEqual({target:'dimension',queryField:'全球编码',values:['全球']});
 });
 it.each(['中国','海外','R99','R77'])('retains the selected non-global geo predicate %s',value=>{
  const values=selected();values.set('region',{type:'dimension',dimension:'demo_geo',level:'geo',values:[value]});
  expect(compose(pageOf(),values).filterValues).toContainEqual({target:'dimension',queryField:'全球编码',values:[value]});
 });
 it('normalizes upstream global codes and parent references without changing China or overseas',()=>{
  const candidates=[{level:'geo',value:'WORLD',label:'全球'},{level:'geo',value:'R99',label:'中国'},{level:'geo',value:'R77',label:'海外'},{level:'office',value:'上海代表处',label:'上海代表处',parent:{level:'geo',value:'WORLD'}}];
  const normalized=normalizeIocRegionCandidates(candidates);
  expect(normalized.map(candidate=>candidate.value)).toEqual(['全球','R99','R77','上海代表处']);
  expect(normalized[3]?.parent?.value).toBe('全球');expect(candidates[0]?.value).toBe('WORLD');
 });
 it('rejects an unnormalized global code before any business query',async()=>{
  let requests=0;const base=createKeyOfficePriorityGateway(),gateway={...base,async fetchFilterCandidates(){return {kind:'values' as const,candidates:[{level:'geo',value:'WORLD',label:'全球'}]};},async fetchData(){requests++;return {rows:[],totalCount:0};}};
  const values=selected();values.set('region',{type:'dimension',dimension:'demo_geo',level:'geo',values:['WORLD']});
  const program=createSourceProgram(pageOf(),{gateway});
  const updates=[];for await(const update of program.read({roots:['offices'],conditions:values,purpose:'screen'}))updates.push(update);
  expect(JSON.stringify(updates)).toContain('DQE_CONFIG_ERROR');expect(requests).toBe(0);program.dispose();
 });
 it('shares unrestricted candidate scope without transmitting the global code',()=>{
  const page=pageOf(),filter={id:'candidate',type:'dimension' as const,dimension:'candidate',candidateContext:{filterIds:['region'],reconcile:'intersection' as const}};
  const values=selected(),empty=selected();empty.delete('region');
  expect(filterCandidatesRequest(filter,page.filters!,values,undefined,{page}).constraints.dimensions).toEqual({});
  expect(candidateContextKey(filter,page.filters!,values,{page})).toBe(candidateContextKey(filter,page.filters!,empty,{page}));
 });
 it('refreshes global initial rows, seeds and captured export predicates for screen and complete reads',async()=>{
  const document=structuredClone(raw);document.filters[0].defaultLevel='geo';document.filters[0].default=['全球'];
  document.dataSources.offices.source.initial={capturedAt:'2026-11-04T00:00:00Z',rows:[{'代表处':'南京代表处','金额':999,'客户级别':'卓越'}],totalCount:1};
  const requests:unknown[]=[];const gateway=createKeyOfficePriorityGateway((kind,request)=>{if(kind==='query')requests.push(request);});
  const prepared=await prepareIocHeaderFilters(document,gateway,{signal:new AbortController().signal}),page=pageOf(prepared),values=selected(),program=createSourceProgram(page,{gateway});
  expect(program.initialSnapshots({roots:['offices'],conditions:values}).get('offices')).toEqual({status:'loading'});
  const ordinary=structuredClone(document);delete ordinary.iocHeader;const stale=compose(pageOf(ordinary));
  const seeds=new Map([['offices',{status:'ready' as const,rows:[{office:'南京代表处',amount:999,customer:'卓越'}],totalCount:1}]]);
  for(const purpose of ['screen','complete'] as const)for await(const update of program.read({roots:['offices'],conditions:values,purpose,freshness:'refresh',seeds,queries:new Map([['offices',stale]]),useInitial:true}))expect(update.snapshot).toMatchObject({status:'ready',rows:[{office:'上海代表处'},{office:'广州代表处'}]});
  expect(requests).toHaveLength(2);for(const request of requests)expect((request as {filterValues:unknown}).filterValues).toEqual(compose(page,values).filterValues);
  program.dispose();
 });
 it('omits geo conditions in every global-enabled business query branch',async()=>{
  let branches=0;
  for(const [id,file] of pageFilesById('pages')){
   if(!file.includes('/business/dashboard/ioc/'))continue;
   const document=JSON.parse(readFileSync(file,'utf8'));
   if(!document.filters?.some((f:{id:string;hierarchy?:{id:string}[]})=>f.id==='region'&&f.hierarchy?.some(level=>level.id==='geo')))continue;
   const prepared=await prepareIocHeaderFilters(document,createKeyOfficePriorityGateway(),{signal:new AbortController().signal}),page=pageOf(prepared);
   for(const source of Object.values(page.dataSources)){
    if(source.source.type!=='query')continue;
    for(const leaf of queryLeaves(source.source.query)){
     const definition={...source,source:{...source.source,query:leaf}} as QueryDataSource;
     const values=initialFilterValues((page.filters??[]).filter(filter=>filter.type==='timeRange'||filter.type==='timePoint'));values.set('region',{type:'dimension',dimension:'geo-pc-code',level:'geo',values:['全球']});
     const query=composeEffectiveQuery({page,filters:page.filters,dataSource:definition},values,0,[],{});
     expect(query.filterValues.filter(value=>value.target==='dimension'),id).toEqual([]);branches++;
    }
   }
  }
  expect(branches).toBeGreaterThan(0);
 });
});
