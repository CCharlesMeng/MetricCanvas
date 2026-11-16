import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { parsePage, type DimensionFilterDeclaration, type EffectiveQuery } from '@metriccanvas/page/internal';
import { effectiveDqeItem } from '../src/dqe/dqe';
import { sourceCandidatesGateway } from '../src/source-candidates';
import { createSourceProgram } from '../src/source-program/session';
import { filterCandidatesRequest } from '../src/filter-candidates';
import { sourceCandidateWindow } from '../src/source-candidate-window';
import type { FilterValues } from '../src/filter-values';
import { createSourceCandidatesPreview } from '../../../apps/playground/fixtures/source-candidates';

function document(name='filter-source-query-pagination') {
  const file = new URL(`../../../pages/capabilities/filters/${name}.json`, import.meta.url);
  return loadPage(file);
}

function loadPage(file:URL) {
  const result = parsePage(JSON.parse(readFileSync(file, 'utf8')));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.page;
}

function setup(state?:string) {
  const page = document();
  const filter = page.filters!.find(item => item.id === 'service') as DimensionFilterDeclaration;
  const preview = createSourceCandidatesPreview(state);
  const gateway = sourceCandidatesGateway(page, preview.dataGateway);
  const values:FilterValues = new Map([['service-scope',{type:'dimension', dimension:'scope', values:['甲']}]]);
  const request = filterCandidatesRequest(filter,page.filters!,values);
  return {page, filter, gateway, values, request, preview};
}

it('reads exactly one bounded window, then applies server search before pagination',async()=>{
  const {gateway, request, preview} = setup();
  const options = {signal:new AbortController().signal};
  const first = await gateway.fetchFilterCandidates!({...request,sourceRead:{kind:'page',offset:0,search:''}},options);
  expect(first).toMatchObject({totalCount:25, candidates:expect.arrayContaining([{value:'甲云服务10',label:'甲云服务10'}])});
  expect(preview.requests.map(query => query.pagination)).toEqual([{offset:0,limit:10}]);
  const next = await gateway.fetchFilterCandidates!({...request,sourceRead:{kind:'page',offset:10,search:''}},options);
  expect(next.kind === 'values' && next.candidates.map(item => item.value)).toContain('甲云服务20');
  const searched = await gateway.fetchFilterCandidates!({...request,sourceRead:{kind:'page',offset:0,search:'25'}},options);
  expect(searched).toEqual({kind:'values', totalCount:1, candidates:[{value:'甲云服务25',label:'甲云服务25'}]});
  expect(effectiveDqeItem(preview.requests[2])).toMatchObject({
    order:{offset:0,limit:10,order_by_field:'云服务',type:'asc'},
    filter:{dims:expect.arrayContaining([{dim_name:'云服务',dim_value_list:['25'],operator:'contains'}])}
  });
});

it('reuses a passed upstream check within the same page context and rechecks scope or permission changes',async()=>{
  const {page,filter,preview} = setup();
  const scope = page.filters!.find(item=>item.id === 'service-scope') as DimensionFilterDeclaration;
  delete scope.options;
  const fetchDimensionValues = vi.fn(async () => ({kind:'values' as const,candidates:[
    {value:'甲',label:'甲'},{value:'乙',label:'乙'}
  ]}));
  let permissionRevision = 'allowed', revision = 0;
  const context = {now:new Date(2026,10,16),filterRevision:()=>revision,
    displayInputs:()=>({permissionRevision,permissions:{},values:{}})};
  const base = {...preview.dataGateway,fetchDimensionValues};
  let gateway = sourceCandidatesGateway(page, base, context);
  function read(value:string, offset:number, search='') {
    const values:FilterValues = new Map([['service-scope',{type:'dimension',dimension:'scope',values:[value]}]]);
    const request = filterCandidatesRequest(filter,page.filters!,values);
    return gateway.fetchFilterCandidates!({...request,sourceRead:{kind:'page',offset,search}},{signal:new AbortController().signal});
  }
  await read('甲',0);
  await read('甲',10);
  await read('甲',0,'25');
  expect(fetchDimensionValues).toHaveBeenCalledTimes(1);
  expect(preview.requests.map(query=>query.pagination?.offset)).toEqual([0,10,0]);
  await read('乙',0);
  expect(fetchDimensionValues).toHaveBeenCalledTimes(2);
  revision++;
  await read('乙',0);
  expect(fetchDimensionValues).toHaveBeenCalledTimes(3);
  permissionRevision = 'revoked';
  fetchDimensionValues.mockResolvedValueOnce({kind:'values',candidates:[]});
  await expect(read('乙',10)).rejects.toMatchObject({code:'DQE_QUERY_REJECTED'});
  expect(fetchDimensionValues).toHaveBeenCalledTimes(4);
  expect(preview.requests).toHaveLength(5);
  await read('乙',0);
  expect(fetchDimensionValues).toHaveBeenCalledTimes(5);
  gateway = sourceCandidatesGateway(page, base, context);
  await read('乙',0);
  expect(fetchDimensionValues).toHaveBeenCalledTimes(6);
});

it('keeps business selection verification independent of the open menu and rejects out-of-scope values',async()=>{
  const {page, preview, values} = setup();
  const program = createSourceProgram(page,{gateway:preview.dataGateway});
  async function read(value:string, purpose:'screen'|'complete'='screen') {
    const conditions = new Map(values);
    conditions.set('service',{type:'dimension',dimension:'service',values:[value]});
    for await (const update of program.read({roots:['chart-data'],conditions,purpose})) if(update.sourceId === 'chart-data') return update;
  }
  try {
    expect((await read('甲云服务25'))?.snapshot.status).toBe('ready');
    expect(preview.requests.map(query=>query.pagination)).toEqual([{offset:0,limit:1},undefined]);
    expect(effectiveDqeItem(preview.requests[1])).toMatchObject({
      filter:{dims:expect.arrayContaining([{dim_name:'云服务',dim_value_list:['甲云服务25'],is_exclude:true}])}
    });
    expect((await read('乙云服务01'))?.candidateRejected).toBe(true);
    expect(preview.requests).toHaveLength(3);
    expect((await read('甲云服务25','complete'))?.snapshot.status).toBe('ready');
    expect(preview.requests[3].pagination).toEqual({offset:0,limit:1});
  } finally { program.dispose(); }
});

it('recognizes only explicit single-dimension windows and rejects invalid page totals',async()=>{
  const {page,filter,request} = setup();
  expect(sourceCandidateWindow(page,filter)?.limit).toBe(10);
  const complete = document('filter-source-candidates');
  expect(sourceCandidateWindow(complete,complete.filters![1] as DimensionFilterDeclaration)).toBeUndefined();
  const business = loadPage(new URL('../../../pages/temporary/business-result-pinned-diagnosis-20261102/business-result-metrics.json',import.meta.url));
  const services = business.filters!.find(item => item.id === 'cloud-service') as DimensionFilterDeclaration;
  expect(sourceCandidateWindow(business,services)).toMatchObject({sourceId:'cloud-service-options', limit:10});
  const fetchData = vi.fn(async (_query:EffectiveQuery) => ({rows:[{service:'甲云服务01'}]}));
  const gateway = sourceCandidatesGateway(page,{fetchData});
  await expect(gateway.fetchFilterCandidates!({...request,sourceRead:{kind:'page',offset:0,search:''}},{signal:new AbortController().signal}))
    .rejects.toMatchObject({code:'DQE_ROW_CONTRACT_ERROR'});
});
