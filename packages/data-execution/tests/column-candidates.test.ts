import { describe, expect, it } from 'vitest';
import fixture from '../../../pages/table-toolbar-demo.json';
import joined from '../../page/fixtures/contract-valid/paged-join-page.json';
import { parsePage } from '@metriccanvas/page';
import type { EffectiveQuery, Page, TableQueryView } from '@metriccanvas/page/internal';
import { createSourceProgram, defaultSourceView, initialFilterValues, localColumnCandidates } from '../src/runtime';
import { createDqeGateway, effectiveDqeItem } from '../src/dqe';
import { officeGateway } from './fixtures/office-gateway';
import { createQueryRunner } from '../src/query-runner';
import type { DataGateway, ColumnCandidatesQuery } from '../src';

function parsed(input: unknown = fixture): Page { const result = parsePage(input); if (!result.ok) throw Error(JSON.stringify(result.errors)); return result.page; }
const view = (): TableQueryView => ({ pageIndex: 2, pageSize: 2, sort: [], predicates: [] });
const query = (): EffectiveQuery => ({ language: 'dqe', body: { dsl_list: [{ output_dims: ['code'], output_metrics: [], filter: { dims: [{ dim_name: 'code', dim_value_list: [1, 2] }] } }] }, fieldMappings: { code: { type: 'number', role: 'dimension', queryField: 'code' } }, filterValues: [] });
describe('table result column candidates', () => {
  it('excludes self, retains other predicates and search, preserves number/string identity and skips null', () => {
    const rows = [{ area: 'N', code: 1 }, { area: 'N', code: '1' }, { area: 'S', code: 2 }, { area: 'N', code: null }];
    const state = { ...view(), predicates: [{ field: 'area', op: 'in' as const, values: ['N'] }, { field: 'code', op: 'in' as const, values: [2] }] };
    const result = localColumnCandidates(rows, 'code', state, '', 0, 10);
    expect(result).toEqual({ kind: 'values', totalCount: 2, candidates: expect.arrayContaining([{ value: 1, label: '1' }, { value: '1', label: '1' }]) });
    expect(localColumnCandidates(rows, 'area', state, '', 0, 10)).toEqual({ kind: 'values', totalCount: 1, candidates: [{ value: 'S', label: 'S' }] });
  });
  it('reads complete inline data beyond current page; candidate pagination/search are independent', async () => {
    const page = parsed(), program = createSourceProgram(page, { gateway: { fetchData: async () => { throw Error('inline must not query'); } } });
    const base = { sourceId: 'records', field: 'name', view: view(), conditions: new Map() };
    try {
      expect(await program.readColumnCandidates({ ...base, pageSize: 2 })).toMatchObject({ kind: 'values', totalCount: 25, candidates: expect.any(Array) });
      expect(await program.readColumnCandidates({ ...base, candidateSearch: '客户25' })).toEqual({ kind: 'values', candidates: [{ value: '客户25', label: '客户25' }], totalCount: 1 });
      expect(await program.readColumnCandidates({ ...base, view: { ...view(), predicates: [{ field: 'name', op: 'in', values: ['客户1'] }] } })).toMatchObject({ totalCount: 25 });
    } finally { program.dispose(); }
  });
  it('gets cross-member candidates from complete bounded joined results', async () => {
    const page = parsed(joined), root = 'office-overview', program = createSourceProgram(page, { gateway: officeGateway() });
    try {
      const state = { ...defaultSourceView(page, root), predicates: [{ field: 'bidding-amount', op: 'gte' as const, value: 150000000 }] };
      const result = await program.readColumnCandidates({ sourceId: root, field: 'rep-office-code', view: state, conditions: initialFilterValues(page.filters ?? []) });
      expect(result).toMatchObject({ kind: 'values', totalCount: 3 });
    } finally { program.dispose(); }
  });
  it('table constraints narrow bound/fixed conditions and an empty intersection does not send HTTP', async () => {
    const base = query();
    expect(effectiveDqeItem({ ...base, tableFilters: [{ target: 'dimension', queryField: 'code', values: [2, 3] }] })).toMatchObject({ filter: { dims: [{ dim_name: 'code', dim_value_list: [2] }] } });
    let calls = 0;
    const gateway = createDqeGateway({ fetchImpl: async () => { calls++; throw Error('must not send'); } });
    expect(await gateway.fetchData({ ...base, tableFilters: [{ target: 'dimension', queryField: 'code', values: [3] }] })).toEqual({ rows: [], totalCount: 0 });
    expect(calls).toBe(0);
    expect(base.body.dsl_list[0]).toMatchObject({ filter: { dims: [{ dim_value_list: [1, 2] }] } });
  });
  it('requires verified remote DISTINCT encoding; preserves NO_PERMISSION rows and typed values', async () => {
    const request: ColumnCandidatesQuery = { query: query(), field: 'code', queryField: 'code', search: '', offset: 0, limit: 2 };
    const unavailable = createDqeGateway({ fetchImpl: async () => { throw Error('no unverified query'); } });
    expect(await unavailable.fetchColumnCandidates?.(request)).toEqual({ kind: 'unavailable' });
    const gateway = createDqeGateway({
      encodeColumnCandidates: value => ({ query: value.query, valueField: 'code' }),
      fetchImpl: async () => new Response(JSON.stringify({ retCode: 'CBC.0000', results: [{ code: 'NO_PERMISSION', data: [{ code: 1 }, { code: 2 }], total_count: 2 }] }))
    });
    expect(await gateway.fetchColumnCandidates?.(request)).toEqual({ kind: 'values', totalCount: 2, candidates: [{ value: 1, label: '1' }, { value: 2, label: '2' }] });
    const invalid = createQueryRunner({ gateway: { fetchData: async () => ({ rows: [] }), fetchColumnCandidates: async () => ({ kind: 'values', candidates: [{ value: 1, label: '1' }], totalCount: 10 }) } });
    await expect(invalid.runCandidates(request, {}, 'session')).rejects.toMatchObject({ code: 'DQE_ROW_CONTRACT_ERROR' });
    invalid.dispose();
  });
  it('shares candidate/data concurrency and detaches only the cancelled consumer', async () => {
    let release: () => void = () => {}, calls = 0;
    const gate = new Promise<void>(done => release = done);
    const gateway: DataGateway = { fetchData: async () => { await gate; return { rows: [] }; }, fetchColumnCandidates: async () => { calls++; return { kind: 'values', candidates: [], totalCount: 0 }; } };
    const runner = createQueryRunner({ gateway, maxConcurrent: 1 });
    const data = runner.run(query(), {}, 'session');
    const request: ColumnCandidatesQuery = { query: query(), field: 'code', queryField: 'code', search: '', offset: 0, limit: 2 };
    const controller = new AbortController();
    const first = runner.runCandidates(request, {}, 'session', controller.signal);
    const second = runner.runCandidates(request, {}, 'session');
    controller.abort();
    await expect(first).rejects.toMatchObject({ code: 'DQE_CANCELLED' });
    expect(calls).toBe(0); release(); await data;
    expect(await second).toMatchObject({ kind: 'values', totalCount: 0 }); expect(calls).toBe(1);
    runner.dispose();
  });
});

it('detects disjoint fixed/table scalar ranges without an HTTP request', async () => {
  let calls = 0;
  const gateway = createDqeGateway({ fetchImpl: async () => { calls++; throw Error('must not send'); } });
  const base = query();
  base.body.dsl_list[0].filter = { dims: [], metrics: [{ metric_name: 'amount', metric_value_list: [100], operator: '<=' }] };
  expect(await gateway.fetchData({ ...base, tableFilters: [{ target: 'metricRange', metric: 'amount', from: 101 }] })).toEqual({ rows: [], totalCount: 0 });
  expect(calls).toBe(0);
});

it('remote source candidate context preserves business bindings and removes only its own table predicate', async () => {
  const page = parsed();
  page.dataSources.records = {
    fields: { name: { type: 'string', role: 'dimension', queryField: '客户' }, value: { type: 'number', role: 'measure', queryField: '收入' } },
    source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['客户'], output_metrics: ['收入'], filter: { dims: [{ dim_name: '业务类型', dim_value_list: ['固定'] }] } }] },
      filterBindings: { customer: { target: 'dimension', queryField: '客户' } } } }
  };
  const calls: ColumnCandidatesQuery[] = [];
  const program = createSourceProgram(page, { gateway: { fetchData: async () => { throw Error('not a data read'); }, fetchColumnCandidates: async request => { calls.push(request); return { kind: 'values', candidates: [], totalCount: 0 }; } } });
  const conditions = new Map<string, import('../src/runtime').FilterValue>([['customer', { type: 'dimension', dimension: '客户', values: ['页面约束'] }]]);
  const state: TableQueryView = { ...view(), predicates: [{ field: 'name', op: 'in', values: ['表头值'] }, { field: 'value', op: 'gte', value: 100 }], search: { fields: ['name'], query: '字面搜索' } };
  try {
    await program.readColumnCandidates({ sourceId: 'records', field: 'name', conditions, view: state });
    expect(calls[0].query.bindingValues).toEqual([{ target: 'dimension', queryField: '客户', values: ['页面约束'] }]);
    expect(calls[0].query.tableFilters).toEqual([{ target: 'metricRange', metric: '收入', from: 100 }]);
    expect(calls[0].query.filterValues).toContainEqual({ target: 'metricRange', metric: '收入', from: 100 });
    expect(calls[0].query.search).toEqual({ queryFields: ['客户'], query: '字面搜索' });
    expect(calls[0].query.body.dsl_list[0]).toMatchObject({ filter: { dims: [{ dim_name: '业务类型', dim_value_list: ['固定'] }] } });
    expect(calls[0].query.pagination).toBeUndefined();
  } finally { program.dispose(); }
});

it('does not broaden an empty upstream result binding for remote candidates', async () => {
  const page = parsed();
  page.dataSources.upstream = page.dataSources.records;
  page.dataSources.records = {
    fields: { name: { type: 'string', role: 'dimension', queryField: '客户' } },
    source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['客户'], output_metrics: [] }] },
      resultBindings: [{ target: 'dimension', source: 'upstream', field: 'name', queryField: '客户', maxValues: 100 }] } }
  };
  let called = false;
  const program = createSourceProgram(page, { gateway: { fetchData: async () => ({ rows: [] }), fetchColumnCandidates: async () => { called = true; return { kind: 'unavailable' }; } } });
  try {
    const result = await program.readColumnCandidates({ sourceId: 'records', field: 'name', conditions: new Map(), view: view(), seeds: new Map([['upstream', { status: 'empty', totalCount: 0 }]]) });
    expect(result).toEqual({ kind: 'values', candidates: [], totalCount: 0 }); expect(called).toBe(false);
  } finally { program.dispose(); }
});

it('rejects candidate enumeration above the existing joined row bound', async () => {
  const page = parsed(joined), source = page.dataSources['office-overview'];
  if (source.source.type !== 'pagedJoin') throw Error('expected joined fixture');
  source.source.fallback.maxRows = 2;
  const program = createSourceProgram(page, { gateway: officeGateway() });
  try {
    await expect(program.readColumnCandidates({ sourceId: 'office-overview', field: 'rep-office-code', conditions: initialFilterValues(page.filters ?? []), view: defaultSourceView(page, 'office-overview') })).rejects.toMatchObject({ code: 'DQE_QUERY_REJECTED' });
  } finally { program.dispose(); }
});

it('passes the fixed business TopN unchanged to the verified remote encoder', async () => {
  const page = parsed();
  page.dataSources.records = { fields: { name: { type: 'string', role: 'dimension', queryField: '客户' } },
    source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['客户'], output_metrics: [], order: { limit: 5, by: [{ field: '客户', type: 'desc' }] } }] } } } };
  const received: ColumnCandidatesQuery[] = [];
  const program = createSourceProgram(page, { gateway: { fetchData: async () => ({ rows: [] }), fetchColumnCandidates: async request => { received.push(request); return { kind: 'values', candidates: [], totalCount: 0 }; } } });
  try {
    await program.readColumnCandidates({ sourceId: 'records', field: 'name', conditions: new Map(), view: { ...view(), sort: [{ field: 'name', direction: 'asc' }] } });
    expect(received[0].query.body.dsl_list[0].order).toEqual({ limit: 5, by: [{ field: '客户', type: 'desc' }] });
    expect(received[0].query.pagination).toBeUndefined(); expect(received[0].query.sort).toBeUndefined();
  } finally { program.dispose(); }
});

it('does not replace an opaque existing filter with a broader table predicate', async () => {
  const base = query(); base.body.dsl_list[0].filter = { dims: 'opaque-condition' };
  let calls = 0;
  const gateway = createDqeGateway({ fetchImpl: async () => { calls++; throw Error('must not send'); } });
  await expect(gateway.fetchData({ ...base, tableFilters: [{ target: 'dimension', queryField: 'code', values: [1] }] })).rejects.toMatchObject({ code: 'DQE_FILTER_BINDING_ERROR' });
  expect(calls).toBe(0); expect(base.body.dsl_list[0].filter).toEqual({ dims: 'opaque-condition' });
});

function remoteCandidatePage() {
  const page = parsed();
  page.dataSources.records = { fields: { name: { type: 'string', role: 'dimension', queryField: '客户' } },
    source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['客户'], output_metrics: [] }] },
      filterBindings: { customer: { target: 'dimension', queryField: '客户' } } } } };
  return page;
}
it('validates declared page filter choices before sending remote column candidates', async () => {
  const page = remoteCandidatePage();
  page.filters = [{ id: 'customer', type: 'dimension', dimension: '客户', options: [{ value: 'allowed', label: 'Allowed' }] }];
  let calls = 0;
  const program = createSourceProgram(page, { gateway: { fetchData: async () => ({ rows: [] }), fetchColumnCandidates: async () => { calls++; return { kind: 'values', candidates: [], totalCount: 0 }; } } });
  const conditions = initialFilterValues(page.filters);
  conditions.set('customer', { type: 'dimension', dimension: '客户', values: ['outside'] });
  try {
    await expect(program.readColumnCandidates({ sourceId: 'records', field: 'name', conditions, view: view() })).rejects.toMatchObject({ code: 'DQE_QUERY_REJECTED' });
    expect(calls).toBe(0);
    conditions.set('customer', { type: 'dimension', dimension: '客户', values: ['allowed'] });
    await expect(program.readColumnCandidates({ sourceId: 'records', field: 'name', conditions, view: view() })).resolves.toMatchObject({ kind: 'values' });
    expect(calls).toBe(1);
  } finally { program.dispose(); }
});
it('isolates cached column candidates across trusted display context revisions', async () => {
  const page = remoteCandidatePage();
  let revision = 'one', calls = 0;
  const program = createSourceProgram(page, { displayInputs: () => ({ permissionRevision: revision, permissions: {}, values: {} }), gateway: {
    fetchData: async () => ({ rows: [] }), fetchColumnCandidates: async () => { calls++; return { kind: 'values', candidates: [{ value: revision, label: revision }], totalCount: 1 }; }
  } });
  const request = { sourceId: 'records', field: 'name', conditions: new Map(), view: view() };
  try {
    expect(await program.readColumnCandidates(request)).toMatchObject({ candidates: [{ value: 'one' }] });
    await program.readColumnCandidates(request); expect(calls).toBe(1);
    revision = 'two';
    expect(await program.readColumnCandidates(request)).toMatchObject({ candidates: [{ value: 'two' }] });
    expect(calls).toBe(2);
  } finally { program.dispose(); }
});
