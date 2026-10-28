import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {DataSnapshot,JsonObject,TableQueryView} from '@metriccanvas/page/internal';
import {createDqeGateway,effectiveDqeItem} from '../src/dqe/dqe';
import {createSourceProgram,defaultSourceView,initialFilterValues} from '../src/runtime';
import {compilePagedJoin} from '../src/paged-join/plan';
import {memberQuery} from '../src/paged-join/member-query';
import {recordReadOrder} from '../src/paged-join/record-rows';
import {executeDqeItem} from '../../../tools/dqe-sim/src/execute';

const root='approval-overview';
function load(){
  const result=parsePage(JSON.parse(readFileSync('pages/capabilities/query/object-record-join-demo.json','utf8')));
  if(!result.ok)throw Error(JSON.stringify(result.errors));
  return result.page;
}
function setup(fault?:'truncated'|'changed-total'){
  const page=load(),requests:JsonObject[]=[];
  const fetchImpl=vi.fn<typeof fetch>(async(_url,init)=>{
    const items:JsonObject[]=JSON.parse(String(init?.body)).dsl_list;
    requests.push(...items);
    return Response.json({retCode:'CBC.0000',results:items.map(item=>{
      const result=executeDqeItem(item);
      if(item.query_type==='object'&&Number((item.order as JsonObject).offset)>0){
        if(fault==='truncated')result.data=result.data.slice(1);
        if(fault==='changed-total')result.total_count++;
      }
      return result;
    })});
  });
  const program=createSourceProgram(page,{gateway:createDqeGateway({fetchImpl})});
  const conditions=initialFilterValues(page.filters??[]);
  async function read(patch:Partial<TableQueryView>={},complete=false){
    let snapshot:DataSnapshot|undefined;
    for await(const update of program.read({roots:[root],conditions,views:new Map([[root,{...defaultSourceView(page,root),...patch}]]),purpose:complete?'complete':'screen'}))snapshot=update.snapshot;
    if(!snapshot)throw Error('missing snapshot');
    return snapshot;
  }
  return {page,program,conditions,requests,read};
}
function rows(snapshot:DataSnapshot){
  if(snapshot.status!=='ready')throw Error(JSON.stringify(snapshot));
  return snapshot.rows;
}

it('sends object record batches through the default DQE encoder and preserves repeated businesses and supplements',async()=>{
  const test=setup();
  try{
    const snapshot=await test.read({},true),all=rows(snapshot);
    expect(snapshot).toMatchObject({totalCount:24});
    expect(all).toHaveLength(24);
    expect(new Set(all.map(row=>row.business)).size).toBe(12);
    expect(new Set(all.map(row=>row['row-id'])).size).toBe(24);
    expect(all.filter(row=>row.business==='B003')).toEqual(expect.arrayContaining([
      expect.objectContaining({record:'R005',contract:3000}),expect.objectContaining({record:'R006',contract:3000})
    ]));
    const main=test.requests.filter(item=>item.query_type==='object');
    expect(main.map(item=>(item.order as JsonObject).offset)).toEqual([0,5,10,15,20]);
    expect(main.every(item=>(item.order as JsonObject).order_by_field==='商务编号'&&(item.order as JsonObject).by===undefined)).toBe(true);
    expect(main[0].filter).toEqual({fields:expect.arrayContaining([
      {field_name:'特价审批通过时间',operator:'>=',value_list:['2025-01-01 00:00:00']},
      {field_name:'特价审批通过时间',operator:'<=',value_list:['2025-01-31 23:59:59']}
    ])});
    expect(test.requests.filter(item=>item.query_type!=='object')).toHaveLength(3);
  }finally{test.program.dispose();}
});

it('keeps global paging, search, header filters, sorting and complete export on the joined records',async()=>{
  const test=setup();
  try{
    const first=rows(await test.read());
    expect(first.map(row=>row.record)).toEqual(['R024','R023','R022','R021','R020']);
    const requests=test.requests.length;
    expect(rows(await test.read({pageIndex:1}))[0].record).toBe('R019');
    expect(rows(await test.read({search:{fields:['business'],query:'B003'}}))).toHaveLength(2);
    expect(rows(await test.read({predicates:[{field:'contract',op:'gte',value:12000}]})).map(row=>row.record)).toEqual(['R024','R023']);
    expect(rows(await test.read({sort:[{field:'amount',direction:'asc'}]}))[0].record).toBe('R001');
    expect(rows(await test.read({},true))).toHaveLength(24);
    expect(test.requests).toHaveLength(requests);
  }finally{test.program.dispose();}
});

it('refreshes bound approval dates, region and amount without dropping the supplement',async()=>{
  const test=setup();
  try{
    await test.read();
    test.conditions.set('period',{type:'timeRange',from:'2025-02-01',to:'2025-02-28'});
    test.conditions.set('region',{type:'dimension',dimension:'object_region',values:['东区']});
    test.conditions.set('amount',{type:'numberRange',from:2700});
    expect(rows(await test.read())).toMatchObject([{record:'R027',contract:14000}]);
    test.conditions.set('period',{type:'timeRange',from:'2025-03-01',to:'2025-03-31'});
    expect(await test.read()).toMatchObject({status:'empty',totalCount:0});
  }finally{test.program.dispose();}
});

it.each(['truncated','changed-total'] as const)('fails the full object join on %s instead of publishing partial records',async fault=>{
  const test=setup(fault);
  try{expect(await test.read()).toMatchObject({status:'error',error:{code:'DQE_ROW_CONTRACT_ERROR'}});}
  finally{test.program.dispose();}
});

it.each(['approval','basic'])('preserves explicit object ordering for the %s member without modifying the query',id=>{
  const page=load(),plan=compilePagedJoin(page,root,initialFilterValues(page.filters??[]),defaultSourceView(page,root));
  const query=memberQuery(plan,id);
  // The same ordering policy applies when an object query supplies supplemental columns.
  query.body.dsl_list[0]={query_type:'object',object_type:'Demo/Approval Details',output_fields:['审批记录ID'],order:{}};
  const before=structuredClone(query);
  expect(recordReadOrder(plan,id,query).sort).toEqual([{queryField:'商务编号',direction:'asc'}]);
  expect(query).toEqual(before);
  query.body.dsl_list[0].order={order_by_field:'审批记录ID',type:'desc'};
  expect(recordReadOrder(plan,id,query)).toBe(query);
  expect(effectiveDqeItem(query).order).toMatchObject({order_by_field:'审批记录ID',type:'desc'});
  query.sort=[{queryField:'审批记录ID',direction:'asc'}];
  expect(recordReadOrder(plan,id,query)).toBe(query);
  query.sort.push({queryField:'商务编号',direction:'asc'});
  expect(()=>effectiveDqeItem(recordReadOrder(plan,id,query))).toThrow('encodeObjectSort');
});
