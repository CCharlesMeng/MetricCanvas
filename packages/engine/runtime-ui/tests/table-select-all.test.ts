import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage,type EffectiveQuery,type TableComponent} from '@metriccanvas/page/internal';
import {orchestrate} from '../../runtime/src/orchestrator';
import {createTableController} from '../src/table/controller';
import {filterTableRowsByHeaders} from '../src/table/state';
import {prepareTableExport} from '../src/table/export/prepare';
function fixture(){
  const result=parsePage(JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/table-header-select-all.json',import.meta.url),'utf8')));
  if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;
}
it.each([0,1])('keeps all as display intent while queries and export are unrestricted: %s',async index=>{
  const page=fixture(),table=page.sections[0].components[index] as TableComponent,controller=createTableController(page,()=>null,()=>{});
  controller.header(table,'area',{mode:'select',values:['东区']});
  controller.header(table,'status',{mode:'select',values:['是','否','待定'],all:true});
  expect(controller.headers(table)).toEqual({area:{mode:'select',values:['东区']}});
  controller.page(table,1);controller.sort(table,[{field:'id',direction:'asc'}]);
  expect(controller.render(table).headerFilters.status).toMatchObject({all:true});
  const state={filters:new Map(),tables:{[table.id]:controller.render(table)},headerFilters:{[table.id]:controller.headers(table)},currentYear:2026};
  const result=await prepareTableExport({page,component:table,state,queries:new Map(),controller:new AbortController(),gateway:{async fetchData(){throw Error('inline must not query');}}});
  expect(result.main?.snapshot.rows.map(row=>row.id)).toEqual(['A','B','D']);expect(result.main?.snapshot.rows.map(row=>row.status)).toContain(null);
  controller.header(table,'status',{mode:'select',values:['是']});expect(controller.headers(table).status).toEqual({mode:'select',values:['是']});
  controller.header(table,'status',null);expect(controller.render(table).headerFilters.status).toBeUndefined();controller.dispose();
});
it('keeps null in a captured display state carrying all intent',()=>{
  expect(filterTableRowsByHeaders([{status:null},{status:'是'},{status:'待定'}],{status:{mode:'select',values:['是'],all:true}})).toHaveLength(3);
});
it('removes only the remote column predicate and keeps fixed business conditions',async()=>{
  const page=fixture(),table=page.sections[0].components[1] as TableComponent;
  page.sections=[{id:'only',components:[table]}];table.props.pagination={mode:'query'};
  const source=page.dataSources.records;
  source.fields=Object.fromEntries(Object.entries(source.fields).map(([name,field])=>[name,{...field,queryField:name}]));
  source.source={type:'query',query:{language:'dqe',body:{dsl_list:[{output_dims:['id','status','area'],output_metrics:[],filter:{dims:[{dim_name:'area',dim_value_list:['东区']}]},order:{offset:0,limit:2}}]}}};
  const queries:EffectiveQuery[]=[],stream=orchestrate(page,{async fetchData(query){queries.push(query);return {rows:[],totalCount:0};}});
  const stop=stream.subscribe(()=>{}),controller=createTableController(page,()=>stream,()=>{});
  await expect.poll(()=>queries.length).toBe(1);
  expect(queries[0].tableFilters?.[0]).toMatchObject({values:['是']});
  controller.header(table,'status',{mode:'select',values:['是','否','待定'],all:true});
  await expect.poll(()=>queries.length).toBe(2);
  expect(queries.at(-1)?.tableFilters).toBeUndefined();
  expect(queries.at(-1)?.body?.dsl_list[0].filter).toMatchObject({dims:[{dim_name:'area',dim_value_list:['东区']}]});
  controller.sort(table,[{field:'id',direction:'asc'}]);stream.refreshQuery('records');
  expect(controller.render(table).headerFilters.status).toMatchObject({all:true});
  expect(stream.getQueryView('records')?.predicates).toEqual([]);
  controller.dispose();stop();
});
