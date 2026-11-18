import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { parsePage, resolvePeriodSelection, type DimensionFilterDeclaration, type EffectiveQuery, type Page } from '@metriccanvas/page/internal';
import { effectiveDqeItem } from '../src/dqe/dqe';
import { createSourceCandidateSession, sourceCandidatesGateway } from '../src/source-candidates';
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
    expect(preview.requests.filter(query => query.pagination)).toHaveLength(2);
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

function keyOfficeBusinessPage() {
  const path = new URL('../../../pages/temporary/business-result-pinned-diagnosis-20261102/business-result-metrics.json',import.meta.url);
  const document = JSON.parse(readFileSync(path, 'utf8').replaceAll('"key-account-only"', '"key-national-only"'));
  const result = parsePage(document);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.page;
}

function businessMonth(page:Page) {
  const period=page.filters?.find(filter=>filter.id==='mtime');
  if(period?.type!=='timeRange'||(period.precision!=='date'&&period.precision!=='month'))throw Error('business period');
  return resolvePeriodSelection({mode:'month',value:'2026-10'},new Date('2026-11-17T04:00:00Z'),period.precision);
}

it.each([
  undefined,
  {kind:'page', offset:0, search:''},
  {kind:'selection', values:['重点云服务']}
] as const)('applies the authorized key-office scope to candidate read %j', async sourceRead => {
  const page = keyOfficeBusinessPage();
  const filter = page.filters!.find(item => item.id === 'cloud-service') as DimensionFilterDeclaration;
  const fetchData = vi.fn(async (_query:EffectiveQuery) => ({rows:[{service:'重点云服务'}],totalCount:1}));
  const gateway = sourceCandidatesGateway(page, {
    fetchData,
    async fetchFilterCandidates(request) {
      const candidates = request.filterId === 'region' ? [{value:'全球',label:'全球',level:'geo'}] : [{value:'北京代表处',label:'北京代表处'}];
      return {kind:'values',candidates};
    }
  });
  const conditions:FilterValues = new Map([
    ['key-national-only',{type:'boolean',value:true}],
    ['mtime',{type:'timeRange',...businessMonth(page)}],
    ['region',{type:'dimension',dimension:'geo-pc-code',level:'geo',values:['全球']}]
  ]);
  const request = filterCandidatesRequest(filter,page.filters!,conditions,undefined,{page});
  await gateway.fetchFilterCandidates!({...request,sourceRead:sourceRead && structuredClone(sourceRead)},{signal:new AbortController().signal});
  expect(fetchData).toHaveBeenCalledTimes(1);
  expect(fetchData.mock.calls[0]![0].filterValues).toContainEqual(expect.objectContaining({
    queryField:'代表处', values:['北京代表处']
  }));
});

it.each(['empty','denied'] as const)('does not dispatch an unrestricted candidate query with a %s key-office roster', async status => {
  const page = keyOfficeBusinessPage();
  const filter = page.filters!.find(item => item.id === 'cloud-service') as DimensionFilterDeclaration;
  const fetchData = vi.fn<import('../src/ports').RuntimeDataGateway['fetchData']>();
  const gateway = sourceCandidatesGateway(page, {
    fetchData,
    async fetchFilterCandidates(request) {
      if (request.filterId === 'region') return {kind:'values',candidates:[{value:'全球',label:'全球',level:'geo'}]};
      return status === 'empty' ? {kind:'values',candidates:[]} : {kind:'denied'};
    }
  });
  const conditions:FilterValues = new Map([
    ['key-national-only',{type:'boolean',value:true}],
    ['mtime',{type:'timeRange',...businessMonth(page)}],
    ['region',{type:'dimension',dimension:'geo-pc-code',level:'geo',values:['全球']}]
  ]);
  const request = filterCandidatesRequest(filter,page.filters!,conditions,undefined,{page});
  const read = gateway.fetchFilterCandidates!({...request,sourceRead:{kind:'page',offset:0,search:''}},{signal:new AbortController().signal});
  if (status === 'empty') await expect(read).resolves.toEqual({kind:'values',candidates:[],totalCount:0});
  else await expect(read).rejects.toMatchObject({code:'DQE_CONFIG_ERROR'});
  expect(fetchData).not.toHaveBeenCalled();
});

it('cancels the previous permission scope and prevents its late window from being reused', async () => {
  const {page, request} = setup();
  type Result = import('../src/ports').DataGatewayResult;
  const replies: Array<(result: Result) => void> = [];
  const fetchData = vi.fn<import('../src/ports').RuntimeDataGateway['fetchData']>(
    () => new Promise(resolve => replies.push(resolve))
  );
  let permissionRevision = 'first';
  const session = createSourceCandidateSession(page, {fetchData}, {
    displayInputs: () => ({permissionRevision, permissions:{}, values:{}})
  });
  const window = {...request,sourceRead:{kind:'page' as const, offset:0,search:''}};
  const load = () => session.gateway.fetchFilterCandidates!(window,{signal:new AbortController().signal});
  try {
    const superseded = expect(load()).rejects.toMatchObject({name:'AbortError'});
    await vi.waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
    permissionRevision = 'second';
    const current = load();
    await superseded;
    expect(fetchData.mock.calls[0]![2]?.aborted).toBe(true);
    await vi.waitFor(() => expect(fetchData).toHaveBeenCalledTimes(2));
    replies[0]!({rows:[{service:'旧范围'}],totalCount:1});
    replies[1]!({rows:[{service:'当前范围'}],totalCount:1});
    const expected = {kind:'values',candidates:[{value:'当前范围',label:'当前范围'}],totalCount:1};
    await expect(current).resolves.toEqual(expected);
    await expect(load()).resolves.toEqual(expected);
    expect(fetchData).toHaveBeenCalledTimes(2);
  } finally {
    session.dispose();
  }
});
