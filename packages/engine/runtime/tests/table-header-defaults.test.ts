import {expect,it} from 'vitest';
import sample from '../../../../pages/capabilities/table/table-header-filter-defaults.json';
import {parsePage,type Page} from '@metriccanvas/page';
import type {EffectiveQuery,TableComponent,TableQueryView,DisplaySnapshot} from '@metriccanvas/page/internal';
import {orchestrate} from '../src/orchestrator';
import {createTableController} from '../../runtime-ui/src/table/controller';
import {createTableSession} from '../src/table/session';
import {createPageDataExecutor} from '@metriccanvas/data-execution';
import {executionSourceKey} from '../src/execution';
import {createDqeGateway} from '@metriccanvas/data-execution/dqe';
import {initialFilterValues} from '@metriccanvas/data-execution/runtime';

const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(remote=false):{page:Page;table:TableComponent}{
  const raw=JSON.parse(JSON.stringify(sample));
  if(remote){
    raw.sections[2].components=raw.sections[2].components.slice(0,1);
    Object.assign(raw.dataSources.records,{fields:{id:{type:'string',role:'dimension',queryField:'编号'},status:{type:'string',role:'dimension',queryField:'状态'},code:{type:'number',role:'dimension',queryField:'编码'},region:{type:'string',role:'dimension',queryField:'区域'}},
      source:{type:'query',query:{language:'dqe',body:{dsl_list:[{output_dims:['编号','状态','编码','区域'],output_metrics:[],filter:{dims:[],metrics:[]},order:{order_by_field:'编号',type:'ASC',offset:0,limit:2}}]}}}});
    delete raw.sections[2].components[0].props.pagination;
  }
  const parsed=parsePage(raw);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const table=parsed.page.sections[2].components[0];
  if(table.type!=='table')throw Error('table fixture');
  return {page:parsed.page,table};
}
it('applies every selected default value while intersecting the other column default',()=>{
  const {page,table}=fixture(),column=table.props.columns[1],source=page.dataSources.records.source;
  if(column.kind==='group'||column.filterable?.mode!=='select'||source.type!=='inline')throw Error('select fixture');
  column.filterable.defaultValues=['pending','approved'];
  expect(parsePage({...page,params:sample.params}).ok).toBe(true);
  const controller=createTableController(page,()=>null,()=>{},()=>initialFilterValues(page.filters??[]));
  expect(controller.present(table,source.rows,true).rows.map(row=>row.id)).toEqual(['A001','A002','A003']);
  controller.dispose();
});
it('isolates local defaults, preserves numeric values and never resurrects cleared or hidden constraints',()=>{
  const {page,table}=fixture();
  let show=true;
  const controller=createTableController(page,()=>null,()=>{},()=>new Map([['show-status',{type:'dimension',dimension:'column-visibility',values:[show?'show':'hide']}]]));
  expect(controller.headers(table)).toEqual({status:{mode:'select',values:['pending']},code:{mode:'select',values:[1]}});
  const other=page.sections[2].components[1];if(other.type!=='table')throw Error('table');
  expect(controller.headers(other)).toEqual({status:{mode:'select',values:['approved']}});
  controller.header(table,'code',null);
  show=false;controller.syncColumns(table);
  show=true;controller.syncColumns(table);
  expect(controller.headers(table)).toEqual({});
  expect(controller.headers(other)).toEqual({status:{mode:'select',values:['approved']}});
  controller.dispose();
});
it('includes all defaults in the first request and keeps them through inferred pagination and refresh',async()=>{
  const {page}=fixture(true),requests:EffectiveQuery[]=[];
  const stream=orchestrate(page,{async fetchData(query){requests.push(query);return {rows:[{id:'A001',status:'pending',code:1,region:'华东'},{id:'A003',status:'pending',code:1,region:'华北'}],totalCount:6};}});
  const stop=stream.subscribe(()=>{});
  await flush();
  expect(requests).toHaveLength(1);
  expect(requests[0].tableFilters).toEqual([{target:'dimension',queryField:'状态',values:['pending']},{target:'dimension',queryField:'编码',values:[1]}]);
  expect(stream.getQueryPageSize('records')).toBe(2);
  stream.setQueryPage('records',1);await flush();
  expect(stream.getQueryView('records')?.predicates).toHaveLength(2);
  stream.setQueryHeaderFilters('records',{});await flush();
  stream.refreshQuery('records');await flush();
  expect(requests.at(-1)?.tableFilters).toBeUndefined();
  stop();
});
it('restores an explicitly empty view and resets to declaration defaults rather than restored user state',async()=>{
  const {page}=fixture(true),empty:TableQueryView={pageIndex:0,pageSize:2,sort:[],predicates:[]};
  const stream=orchestrate(page,{async fetchData(){return {rows:[],totalCount:0};}},undefined,undefined,undefined,{}, {},new Map([['records',empty]]));
  const stop=stream.subscribe(()=>{});await flush();
  expect(stream.getQueryView('records')?.predicates).toEqual([]);
  stop();
  const defaults={...empty,predicates:[{field:'status',op:'in' as const,values:['pending']}]};
  const session=createTableSession(empty,()=>{},value=>value,defaults);
  session.resetDefault();
  expect(session.snapshot()).toEqual(defaults);
});
it('gates pending default column facts and releases one correctly filtered first request',async()=>{
  const {page,table}=fixture(true),requests:EffectiveQuery[]=[];
  const column=table.props.columns[1];if(column.kind==='group')throw Error('field');
  column.visibleWhen={fact:'ready',op:'eq',value:true};
  Object.assign(page.dataSources.records.source,{initial:{capturedAt:'2026-11-03T00:00:00Z',rows:[{'编号':'STALE','状态':'approved','编码':2,'区域':'华南'}],totalCount:1}});
  let snapshot:DisplaySnapshot={permissionRevision:'1',permissions:{},values:{ready:{status:'pending'}}};
  const stream=orchestrate(page,{async fetchData(query){requests.push(query);return {rows:[],totalCount:0};}},undefined,undefined,undefined,{displayInputs:()=>snapshot});
  const stop=stream.subscribe(()=>{});await flush();expect(requests).toEqual([]);
  snapshot={...snapshot,values:{ready:{status:'ready',value:true}}};
  stream.syncPresentation?.();await flush();
  expect(requests).toHaveLength(1);expect(requests[0].tableFilters).toHaveLength(2);
  stream.setQueryHeaderFilters('records',{});await flush();stream.syncPresentation?.();await flush();
  expect(stream.getQueryView('records')?.predicates).toEqual([]);
  stop();
});
it('rejects shared remote consumers and dependency users before they can inherit table defaults',()=>{
  const {page,table}=fixture(true);
  page.sections[2].components.push({...table,id:'other-table'});
  expect(parsePage({...page,params:sample.params})).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({message:expect.stringContaining('必须独占')})])});
  page.sections[2].components.pop();
  page.dataSources.downstream=structuredClone(page.dataSources.records);
  Object.assign(page.dataSources.downstream.source,{query:{language:'dqe',body:{dsl_list:[{output_dims:['编号'],output_metrics:[]}]},resultBindings:[{source:'records',sourceField:'id',target:{type:'dimension',queryField:'编号'}}]}});
  expect(parsePage({...page,params:sample.params}).ok).toBe(false);
});
it('rejects an unmapped remote default field instead of silently showing an unfiltered result',()=>{
  const {page}=fixture(true);
  Reflect.deleteProperty(page.dataSources.records.fields.status,'queryField');
  expect(parsePage({...page,params:sample.params})).toMatchObject({ok:false,errors:expect.arrayContaining([expect.objectContaining({message:'远程默认筛选字段必须具有 queryField 映射'})])});
});
it('uses shared defaults in headless execution without serializing a filtered ordinary initial',async()=>{
  const {page}=fixture(true),queries:EffectiveQuery[]=[];
  const output=await createPageDataExecutor({gateway:{async fetchData(query){queries.push(query);return {rows:[],totalCount:0};}}}).execute({...page,params:sample.params});
  expect(queries).toHaveLength(1);expect(queries[0].tableFilters).toHaveLength(2);
  expect(output.dataSources.records.source).not.toHaveProperty('initial');
});
it('does not reuse an execution receipt without proof of the table view even after an empty restore',async()=>{
  const {page}=fixture(true),requests:EffectiveQuery[]=[];
  const receipt={filters:new Map(),snapshots:new Map([['records',{status:'ready' as const,rows:[{id:'STALE'}],totalCount:1}]]),sourceKeys:new Map([['records',executionSourceKey(page.dataSources.records)]])};
  const restored=new Map([['records',{pageIndex:0,pageSize:2,sort:[],predicates:[]}]]);
  const stream=orchestrate(page,{async fetchData(query){requests.push(query);return {rows:[],totalCount:0};}},undefined,undefined,receipt,{}, {},restored);
  const stop=stream.subscribe(()=>{});await flush();
  expect(requests).toHaveLength(1);expect(stream.captureRawSnapshots().get('records')).toMatchObject({status:'empty'});
  stop();
});
it('keeps successful-empty intersections empty without issuing an unbounded query',async()=>{
  const {page}=fixture(true),source=page.dataSources.records.source;
  if(source.type!=='query')throw Error('query');
  const body=source.query.body;if(!body)throw Error('ordinary query');
  body.dsl_list[0].filter={dims:[{dim_name:'状态',dim_value_list:['approved']}],metrics:[]};
  let calls=0;
  const gateway=createDqeGateway({fetchImpl:async()=>{calls++;throw Error('empty intersection must not issue HTTP');}});
  const stream=orchestrate(page,gateway);
  const stop=stream.subscribe(()=>{});await flush();
  expect(calls).toBe(0);expect(stream.captureRawSnapshots().get('records')).toMatchObject({status:'empty',totalCount:0});
  stop();
});
it('ignores a late first-default response after the user clears the selection',async()=>{
  const {page}=fixture(true);
  let finish:(value:{rows:{id:string;status:string;code:number;region:string}[];totalCount:number})=>void=()=>{};
  const initial=new Promise<{rows:{id:string;status:string;code:number;region:string}[];totalCount:number}>(resolve=>finish=resolve);
  let calls=0;
  const stream=orchestrate(page,{async fetchData(){calls++;return calls===1?initial:{rows:[],totalCount:0};}});
  const stop=stream.subscribe(()=>{});await flush();
  stream.setQueryHeaderFilters('records',{});await flush();
  finish({rows:[{id:'STALE',status:'pending',code:1,region:'华东'}],totalCount:1});await flush();
  expect(stream.getQueryView('records')?.predicates).toEqual([]);
  expect(stream.captureRawSnapshots().get('records')).toMatchObject({status:'empty'});
  stop();
});
it('keeps complete-query defaults local when the same complete result has multiple table consumers',()=>{
  const {page,table}=fixture();
  const source=page.dataSources.records.source;if(source.type!=='inline')throw Error('inline');
  Object.assign(page.dataSources.records,{fields:{id:{type:'string',role:'dimension',queryField:'编号'},status:{type:'string',role:'dimension',queryField:'状态'},code:{type:'number',role:'dimension',queryField:'编码'},region:{type:'string',role:'dimension',queryField:'区域'}},
    source:{type:'query',resultScope:'complete',query:{language:'dqe',body:{dsl_list:[{output_dims:['编号','状态','编码','区域'],output_metrics:[],order:{}}]}}}});
  expect(parsePage({...page,params:sample.params}).ok).toBe(true);
  const controller=createTableController(page,()=>null,()=>{},()=>new Map([['show-status',{type:'dimension',dimension:'column-visibility',values:['show']}] ]));
  expect(controller.headers(table)).toHaveProperty('status');
  controller.header(table,'status',null);
  const other=page.sections[2].components[1];if(other.type!=='table')throw Error('table');
  expect(controller.headers(other)).toEqual({status:{mode:'select',values:['approved']}});
  controller.dispose();
});
