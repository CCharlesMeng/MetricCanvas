import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { createFilterState, initializePageParams, loadExecution, orchestrate, prepareExecution, type ExecutionRequest } from '../src';
const fixtures = JSON.parse(readFileSync('docs/plan/authoring-tickets-126/t04-contract-examples.json','utf8'));
const scenario = (id: string) => structuredClone(fixtures.cases.find((c: any)=>c.id === id).steps[0]);
const flush = () => new Promise(r=>setTimeout(r,0));
for (const id of ['execute-success','execute-partial','execute-empty','execute-missing-source','execute-wrong-conditions','execute-no-access']) {
  it(`消费T04 ${id}`, async () => {
    const {request,response,expected} = scenario(id);
    if (expected.decision === 'reject') {
      expect(()=>prepareExecution(request,response)).toThrow(); return;
    }
    const bootstrap = prepareExecution(request,response);
    const parsed = parsePage(bootstrap.document); if (!parsed.ok) throw new Error('invalid fixture');
    const gateway = {fetchData: vi.fn(async()=>({rows:[]}))};
    const stream = orchestrate(parsed.page,gateway,createFilterState(bootstrap.filters),undefined,bootstrap);
    let snapshots: any; const stop = stream.subscribe(s=>{snapshots=s;}); await flush();
    expect(gateway.fetchData).not.toHaveBeenCalled();
    for (const [source,status] of Object.entries(expected.snapshots)) expect(snapshots.get(source).status).toBe(status);
    stop();
  });
}
it.each(['target','operationId','conditionKey','rows-error','status','extra-source'])('拒绝%s错配，不能成为可渲染输入', field => {
  const {request,response} = scenario('execute-success');
  if (field === 'target') response.target.ref.revisionId = 'latest';
  if (field === 'operationId') response.operationId = 'other';
  if (field === 'conditionKey') delete response.conditionKey;
  if (field === 'rows-error') response.dataSources.gmv.error = {code:'DQE_TIMEOUT'};
  if (field === 'status') response.status = 'partial';
  if (field === 'extra-source') response.dataSources.extra = response.dataSources.gmv;
  expect(()=>prepareExecution(request,response)).toThrow(expect.objectContaining({code:'RESPONSE_MISMATCH'}));
});
it('raw queryField映射、字段失败及全失败沿用既有快照错误，原文不变', () => {
  const {request,response} = scenario('execute-success');
  response.document.dataSources.gmv.fields.gmv.queryField = 'income';
  response.document.dataSources.gmv.source.query.body.dsl_list[0].output_metrics = ['income'];
  response.dataSources.gmv.rowFormat = 'query'; response.dataSources.gmv.rows = [{income:42}];
  const original = JSON.stringify(response);
  expect(prepareExecution(request,response).snapshots.get('gmv')).toMatchObject({status:'ready',rows:[{gmv:42}]});
  expect(JSON.stringify(response)).toBe(original);
  response.dataSources.gmv.rows = [{}];
  expect(prepareExecution(request,response).snapshots.get('gmv')).toMatchObject({status:'error',error:{code:'DQE_FIELD_MAPPING_ERROR'}});
  response.status='error';
  for (const key of Object.keys(response.dataSources)) response.dataSources[key] = {status:'error',conditionKey:response.conditionKey,error:{code:'DQE_TIMEOUT',message:'private values must not surface'}};
  const b = prepareExecution(request,response);
  expect([...b.snapshots.values()].every(s=>s.status==='error')).toBe(true);
  expect(JSON.stringify([...b.snapshots.values()])).not.toContain('private');
});
it('能力缺席和无权限失败关闭；取消忽略迟到服务回执', async () => {
  const {request,response} = scenario('execute-success');
  await expect(loadExecution(request)).rejects.toMatchObject({code:'CAPABILITY_UNAVAILABLE'});
  await expect(loadExecution(request,{execute:async()=>scenario('execute-no-access').response})).rejects.toMatchObject({code:'NO_ACCESS_SCOPE'});
  const c = new AbortController(); let resolve!: (v:unknown)=>void;
  const promise = loadExecution(request,{execute:()=>new Promise(r=>{resolve=r;})},c.signal);
  c.abort(); resolve(response); await expect(promise).rejects.toMatchObject({name:'AbortError'});
});
const dimensionDocument = () => JSON.parse(readFileSync('packages/page/fixtures/contract-valid/dimension-params-page.json','utf8'));
it.each(['explicit','history','default','permission-fallback'])('权威%s取值被原样消费，不在浏览器重判权限/默认优先级', async origin => {
  // 外部边界固定回执：只验证消费，不在替身实现提取或权限算法。
  const document = dimensionDocument();
  const actual = origin === 'explicit' ? ['EU'] : origin === 'history' ? ['NA'] : origin === 'default' ? ['APAC'] : ['ALLOWED'];
  const request: ExecutionRequest = {target:{kind:'draft',ref:{pageId:document.id,revisionId:'r1',resourceId:'metadata'}},operationId:'operation',explicitInputs:{regions:['FORBIDDEN']}};
  const response = {status:'success',target:request.target,operationId:request.operationId,executionId:'execution',conditionKey:'conditions',document,appliedInputs:{regions:actual,heading:'Actual'},filterValues:{'region-filter':{type:'dimension',dimension:'region',values:actual}},dataSources:Object.fromEntries(Object.keys(document.dataSources).map(id=>[id,{status:'success',rows:[{region:actual[0],gmv:1}],totalCount:1,conditionKey:'conditions'}]))};
  const bootstrap = prepareExecution(request,response);
  const parsed = parsePage(document,{textValues:{values:bootstrap.params}}); if(!parsed.ok) throw new Error('invalid');
  const page = initializePageParams(parsed.page,bootstrap.params);
  const state = createFilterState(bootstrap.filters); const calls: any[]=[];
  const stop=orchestrate(page,{fetchData:async q=>{calls.push(q);return {rows:[],totalCount:0};}},state,undefined,bootstrap).subscribe(()=>{});
  await flush(); expect(calls).toHaveLength(0);
  expect(bootstrap.params.get('regions')).toEqual(actual);
  state.write('region-filter',{type:'dimension',dimension:'region',values:['NEXT']});await flush();
  expect(calls).toHaveLength(1);expect(calls[0].filterValues[0].values).toEqual(['NEXT']);
  state.write('region-filter',null);await flush();expect(calls.at(-1).filterValues).toEqual([]);
  expect(bootstrap.params.get('regions')).toEqual(actual);stop();
  const mismatch = structuredClone(response); mismatch.filterValues['region-filter'].values=['OTHER'];
  expect(()=>prepareExecution(request,mismatch)).toThrow(expect.objectContaining({code:'RESPONSE_MISMATCH'}));
});
it.each(['candidate','template'])('%s精确目标须包含来源修订且与实际页面一致', kind => {
  const {request,response} = scenario('execute-success');
  const source = request.target.ref;
  request.target = kind === 'candidate' ? {kind,ref:{candidateId:'candidate',candidateVersion:'v1',source}} : {kind,ref:{templateId:'template',templateRevisionId:'v1',source}};
  response.target=structuredClone(request.target);
  expect(prepareExecution(request,response).target).toEqual(request.target);
  delete request.target.ref.source;
  expect(()=>prepareExecution(request,response)).toThrow(expect.objectContaining({code:'RESPONSE_MISMATCH'}));
});
it('当前条件变化时不复用执行初始行，改走网关', async () => {
  const {request,response}=scenario('execute-success');
  const bootstrap=prepareExecution(request,response);
  const parsed=parsePage(bootstrap.document);if(!parsed.ok)throw new Error('invalid');
  const gateway={fetchData:vi.fn(async()=>({rows:[]}))};
  const filters=createFilterState(new Map([['changed',{type:'dimension' as const,dimension:'region',values:['different']}]]));
  const stop=orchestrate(parsed.page,gateway,filters,undefined,bootstrap).subscribe(()=>{});await flush();
  expect(gateway.fetchData).toHaveBeenCalled();stop();
});

it('查询定义变化时仅重查变化的数据源，不能套用旧执行行', async () => {
  const {request,response}=scenario('execute-success');
  const bootstrap=prepareExecution(request,response);
  const changed=structuredClone(bootstrap.document);
  if(changed.dataSources.gmv.source.type !== 'query')throw new Error('expected query');
  changed.dataSources.gmv.source.query.body.dsl_list[0].filter={dims:[{field:'region',op:'in',value:['EU']}]};
  const parsed=parsePage(changed);if(!parsed.ok)throw new Error(JSON.stringify(parsed.errors));
  const gateway={fetchData:vi.fn(async()=>({rows:[{gmv:9}]}))};
  let result: any;
  const stop=orchestrate(parsed.page,gateway,createFilterState(bootstrap.filters),undefined,bootstrap).subscribe(value=>{result=value;});await flush();
  expect(gateway.fetchData).toHaveBeenCalledTimes(1);
  expect(result.get('gmv')).toMatchObject({status:'ready',rows:[{gmv:9}]});
  expect(result.get('orders')).toEqual(bootstrap.snapshots.get('orders'));
  stop();
});
