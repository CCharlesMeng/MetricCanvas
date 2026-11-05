import {expect,it} from 'vitest';
import sample from '../../../../pages/capabilities/table/table-header-filter-defaults.json';
import {parsePage,resolvePageParams as resolveDocument,type PageDocument} from '@metriccanvas/page';
import {hasHeaderDefaults,type Page,type EffectiveQuery,type TableComponent,type TableQueryView} from '@metriccanvas/page/internal';
import {resolvePageParams} from '../src/page-params';
import {initializePageParams} from '@metriccanvas/data-execution/runtime';
import {createPageDataExecutor} from '@metriccanvas/data-execution';
import {orchestrate} from '../src/orchestrator';
import {createTableController} from '../../runtime-ui/src/table/controller';
import {executionSourceKey} from '../src/execution';

const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function document(remote=false){
  const raw=structuredClone(sample);
  raw.sections=raw.sections.filter(section=>section.id==='parameter-initialization');
  delete (raw as Partial<typeof raw>).filters;
  const decisions=raw.dataSources.decisions;
  raw.dataSources={decisions} as typeof raw.dataSources;
  if(remote){
    raw.sections[0].components=raw.sections[0].components.slice(0,1);
    Object.assign(decisions,{fields:{'record-id':{type:'string',role:'dimension',queryField:'编号'},'is-valid':{type:'string',role:'dimension',queryField:'是否有效意见'}},
      source:{type:'query',query:{language:'dqe',body:{dsl_list:[{output_dims:['编号','是否有效意见'],output_metrics:[],filter:{dims:[],metrics:[]},order:{offset:0,limit:2}}]}}}});
    Object.assign(raw.sections[0].components[0].props,{pagination:{mode:'query'}});
  }
  return raw;
}
function instance(search='',remote=false):{page:Page;table:TableComponent}{
  const parsed=parsePage(document(remote));if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const inputs=resolvePageParams(search,parsed.page.params??[]);if(inputs.missing.length)throw Error('missing');
  const page=initializePageParams(parsed.page,inputs.values),table=page.sections[0].components[0];
  if(table.type!=='table')throw Error('table');return {page,table};
}
const empty:TableQueryView={pageIndex:0,pageSize:2,sort:[],predicates:[]};
it('freezes repeated URL keys as initial input and gives local tables independent mutable views',()=>{
  const {page,table}=instance('?is-valid=是');
  const controller=createTableController(page,()=>null,()=>{});
  expect(controller.headers(table)).toEqual({'is-valid':{mode:'select',values:['是']}});
  controller.header(table,'is-valid',{mode:'select',values:['否']});
  expect(controller.headers(table)).toEqual({'is-valid':{mode:'select',values:['否']}});
  controller.header(table,'is-valid',null);controller.page(table,1);controller.syncColumns(table);
  expect(controller.headers(table)).toEqual({});
  const other=page.sections[0].components[1];if(other.type!=='table')throw Error('table');
  expect(controller.headers(other)).toEqual({'is-valid':{mode:'select',values:['是']}});
  controller.header(table,'is-valid',{mode:'select',values:['否','是']});
  expect(controller.headers(table)).toEqual({});
  controller.header(other,'is-valid',{mode:'select',values:['否','是']});
  const source=page.dataSources.decisions.source;if(source.type!=='inline')throw Error('inline');
  expect(controller.present(table,source.rows,true).rows).toHaveLength(4);
  expect(controller.present(other,source.rows,true).rows).toHaveLength(2);
  controller.dispose();
});
it.each(['','?is-valid=是&is-valid=否'])('optional absence or unrestricted full enum initializes empty: %s',search=>{
  const {page,table}=instance(search),controller=createTableController(page,()=>null,()=>{});
  expect(hasHeaderDefaults(table.props.columns)).toBe(true);expect(controller.headers(table)).toEqual({});controller.dispose();
});
it('puts initial predicates on the first request; clear, page, refresh and frozen complete reads do not reapply input',async()=>{
  const {page}=instance('?is-valid=是',true),queries:EffectiveQuery[]=[];
  const stream=orchestrate(page,{async fetchData(query){queries.push(query);return {rows:[],totalCount:0};}});
  const stop=stream.subscribe(()=>{});await flush();
  expect(queries).toHaveLength(1);expect(queries[0].tableFilters).toEqual([{target:'dimension',queryField:'是否有效意见',values:['是']}]);
  stream.setQueryHeaderFilters('decisions',{'is-valid':{mode:'select',values:['否']}});await flush();
  expect(queries.at(-1)?.tableFilters?.[0]).toMatchObject({values:['否']});
  stream.setQueryHeaderFilters('decisions',{});await flush();stream.setQueryPage('decisions',1);await flush();stream.refreshQuery('decisions');await flush();
  const views=stream.captureViews();expect(views.get('decisions')?.predicates).toEqual([]);
  for await (const _ of stream.getSourceProgram()!.read({roots:['decisions'],conditions:new Map(),views,purpose:'complete',freshness:'refresh'})) { /* frozen export read */ }
  expect(queries.at(-1)?.tableFilters).toBeUndefined();stop();
});
it('normalizes full enum before paged plan preparation and rejects invalid restored values',async()=>{
  const {page}=instance('?is-valid=是',true);
  const restored={...empty,predicates:[{field:'is-valid',op:'in' as const,values:['否','是']}]};
  const stream=orchestrate(page,{async fetchData(){return {rows:[],totalCount:0};}},undefined,undefined,undefined,{}, {},new Map([['decisions',restored]]));
  const stop=stream.subscribe(()=>{});await flush();expect(stream.getQueryView('decisions')?.predicates).toEqual([]);stop();
  const invalid=orchestrate(page,{async fetchData(){throw Error('must not query');}},undefined,undefined,undefined,{}, {},new Map([['decisions',{...empty,predicates:[{field:'is-valid',op:'in',values:['unknown']}]}]]));
  expect(()=>invalid.subscribe(()=>{})).toThrow('表头筛选值不合法');
});
it('never trusts an ordinary initial or receipt without view proof, even with absent input or empty restore',async()=>{
  const {page}=instance('',true);Object.assign(page.dataSources.decisions.source,{initial:{capturedAt:'2026-11-04T00:00:00Z',rows:[{'编号':'STALE','是否有效意见':'是'}],totalCount:1}});
  for(const execution of [undefined,{filters:new Map(),snapshots:new Map([['decisions',{status:'ready' as const,rows:[{'record-id':'STALE','is-valid':'是'}],totalCount:1}]]),sourceKeys:new Map([['decisions',executionSourceKey(page.dataSources.decisions)]])}]){
    let calls=0;const stream=orchestrate(page,{async fetchData(){calls++;return {rows:[],totalCount:0};}},undefined,undefined,execution,{}, {},new Map([['decisions',empty]]));
    const stop=stream.subscribe(()=>{});await flush();expect(calls).toBe(1);expect(stream.captureRawSnapshots().get('decisions')).toMatchObject({status:'empty'});stop();
  }
});
it.each([undefined,['是'],['是','否']])('headless execution shares initialization and never writes viewless ordinary results: %j',async value=>{
  const raw=document(true);if(value)Object.assign(raw.params.query.dimensions[0],{dim_value_list:value});
  const queries:EffectiveQuery[]=[];
  const output=await createPageDataExecutor({gateway:{async fetchData(query){queries.push(query);return {rows:[],totalCount:0};}}}).execute(raw as PageDocument);
  expect(queries).toHaveLength(1);expect(!!queries[0].tableFilters).toBe(value?.length===1);expect(output.dataSources.decisions.source).not.toHaveProperty('initial');
});
it('saved values seed once; explicit bad URL values never silently restore saved values',()=>{
  const raw=document();Object.assign(raw.params.query.dimensions[0],{dim_value_list:['是']});
  const resolved=resolveDocument(raw);expect(resolved.ok).toBe(true);
  for(const value of [[],['unknown'],['是','是'],[1],['["是"]']])expect(resolveDocument(raw,{'is-valid':value})).toMatchObject({ok:false});
  const parsed=parsePage(raw);if(!parsed.ok)throw Error('page');
  expect(resolvePageParams('?is-valid=',parsed.page.params??[]).missing).toEqual(['is-valid']);
  const inputs=resolvePageParams('?is-valid=unknown',parsed.page.params??[]);expect(()=>initializePageParams(parsed.page,inputs.values)).toThrow('表头参数初值');
});
it('invalidates a combination initial when a header-only parameter changes',()=>{
  const raw=document(true);const resolved=resolveDocument(raw,{'is-valid':['否']});expect(resolved.ok).toBe(true);
  if(resolved.ok)expect(resolved.resolvedPage.params?.[0].value).toEqual(['否']);
});
it('gates a parameter-bearing pending column even when optional input is absent',async()=>{
  const {page,table}=instance('',true),column=table.props.columns[1];if(column.kind==='group')throw Error('column');
  column.visibleWhen={fact:'ready',op:'eq',value:true};
  let ready=false,calls=0;
  const stream=orchestrate(page,{async fetchData(){calls++;return {rows:[],totalCount:0};}},undefined,undefined,undefined,{displayInputs:()=>({permissionRevision:'1',permissions:{},values:{ready:ready?{status:'ready',value:true}:{status:'pending'}}})});
  const stop=stream.subscribe(()=>{});await flush();expect(calls).toBe(0);
  ready=true;stream.syncPresentation?.();await flush();expect(calls).toBe(1);expect(stream.getQueryView('decisions')?.predicates).toEqual([]);stop();
});
it('aborts initial parameter reads and discards their late responses after clear',async()=>{
  const {page}=instance('?is-valid=是',true);let finish:(result:{rows:[];totalCount:number})=>void=()=>{};
  const first=new Promise<{rows:[];totalCount:number}>(resolve=>finish=resolve);let calls=0,signal:AbortSignal|undefined;
  const stream=orchestrate(page,{async fetchData(_query,_diagnostics,requestSignal){calls++;if(calls===1){signal=requestSignal;return first;}return {rows:[],totalCount:0};}});
  const stop=stream.subscribe(()=>{});await flush();stream.setQueryHeaderFilters('decisions',{});await flush();expect(signal?.aborted).toBe(true);
  finish({rows:[],totalCount:0});await flush();expect(stream.getQueryView('decisions')?.predicates).toEqual([]);expect(stream.captureRawSnapshots().get('decisions')).toMatchObject({status:'empty'});stop();
});
it('normalizes a local select commit without discarding another column draft',()=>{
  const {page,table}=instance('?is-valid=是');page.dataSources.decisions.fields.amount={type:'number',role:'measure'};
  table.props.columns.push({field:'amount',filterable:{mode:'numberRange'}});
  const controller=createTableController(page,()=>null,()=>{});
  controller.header(table,'amount',{mode:'numberRange',from:'invalid',to:''});
  controller.header(table,'is-valid',{mode:'select',values:['是','否']});
  expect(controller.headers(table)).toEqual({});
  expect(controller.render(table).headerFilters).toEqual({amount:{mode:'numberRange',from:'invalid',to:''}});
  controller.dispose();
});
