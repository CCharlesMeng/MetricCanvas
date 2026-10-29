import { expect, it, vi } from 'vitest';
import { dqeRecord, type Row } from '@metriccanvas/page/internal';
import type { ColumnCandidatesQuery, DataGateway } from '../src/ports';
import { fullQueryColumnCandidates } from '../src/dqe/full-query-candidates';
import { createDqeGateway } from '../src/dqe';

function request(): ColumnCandidatesQuery {
  return { field: 'office', queryField: '代表处', search: '', offset: 0, limit: 50, query: {
    language: 'dqe', body: { dsl_list: [{ output_dims: ['区域', '代表处'], output_metrics: ['收入'],
      filter: { dims: [{ dim_name: '区域', dim_value_list: ['华北'] }], metrics: [] },
      order: { order_by_field: '收入', type: 'DESC', offset: 0, limit: 20 } }] },
    fieldMappings: { office: { queryField: '代表处', type: 'string', role: 'dimension' },
      region: { queryField: '区域', type: 'string', role: 'dimension' },
      amount: { queryField: '收入', type: 'number', role: 'measure' } }, filterValues: [], pagination: { offset: 40, limit: 20 }
  } };
}

function rowReader(rows: Row[]): DataGateway['fetchData'] {
  return async query => {
    const { offset, limit } = query.pagination!;
    return { rows: rows.slice(offset, offset + limit), totalCount: rows.length };
  };
}

it('reads beyond both display pages, preserves the complete original query and deduplicates before candidate search/pagination', async () => {
  const input = request(), before = structuredClone(input);
  const fetchData = vi.fn(rowReader([{ office: '甲' }, { office: '甲' }, { office: '乙' }, { office: '丙' }, { office: null }]));
  const page = await fullQueryColumnCandidates({ ...input, offset: 1, limit: 1 }, fetchData, { mode: 'fullQuery', batchSize: 2 });
  expect(page).toEqual({ kind: 'values', totalCount: 3, candidates: [{ value: '乙', label: '乙' }] });
  expect(fetchData.mock.calls.map(([query]) => query.pagination)).toEqual([{ offset: 0, limit: 2 }, { offset: 2, limit: 2 }, { offset: 4, limit: 2 }]);
  for (const [query] of fetchData.mock.calls) expect(query.body).toEqual(input.query.body);
  expect(input).toEqual(before);
  expect(await fullQueryColumnCandidates({ ...input, search: '丙' }, rowReader([{ office: '甲' }, { office: '丙' }]), { mode: 'fullQuery', batchSize: 1 }))
    .toEqual({ kind: 'values', totalCount: 1, candidates: [{ value: '丙', label: '丙' }] });
});

it('retains a declared business TopN while ignoring the table display window', async () => {
  const input = request(), order = dqeRecord(input.query.body.dsl_list[0].order);
  delete order.offset; order.limit = 3;
  const fetchData = vi.fn(rowReader([{ office: '甲' }, { office: '甲' }, { office: '乙' }, { office: '丙' }]));
  expect(await fullQueryColumnCandidates(input, fetchData, { mode: 'fullQuery', batchSize: 2 }))
    .toMatchObject({ totalCount: 2 });
  expect(fetchData.mock.calls.map(([query]) => query.pagination)).toEqual([{ offset: 0, limit: 2 }, { offset: 2, limit: 1 }]);
});

it.each([
  { rows: [{ office: '甲' }], totalCount: undefined },
  { rows: [{ office: '甲' }], totalCount: 0 },
  { rows: [{ office: '甲' }], totalCount: 3 },
  { rows: [], totalCount: -1 }
])('rejects missing, contradictory or truncated totals: %j', async result => {
  await expect(fullQueryColumnCandidates(request(), async () => result, { mode: 'fullQuery', batchSize: 2 }))
    .rejects.toMatchObject({ code: 'DQE_ROW_CONTRACT_ERROR' });
});

it('rejects a changing total and propagates a later page failure without returning partial candidates', async () => {
  const fetchData = vi.fn<DataGateway['fetchData']>()
    .mockResolvedValueOnce({ rows: [{ office: '甲' }], totalCount: 2 })
    .mockResolvedValueOnce({ rows: [{ office: '乙' }], totalCount: 3 });
  await expect(fullQueryColumnCandidates(request(), fetchData, { mode: 'fullQuery', batchSize: 1 }))
    .rejects.toMatchObject({ code: 'DQE_ROW_CONTRACT_ERROR' });
  fetchData.mockReset().mockResolvedValueOnce({ rows: [{ office: '甲' }], totalCount: 2 }).mockRejectedValueOnce(new Error('second page failed'));
  await expect(fullQueryColumnCandidates(request(), fetchData, { mode: 'fullQuery', batchSize: 1 })).rejects.toThrow('second page failed');
});

it('passes cancellation and diagnostics through, ignores late receipts and stops reading', async () => {
  const controller = new AbortController(), context = { pageId: 'demo' };
  const fetchData = vi.fn<DataGateway['fetchData']>(async (_query, received, signal) => {
    expect(received).toBe(context); expect(signal).toBe(controller.signal);
    controller.abort();
    return { rows: [{ office: '甲' }], totalCount: 2 };
  });
  await expect(fullQueryColumnCandidates(request(), fetchData, { mode: 'fullQuery', batchSize: 1 }, context, controller.signal)).rejects.toMatchObject({ code: 'DQE_CANCELLED' });
  expect(fetchData).toHaveBeenCalledTimes(1);
});

it('handles empty results, numeric zero and null without inventing options', async () => {
  expect(await fullQueryColumnCandidates(request(), rowReader([]), { mode: 'fullQuery' })).toMatchObject({ totalCount: 0, candidates: [] });
  expect(await fullQueryColumnCandidates(request(), rowReader([{ office: 0 }, { office: 0 }, { office: null }]), { mode: 'fullQuery' }))
    .toEqual({ kind: 'values', totalCount: 1, candidates: [{ value: 0, label: '0' }] });
});

it('allows larger complete ranges only with an explicit maxRows override, independent of the export limit', async () => {
  const fetchData = vi.fn(rowReader(Array.from({ length: 10001 }, () => ({ office: '甲' }))));
  expect(await fullQueryColumnCandidates(request(), fetchData, { mode: 'fullQuery', maxRows: 10001 })).toMatchObject({ totalCount: 1 });
  expect(fetchData).toHaveBeenCalledTimes(51);
  fetchData.mockClear();
  await expect(fullQueryColumnCandidates(request(), fetchData, { mode: 'fullQuery', batchSize: 0 })).rejects.toMatchObject({ code: 'DQE_CONFIG_ERROR' });
  expect(fetchData).not.toHaveBeenCalled();
});

it('defaults to 200 rows per read and scans exactly five batches at the inclusive 1000-row boundary', async () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({ office: String(index) }));
  const fetchData = vi.fn(rowReader(rows));
  expect(await fullQueryColumnCandidates(request(), fetchData, { mode: 'fullQuery' })).toMatchObject({ totalCount: 1000 });
  expect(fetchData.mock.calls.map(([query]) => query.pagination)).toEqual(
    [0, 200, 400, 600, 800].map(offset => ({ offset, limit: 200 })));
});

it.each([1001, 10000])('stops after the first batch when %i raw rows exceed the budget, even with one distinct value', async length => {
  const fetchData = vi.fn(rowReader(Array.from({ length }, () => ({ office: '甲' }))));
  await expect(fullQueryColumnCandidates(request(), fetchData, { mode: 'fullQuery' })).rejects.toMatchObject({
    code: 'DQE_CANDIDATE_LIMIT_EXCEEDED', message: expect.stringContaining('1000条查询上限')
  });
  expect(fetchData).toHaveBeenCalledTimes(1);
  expect(fetchData.mock.calls[0][0].pagination).toEqual({ offset: 0, limit: 200 });
});

it('caps each read at the remaining budget and preserves business TopN inside the budget', async () => {
  const fetchData = vi.fn(rowReader(Array.from({ length: 1001 }, () => ({ office: '甲' }))));
  await expect(fullQueryColumnCandidates(request(), fetchData, { mode: 'fullQuery', batchSize: 2000 })).rejects.toMatchObject({ code: 'DQE_CANDIDATE_LIMIT_EXCEEDED' });
  expect(fetchData.mock.calls[0][0].pagination).toEqual({ offset: 0, limit: 1000 });
  fetchData.mockClear();
  const input = request(), order = dqeRecord(input.query.body.dsl_list[0].order);
  delete order.offset; order.limit = 999;
  expect(await fullQueryColumnCandidates(input, fetchData, { mode: 'fullQuery' })).toMatchObject({ totalCount: 1 });
  expect(fetchData).toHaveBeenCalledTimes(5);
  expect(fetchData.mock.calls.at(-1)![0].pagination).toEqual({ offset: 800, limit: 199 });
});

it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid maxRows %s before transport', async maxRows => {
  const fetchData = vi.fn(rowReader([]));
  await expect(fullQueryColumnCandidates(request(), fetchData, { mode: 'fullQuery', maxRows })).rejects.toMatchObject({ code: 'DQE_CONFIG_ERROR' });
  expect(fetchData).not.toHaveBeenCalled();
});

it('uses native DQE HTTP reads with the metric preserved and keeps the explicit DISTINCT encoder as the first choice', async () => {
  const items: unknown[] = [];
  const gateway = createDqeGateway({ columnCandidates: { mode: 'fullQuery', batchSize: 1 }, fetchImpl: async (_input, init) => {
    const item = JSON.parse(String(init?.body)).dsl_list[0]; items.push(item);
    return Response.json({ retCode: 'CBC.0000', results: [{ code: 'SUCCESS', total_count: 2,
      data: [{ 区域: '华北', 代表处: item.order.offset === 0 ? '甲' : '乙', 收入: 100 }] }] });
  } });
  expect(await gateway.fetchColumnCandidates?.(request())).toMatchObject({ totalCount: 2 });
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({ output_dims: ['区域', '代表处'], output_metrics: ['收入'], order: { offset: 0, limit: 1 } });
  const encodeColumnCandidates = vi.fn(() => { throw Error('explicit encoder'); });
  const explicit = createDqeGateway({ encodeColumnCandidates, columnCandidates: { mode: 'fullQuery' } });
  await expect(explicit.fetchColumnCandidates?.(request())).rejects.toThrow('explicit encoder');
  expect(encodeColumnCandidates).toHaveBeenCalledTimes(1);
});
