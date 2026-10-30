import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {EffectiveQuery,JsonObject,TableQueryView} from '@metriccanvas/page/internal';
import type {ColumnCandidatesQuery} from '../src/ports';
import {objectColumnCandidates} from '../src/dqe/object-column-candidates';
import {createDqeGateway,effectiveDqeItem} from '../src/dqe';
import {createSourceProgram,defaultSourceView,initialFilterValues} from '../src/runtime';
import {createDqeSimServer,DQE_EXECUTE_PATH} from '../../../tools/dqe-sim/src/server';

const server=createDqeSimServer({logger:false});
let endpoint='';
beforeAll(async()=>{
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw Error('address');
  endpoint=`http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`;
});
afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});

function setup(){
  const parsed=parsePage(JSON.parse(readFileSync('pages/temporary/business-rejection-pagination-10/business-rejection-details-pagination-10.json','utf8')));
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page,requests:JsonObject[]=[];
  const gateway=createDqeGateway({endpoint,fetchImpl:async(url,init)=>{
    requests.push(...JSON.parse(String(init?.body)).dsl_list);
    return fetch(url,init);
  }});
  const program=createSourceProgram(page,{gateway});
  async function candidates(field:string,patch:Partial<TableQueryView>={}){
    return program.readColumnCandidates({sourceId:'rejection-details',field,conditions:initialFilterValues(page.filters??[]),
      view:{...defaultSourceView(page,'rejection-details'),...patch}});
  }
  return {program,requests,candidates};
}

it('uses canonical object arguments even without any conditions or ordering',()=>{
  const item=effectiveDqeItem({language:'dqe',body:{dsl_list:[{query_type:'object',object_type:'Example/Records',output_fields:['阶段名称']}]},
    fieldMappings:{stage:{type:'string',role:'dimension',queryField:'阶段名称'}},filterValues:[]});
  expect(item).toEqual({query_type:'object',object_type:'Example/Records',output_fields:['阶段名称'],filter:{fields:[]},order:{}});
});

it('preserves the user-confirmed object request parameter sample verbatim',()=>{
  const body=JSON.parse(readFileSync('packages/data-execution/fixtures/object-query-parameters.json','utf8'));
  const original=structuredClone(body);
  expect(effectiveDqeItem({language:'dqe',body,fieldMappings:{},filterValues:[]})).toEqual(original.dsl_list[0]);
  expect(body).toEqual(original);
});

it('returns both stages beyond the first ten records with a separate single-field object query',async()=>{
  const test=setup();
  try{
    expect(await test.candidates('approval-stage')).toEqual({kind:'values',totalCount:2,candidates:expect.arrayContaining([{value:'初审',label:'初审'},{value:'复审',label:'复审'}])});
    expect(test.requests).toHaveLength(1);
    expect(test.requests[0]).toMatchObject({query_type:'object',object_type:'Business/Commercial Review Rejection Details',output_fields:['阶段名称'],order:{}});
    expect(test.requests[0].order).toEqual({});
    expect(test.requests[0].filter).toEqual({fields:expect.arrayContaining([
      {field_name:'审批时间',value_list:['2026-09-01 00:00:00'],operator:'>='},
      {field_name:'审批时间',value_list:['2026-09-30 23:59:59'],operator:'<='}
    ])});
    expect(JSON.stringify(test.requests)).not.toContain('output_dims');
    expect(JSON.stringify(test.requests)).not.toContain('filter.metrics');
  }finally{test.program.dispose();}
});

function candidateRequest():ColumnCandidatesQuery {
  const query:EffectiveQuery={language:'dqe',body:{dsl_list:[{query_type:'object',object_type:'Example/Records',output_fields:['阶段名称','审批结果'],order:{offset:0,limit:10}}]},
    fieldMappings:{stage:{type:'string',role:'dimension',queryField:'阶段名称'},result:{type:'string',role:'dimension',queryField:'审批结果'}},filterValues:[]};
  return {query,field:'stage',queryField:'阶段名称',search:'',offset:0,limit:50};
}

it('deduplicates only complete projected values and applies independent candidate search and pagination',async()=>{
  const request={...candidateRequest(),search:'审',offset:1,limit:1},original=structuredClone(request);
  const result=await objectColumnCandidates(request,async query=>{
    expect(query.body.dsl_list[0].output_fields).toEqual(['阶段名称']);
    expect(query.body.dsl_list[0].order).toEqual({});
    expect(query.pagination).toBeUndefined();
    return {rows:[{stage:'复审'},{stage:'初审'},{stage:'复审'},{stage:null}],totalCount:4};
  });
  expect(result).toEqual({kind:'values',totalCount:2,candidates:[{value:'复审',label:'复审'}]});
  expect(request).toEqual(original);
});

it.each([undefined,0,2])('rejects incomplete projected candidates when total is %s',async totalCount=>{
  await expect(objectColumnCandidates(candidateRequest(),async()=>({rows:[{stage:'初审'}],totalCount}))).rejects.toMatchObject({code:'DQE_ROW_CONTRACT_ERROR'});
});

it('keeps empty results empty and propagates upstream failure without partial values',async()=>{
  expect(await objectColumnCandidates(candidateRequest(),async()=>({rows:[],totalCount:0}))).toEqual({kind:'values',totalCount:0,candidates:[]});
  await expect(objectColumnCandidates(candidateRequest(),async()=>{throw Object.assign(new Error('upstream'),{code:'DQE_TRANSPORT_ERROR'});})).rejects.toMatchObject({code:'DQE_TRANSPORT_ERROR'});
});

it('does not broaden fixed TopN and discards a response after cancellation',async()=>{
  const request=candidateRequest();
  request.query.body.dsl_list[0].order={limit:5};
  expect(await objectColumnCandidates(request,async()=>{throw Error('TopN must not read');})).toEqual({kind:'unavailable'});
  const controller=new AbortController();
  await expect(objectColumnCandidates(candidateRequest(),async()=>{
    controller.abort();return {rows:[{stage:'初审'}],totalCount:1};
  },undefined,controller.signal)).rejects.toMatchObject({code:'DQE_CANCELLED'});
});

it('retains the configured full-query fallback for a fixed object TopN',async()=>{
  const request=candidateRequest(),requests:JsonObject[]=[];
  request.query.body.dsl_list[0].order={limit:2};
  const gateway=createDqeGateway({columnCandidates:{mode:'fullQuery'},fetchImpl:async(_url,init)=>{
    requests.push(...JSON.parse(String(init?.body)).dsl_list);
    return Response.json({retCode:'CBC.0000',results:[{code:'SUCCESS',total_count:5,data:[{'阶段名称':'初审','审批结果':'驳回'},{'阶段名称':'复审','审批结果':'驳回'}]}]});
  }});
  expect(await gateway.fetchColumnCandidates?.(request)).toMatchObject({kind:'values',totalCount:2});
  expect(requests).toHaveLength(1);
  expect(requests[0].output_fields).toEqual(['阶段名称','审批结果']);
  expect(requests[0].order).toMatchObject({limit:2,offset:0});
});

it('honors an explicitly configured object projection cap without returning partial candidates',async()=>{
  await expect(objectColumnCandidates(candidateRequest(),async query=>{
    expect(query.body.dsl_list[0].order).toEqual({offset:0,limit:1});
    return {rows:[{stage:'初审'}],totalCount:2};
  },undefined,undefined,1)).rejects.toMatchObject({code:'DQE_CANDIDATE_LIMIT_EXCEEDED'});
  await expect(objectColumnCandidates(candidateRequest(),async()=>{throw Error('must not query');},undefined,undefined,0)).rejects.toMatchObject({code:'DQE_CONFIG_ERROR'});
});

it('removes only the current header condition and retains other-column conditions',async()=>{
  const test=setup();
  try{
    const predicates=[{field:'approval-stage',op:'in' as const,values:['初审']},{field:'approval-result',op:'in' as const,values:['驳回']}];
    expect(await test.candidates('approval-stage',{predicates})).toMatchObject({kind:'values',totalCount:2});
    const filter=test.requests[0].filter as JsonObject;
    expect(filter.fields).toContainEqual({field_name:'审批结果',value_list:['驳回'],operator:'='});
    expect(filter.fields).not.toContainEqual({field_name:'阶段名称',value_list:['初审'],operator:'='});
    expect(await test.candidates('approval-result')).toEqual({kind:'values',totalCount:1,candidates:[{value:'驳回',label:'驳回'}]});
  }finally{test.program.dispose();}
});
