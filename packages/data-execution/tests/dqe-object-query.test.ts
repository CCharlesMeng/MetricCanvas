import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import { stableRowQuery, type EffectiveQuery, type JsonObject } from '@metriccanvas/page/internal';
import { createDqeGateway, effectiveDqeItem } from '../src/dqe/dqe';
import { composeEffectiveQuery } from '../src/effective-query';
import { initialFilterValues } from '../src/filter-values';
import { createSourceProgram, defaultSourceView } from '../src/source-program/session';
import { executeDqeItem } from '../../../tools/dqe-sim/src/execute';
const load=():Page=>{const result=parsePage(JSON.parse(readFileSync('pages/capabilities/query/dqe-object-query-demo.json','utf8')));if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;};
function composed(page=load()):EffectiveQuery {
  const dataSource=page.dataSources.records;if(dataSource.source.type!=='query')throw Error('source');
  return composeEffectiveQuery({dataSource:dataSource as any,filters:page.filters,pagination:{limit:5}},initialFilterValues(page.filters??[]),0,[],{});
}
function port() {
  const requests:JsonObject[][]=[];
  const fetchImpl=vi.fn<typeof fetch>(async(_url,init)=>{
    const items=JSON.parse(String(init?.body)).dsl_list;requests.push(items);
    return Response.json({retCode:'CBC.0000',results:items.map(executeDqeItem)});
  });
  return {gateway:createDqeGateway({fetchImpl}),requests,fetchImpl};
}
async function read(program:ReturnType<typeof createSourceProgram>,request:Parameters<typeof program.read>[0]) {
  const results=[];for await(const result of program.read(request))results.push(result);return results;
}

describe('object gateway and shared source execution',()=>{
  it('encodes bound dates, dimensions, number ranges and conjunctive table filters without changing metadata',()=>{
    const query=composed(),original=structuredClone(query.body);
    query.bindingValues=[...query.filterValues,{target:'dimension',queryField:'区域',values:['东区']},{target:'metricRange',metric:'审批金额',from:100,to:800}];
    query.tableFilters=[{target:'metricRange',metric:'审批金额',from:200},{target:'dimension',queryField:'区域',values:['西区']}];query.sort=[{queryField:'审批金额',direction:'desc'}];
    const item=effectiveDqeItem(query);
    expect(item.filter).toEqual({fields:expect.arrayContaining([{field_name:'区域',value_list:['东区'],operator:'='},{field_name:'区域',value_list:['西区'],operator:'='},{field_name:'审批金额',value_list:[200],operator:'>='}])});
    expect(item.order).toEqual({offset:0,limit:5,order_by_field:'审批金额',type:'desc'});
    expect(query.body).toEqual(original);expect(JSON.stringify(item)).not.toContain('output_dims');
    expect(executeDqeItem(item).total_count).toBe(0);
  });
  it('consumes the supplied columns:null object response through existing queryField normalization',async()=>{
    const response=JSON.parse(readFileSync('packages/data-execution/fixtures/object-query-response.json','utf8'));
    const query:EffectiveQuery={language:'dqe',body:{dsl_list:[{query_type:'object',object_type:'Business/Business Approval Details',output_fields:['商务编号']}]},fieldMappings:{business:{type:'string',role:'dimension',queryField:'商务编号'}},filterValues:[]};
    const gateway=createDqeGateway({fetchImpl:vi.fn<typeof fetch>(async()=>Response.json(response))});
    const result=await gateway.fetchData(query);expect(result.rows).toHaveLength(10);expect(result.totalCount).toBe(1393);expect(result.rows[0]).toEqual({business:'0CCI002410040L'});
  });
  it('paginates and exports every matching record while retaining repeated business ids',async()=>{
    const page=load(),{gateway,requests}=port(),program=createSourceProgram(page,{gateway}),conditions=initialFilterValues(page.filters??[]);
    const results=await read(program,{roots:['records'],conditions,purpose:'complete',completeSources:['records']});
    expect(results.at(-1)?.raw).toMatchObject({status:'ready',totalCount:24,rows:expect.any(Array)});
    const raw=results.at(-1)!.raw;if(raw.status!=='ready')throw Error('rows');
    expect(raw.rows).toHaveLength(24);expect(new Set(raw.rows.map(row=>row.business)).size).toBe(12);
    expect(requests.flat().map(item=>(item.order as JsonObject).offset)).toEqual([0,5,10,15,20]);program.dispose();
  });
  it('replaces the default January range with February and narrows by a table number range',async()=>{
    const page=load(),{gateway}=port(),program=createSourceProgram(page,{gateway}),conditions=initialFilterValues(page.filters??[]);
    conditions.set('period',{type:'timeRange',from:'2025-02-01',to:'2025-02-28'});
    const view={...defaultSourceView(page,'records'),predicates:[{field:'amount',op:'gte' as const,value:2700}]};
    const results=await read(program,{roots:['records'],conditions,views:new Map([['records',view]])});
    expect(results.at(-1)?.raw).toMatchObject({totalCount:2,rows:[{record:'R027'},{record:'R028'}]});program.dispose();
  });
  it('reuses full-result calculation and joins object rows to ordinary metric rows',async()=>{
    const page=load(),{gateway}=port(),program=createSourceProgram(page,{gateway}),conditions=initialFilterValues(page.filters??[]);
    const results=await read(program,{roots:['complete'],conditions});const result=results.find(result=>result.sourceId==='complete');
    expect(result?.snapshot).toMatchObject({status:'ready',totalCount:24,rows:expect.any(Array)});
    if(result?.snapshot.status!=='ready')throw Error('complete');expect(result.snapshot.rows[0]).toMatchObject({record:'R001',gap:25,contract:1000});program.dispose();
  });
  it('binds the current object page into metrics and metrics back into a complete object query',async()=>{
    const page=load(),{gateway}=port(),program=createSourceProgram(page,{gateway}),conditions=initialFilterValues(page.filters??[]);
    const results=await read(program,{roots:['linked','reverse'],conditions});
    expect(results.find(result=>result.sourceId==='linked')?.raw).toMatchObject({totalCount:3});
    expect(results.find(result=>result.sourceId==='reverse')?.raw).toMatchObject({totalCount:28});program.dispose();
  });
  it('requires a trusted encoder only for explicitly requested multi-sort',async()=>{
    const query={...composed(),sort:[{queryField:'审批金额',direction:'desc' as const},{queryField:'审批记录ID',direction:'asc' as const}]};
    expect(()=>effectiveDqeItem(query)).toThrow('encodeObjectSort');
    const fetchImpl=vi.fn<typeof fetch>(async()=>Response.json({retCode:'CBC.0000',results:[{code:'SUCCESS',data:[],total_count:0}]}));
    const gateway=createDqeGateway({fetchImpl,encodeObjectSort:(item,sort)=>({...item,approved_sort:sort})});
    await gateway.fetchData(query);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).dsl_list[0].approved_sort).toEqual(query.sort);
    expect(stableRowQuery({...composed(),sort:[query.sort[0]]},'record').sort).toEqual([query.sort[0]]);
  });
  it('rejects excess counts during complete reads instead of returning a partial result',async()=>{
    const page=load(),fetchImpl=vi.fn<typeof fetch>(async()=>Response.json({retCode:'CBC.0000',results:[{code:'SUCCESS',total_count:1,data:[{'审批记录ID':'R1','商务编号':'B1','特价审批通过时间':'2025-01-01 12:00:00','区域':'东区','审批金额':1,'预算金额':2},{'审批记录ID':'R2','商务编号':'B2','特价审批通过时间':'2025-01-01 12:00:00','区域':'东区','审批金额':1,'预算金额':2}]}]}));
    const program=createSourceProgram(page,{gateway:createDqeGateway({fetchImpl})});
    await expect(read(program,{roots:['records'],conditions:initialFilterValues(page.filters??[]),purpose:'complete',completeSources:['records'],allowPartial:true})).rejects.toMatchObject({code:'EXPORT_INCOMPLETE_DATA'});program.dispose();
  });
});

it('keeps object context and excludes only the current header in candidate requests',async()=>{
  const page=load(),calls:import('../src/ports').ColumnCandidatesQuery[]=[];
  const program=createSourceProgram(page,{gateway:{fetchData:async()=>({rows:[]}),fetchColumnCandidates:async request=>{calls.push(request);return {kind:'values',candidates:[],totalCount:0};}}});
  const view={...defaultSourceView(page,'records'),predicates:[{field:'business',op:'in' as const,values:['B001']},{field:'amount',op:'gte' as const,value:500}]};
  await program.readColumnCandidates({sourceId:'records',field:'business',conditions:initialFilterValues(page.filters??[]),view});
  expect(calls[0].query.body.dsl_list[0].object_type).toBe('Demo/Approval Details');
  expect(calls[0].query.tableFilters).toEqual([{target:'metricRange',metric:'审批金额',from:500}]);
  expect(calls[0].query.pagination).toBeUndefined();program.dispose();
});

it('clears a bound date without restoring literal January conditions',async()=>{
 const page=load(),{gateway}=port(),program=createSourceProgram(page,{gateway}),conditions=initialFilterValues(page.filters??[]);
 conditions.delete('period');const results=await read(program,{roots:['records'],conditions});
 expect(results.at(-1)?.raw).toMatchObject({totalCount:28});program.dispose();
});
it('formats a same-field date header with the explicit object timestamp boundaries',()=>{
 const query=composed();query.bindingValues=query.filterValues;
 query.tableFilters=[{target:'dimensionRange',queryField:'特价审批通过时间',from:'2025-01-01',to:'2025-01-01'}];
 expect(executeDqeItem(effectiveDqeItem(query))).toMatchObject({total_count:1,data:[{'审批记录ID':'R001'}]});
});
