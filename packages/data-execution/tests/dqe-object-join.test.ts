import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {EffectiveQuery,JsonObject} from '@metriccanvas/page/internal';
import {restrictKeys} from '../src/paged-join/member-query';
import {createSourceProgram,defaultSourceView} from '../src/source-program/session';
import {initialFilterValues} from '../src/filter-values';
import {officeGateway} from './fixtures/office-gateway';

it('intersects static object key constraints before binding joined keys',()=>{
 const query:EffectiveQuery={language:'dqe',body:{dsl_list:[{query_type:'object',object_type:'Demo',filter:{fields:[{field_name:'key',value_list:['A'],operator:'='}]}}]},fieldMappings:{},filterValues:[]};
 expect(restrictKeys(query,'key',['A','B'])).toEqual(['A']);
 expect(query.filterValues).toEqual([{target:'dimension',queryField:'key',values:['A']}]);
 (query.body.dsl_list[0].filter as JsonObject).fields=[{field_name:'key',value_list:['A'],operator:'contains'}];
 expect(()=>restrictKeys(query,'key',['A','B'])).toThrow('无法安全求交集');
});
function objectJoinPage(){
 const page=JSON.parse(readFileSync('packages/page/fixtures/contract-valid/paged-join-page.json','utf8'));page.schemaVersion='6.55';
 for(const source of Object.values(page.dataSources) as any[]){
  if(source.source.type!=='query')continue;
  const query=source.source.query,item=query.body.dsl_list[0];
  query.body.dsl_list[0]={query_type:'object',object_type:'Demo/Offices',output_fields:Object.values(source.fields).flatMap((field:any)=>field.queryField?[field.queryField]:[]),filter:{fields:[]},order:{}};
  query.filterBindings.period={target:'time',queryField:'office_period',valueFormat:'compact'};
 }
 const parsed=parsePage(page);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));return parsed.page;
}
it('collects capped object member responses before joined projection and keeps global pagination',async()=>{
 const page=objectJoinPage(),base=officeGateway(),calls:EffectiveQuery[]=[];
 const program=createSourceProgram(page,{gateway:{async fetchData(query){
  calls.push(structuredClone(query));const result=await base.fetchData(query);
  if(!query.pagination)return {...result,rows:result.rows.slice(0,2)};
  return result;
 }}});
 const results=[];for await(const result of program.read({roots:['office-overview'],conditions:initialFilterValues(page.filters??[]),views:new Map([['office-overview',defaultSourceView(page,'office-overview')]])}))results.push(result);
 expect(results.at(-1)?.snapshot).toMatchObject({status:'ready',totalCount:8});
 expect(calls.some(query=>query.pagination?.offset===0)).toBe(true);program.dispose();
});
