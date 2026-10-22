import { afterEach, expect, it, vi } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { ordinaryQuery, isQueryDataSource, type DataSnapshot, type EffectiveQuery, type QueryResultBinding } from '@metriccanvas/page/internal';
import fixture from '../../page/fixtures/contract-valid/query-result-where-page.json';
import { resolveQueryResultInputs } from '../src/query-result-inputs';
import { fetchComplete } from '../src/source-program/range-policy';
import type { QueryRunner } from '../src/query-runner';

afterEach(() => vi.restoreAllMocks());

function sources() {
  const parsed = parsePage(structuredClone(fixture));
  if (!parsed.ok) throw Error('fixture');
  const input = parsed.page.dataSources['details-high'], upstream = parsed.page.dataSources.projects;
  if (!isQueryDataSource(input) || !isQueryDataSource(upstream)) throw Error('query fixture');
  return { input, upstream };
}
const invalid: DataSnapshot = { status: 'ready', rows: [{ 'project-id': null }] };
const forbidden: DataSnapshot = { status: 'error', error: { code: 'DQE_FORBIDDEN', message: 'private upstream details' } };
const empty: DataSnapshot = { status: 'empty', totalCount: 0 };
const waiting: DataSnapshot = { status: 'loading' };
const invalidInput: DataSnapshot = { status: 'error', error: { code: 'UNKNOWN', message: '查询输入维度缺失或类型不合法' } };
const failedInput: DataSnapshot = { status: 'error', error: { code: 'DQE_FORBIDDEN', message: '查询输入数据源失败' } };

it.each([
  { name: 'error wins over a later empty input', first: forbidden, second: empty, expected: failedInput },
  { name: 'empty wins over a later pending input', first: empty, second: waiting, expected: empty },
  { name: 'a later upstream error wins over an earlier invalid value', first: invalid, second: forbidden, expected: failedInput },
  { name: 'a later invalid value wins over an earlier upstream error', first: forbidden, second: invalid, expected: invalidInput },
])('$name', ({ first, second, expected }) => {
  const { input, upstream } = sources();
  input.source.query.resultBindings = ['a', 'b'].map((source): QueryResultBinding => ({ source, field: 'project-id', target: 'dimension', queryField: source, maxValues: 2 }));
  const raw = new Map([['a', first], ['b', second]]), original = structuredClone(raw);
  expect(resolveQueryResultInputs(input, raw, new Map([['a', upstream], ['b', upstream]]))).toEqual({ status: 'terminal', snapshot: expected });
  expect(raw).toEqual(original);
});

it('keeps the value-count error ahead of an invalid selected row', () => {
  const { input, upstream } = sources();
  input.source.query.resultBindings = [{ source: 'projects', field: 'project-id', target: 'dimension', queryField: '项目编号', maxValues: 0 }];
  expect(resolveQueryResultInputs(input, new Map([['projects', invalid]]), new Map([['projects', upstream]])))
    .toEqual({ status: 'terminal', snapshot: { status: 'error', error: { code: 'UNKNOWN', message: '查询输入集合超过声明上限' } } });
});

function query(): EffectiveQuery {
  const { upstream } = sources();
  return { language: 'dqe', body: structuredClone(ordinaryQuery(upstream.source.query).body), fieldMappings: upstream.fields, filterValues: [], pagination: { offset: 0, limit: 2 } };
}
function runner() {
  const run = vi.fn<QueryRunner['run']>();
  return { run, runCandidates: vi.fn<QueryRunner['runCandidates']>().mockRejectedValue(Error('unexpected candidates query')), forgetScope: vi.fn(), dispose: vi.fn() } satisfies QueryRunner;
}

it.each([false, true])('preserves later-page failure handling with allowPartial=%s', async allowPartial => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const source = runner();
  source.run.mockResolvedValueOnce({ status: 'ready', rows: [{ id: 'A' }, { id: 'B' }], totalCount: 3 }).mockResolvedValueOnce(forbidden);
  const result = await fetchComplete(query(), source, 'scope', undefined, { pageId: 'page' }, false, undefined, allowPartial);
  expect(result).toEqual(allowPartial ? { status: 'ready', rows: [{ id: 'A' }, { id: 'B' }], totalCount: 2 } : forbidden);
  expect(source.run.mock.calls.map(([request]) => request.pagination)).toEqual([{ offset: 0, limit: 2 }, { offset: 2, limit: 2 }]);
  expect(warn).toHaveBeenCalledTimes(allowPartial ? 1 : 0);
});

it('checks cancellation after a response before using it or describing a source', async () => {
  const controller = new AbortController(), source = runner(), describe = vi.fn();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  source.run.mockImplementation(async () => { controller.abort(Error('cancelled after read')); return forbidden; });
  await expect(fetchComplete(query(), source, 'scope', controller.signal, {}, false, describe, true)).rejects.toThrow('cancelled after read');
  expect(source.run).toHaveBeenCalledTimes(1);
  expect(describe).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
});
