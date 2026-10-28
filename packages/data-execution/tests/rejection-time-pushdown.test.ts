import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {dqeDimensionConditions} from '@metriccanvas/page/internal';
import type {DataSnapshot,EffectiveQuery,JsonObject,Page,Row} from '@metriccanvas/page/internal';
import {effectiveDqeItem,createDqeGateway} from '../src/dqe/dqe';
import {createSourceProgram,initialFilterValues} from '../src/runtime';
import {rejectionRows} from '../../../apps/playground/fixtures/rejection-details/gateway';
import {compilePagedJoin} from '../src/paged-join/plan';
import {memberQuery} from '../src/paged-join/member-query';
import {recordReadOrder} from '../src/paged-join/record-rows';

it.each([
  ['2024-02','2024-02','datetime','2024-02-01 00:00:00','2024-02-29 23:59:59'],
  ['2026-09-01','2026-09-02','iso','2026-09-01','2026-09-02'],
  ['2026-09','2026-09','compact','20260901','20260930']
] as const)('encodes explicit calendar field %s to %s as %s', (from,to,valueFormat,start,end)=>{
  const query:EffectiveQuery={language:'dqe',body:{dsl_list:[{output_dims:['审批完成时间'],output_metrics:[],filter:{dims:[{dim_name:'区域',dim_value_list:['东区']}],metrics:[]}}]},fieldMappings:{},filterValues:[{target:'time',queryField:'审批完成时间',valueFormat,value:{from,to}}]};
  const original=structuredClone(query);
  expect(effectiveDqeItem(query).filter).toEqual({dims:[{dim_name:'区域',dim_value_list:['东区']},{dim_name:'审批完成时间',dim_value_list:[start],operator:'>='},{dim_name:'审批完成时间',dim_value_list:[end],operator:'<='}],metrics:[]});
  expect(query).toEqual(original);
});

function businessPage():Page {
  const document=JSON.parse(readFileSync('pages/business-rejection-details.json','utf8'));
  const result=parsePage(document);if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;
}
function inPeriod(row:Row,conditions:JsonObject[]):boolean {
  return conditions.every(condition=>{
    const value=(condition.dim_value_list as string[])[0];
    return condition.operator==='>=' ? String(row['biz-approve-time'])>=value : String(row['biz-approve-time'])<=value;
  });
}
function responseFor(item:JsonObject,page:Page,requests:JsonObject[]):JsonObject {
  requests.push(item);
  const isMain=((item.output_fields??item.output_dims) as string[]).includes('审批完成时间');
  const definition=page.dataSources[isMain?'rejection-details':'business-basic'];
  const conditions=dqeDimensionConditions(item);
  const period=conditions.filter(condition=>condition.dim_name==='审批完成时间');
  const raw=rejectionRows(12),order=item.order as {offset:number;limit:number};
  if(isMain&&!period.length)return {code:'SUCCESS',total_count:1299225,data:Array.from({length:order.limit},()=>Object.fromEntries(Object.entries(definition.fields).map(([id,field])=>[('queryField' in field)?field.queryField:id,raw[0][id]])))};
  const records=isMain?raw.filter(row=>inPeriod(row,period)):[...new Map(raw.map(row=>[row['biz-id'],row])).values()];
  const keys=conditions.find(condition=>condition.dim_name==='商务ID')?.dim_value_list as string[]|undefined;
  const filtered=keys?records.filter(row=>keys.includes(String(row['biz-id']))):records;
  return {code:'SUCCESS',total_count:filtered.length,data:filtered.slice(order.offset,order.offset+order.limit).map(row=>Object.fromEntries(Object.entries(definition.fields).map(([id,field])=>[('queryField' in field)?field.queryField:id,row[id]])))};
}
it.each(['metric','object'])('filters %s approvals before the record budget and keeps basic information unbound',async kind=>{
  const page=businessPage(),requests:JsonObject[]=[];
  const source=page.dataSources['rejection-details'].source;
  if(source.type!=='query')throw Error('query');
  const item=source.query.body!.dsl_list[0],fields=item.output_dims??item.output_fields;
  source.query.body!.dsl_list[0]=kind==='object'
    ?{query_type:'object',object_type:'Business/Commercial Review Rejection Details',output_fields:fields,filter:{fields:[]},order:{}}
    :{output_dims:fields,output_metrics:[],filter:{dims:[],metrics:[]},order:{}};
  const fetchImpl=vi.fn<typeof fetch>(async(_url,init)=>Response.json({retCode:'CBC.0000',results:JSON.parse(String(init?.body)).dsl_list.map((item:JsonObject)=>responseFor(item,page,requests))}));
  const program=createSourceProgram(page,{gateway:createDqeGateway({fetchImpl})});
  try{
    let snapshot:DataSnapshot|undefined;
    for await(const update of program.read({roots:['rejection-overview'],conditions:initialFilterValues(page.filters??[])}))snapshot=update.snapshot;
    expect(snapshot).toMatchObject({status:'ready',totalCount:12});
    if(snapshot?.status!=='ready')throw Error('records');
    expect(snapshot.rows.filter(row=>row['biz-id']==='B-00001')).toEqual(expect.arrayContaining([
      expect.objectContaining({'approval-stage':'初审','biz-owner-name':'测试责任人1','life-status':'已关闭'}),
      expect.objectContaining({'approval-stage':'复审','biz-owner-name':'测试责任人1','life-status':'已关闭'})
    ]));
    expect(requests).toHaveLength(2);
    expect(requests[0].order).toMatchObject({order_by_field:'商务ID',type:'asc'});
    const main=dqeDimensionConditions(requests[0]);
    expect(main).toContainEqual(expect.objectContaining({dim_name:'审批完成时间',operator:'>=',dim_value_list:['2026-09-01 00:00:00']}));
    expect(main).toContainEqual(expect.objectContaining({dim_name:'审批完成时间',operator:'<=',dim_value_list:['2026-09-30 23:59:59']}));
    expect(JSON.stringify(requests[1].filter)).not.toContain('审批完成时间');
    const august=initialFilterValues(page.filters??[]);august.set('mtime',{type:'timeRange',from:'2026-08',to:'2026-08'});
    for await(const update of program.read({roots:['rejection-overview'],conditions:august}))snapshot=update.snapshot;
    expect(snapshot).toMatchObject({status:'empty',totalCount:0});
    expect(requests).toHaveLength(3);
  }finally{program.dispose();}
});
it('preserves explicit record source ordering and otherwise requests one association key',()=>{
  const page=businessPage();
  const plan=compilePagedJoin(page,'rejection-overview',initialFilterValues(page.filters??[]),{pageIndex:0,pageSize:10,sort:[],predicates:[]});
  const query=memberQuery(plan,'rejection'),before=structuredClone(query);
  expect(recordReadOrder(plan,'rejection',query).sort).toEqual([{queryField:'商务ID',direction:'asc'}]);
  expect(query).toEqual(before);
  query.sort=[{queryField:'审批完成时间',direction:'desc'}];
  expect(recordReadOrder(plan,'rejection',query)).toBe(query);
  delete query.sort;query.body.dsl_list[0].order={order_by_field:'审批完成时间',type:'DESC'};
  expect(recordReadOrder(plan,'rejection',query)).toBe(query);
});
it('keeps existing time slot behavior and requires both named field settings',()=>{
  const query:EffectiveQuery={language:'dqe',body:{dsl_list:[{filter:{time:{period:'month',is_aggregate:true}}}]},fieldMappings:{},filterValues:[{target:'time',value:{from:'2026-09',to:'2026-09'}}]};
  expect(effectiveDqeItem(query).filter).toEqual({time:{period:'month',is_aggregate:true,start:'2026-09',end:'2026-09'}});
  query.filterValues=[{target:'time',queryField:'审批完成时间',value:{from:'2026-09',to:'2026-09'}}];
  expect(()=>effectiveDqeItem(query)).toThrow('必须同时声明');
});
it('preserves stricter static approval predicates when adding the selected period',()=>{
  const query:EffectiveQuery={language:'dqe',body:{dsl_list:[{filter:{dims:[{dim_name:'审批完成时间',operator:'>=',dim_value_list:['2026-09-10 00:00:00']}]}}]},fieldMappings:{},filterValues:[{target:'time',queryField:'审批完成时间',valueFormat:'datetime',value:{from:'2026-09',to:'2026-09'}}]};
  const filter=effectiveDqeItem(query).filter as JsonObject;
  expect(filter.dims).toHaveLength(3);
  expect(filter.dims).toContainEqual({dim_name:'审批完成时间',operator:'>=',dim_value_list:['2026-09-10 00:00:00']});
});

it.each(['2026-02-30','2026-09-01T12:00'])('rejects invalid or unsupported calendar precision %s',value=>{
  const query:EffectiveQuery={language:'dqe',body:{dsl_list:[{}]},fieldMappings:{},filterValues:[{target:'time',queryField:'审批完成时间',valueFormat:'datetime',value:{from:value,to:value}}]};
  expect(()=>effectiveDqeItem(query)).toThrow('合法的日或月范围');
});
