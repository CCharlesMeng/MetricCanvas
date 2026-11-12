import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { resolvePeriodSelection, type DataSnapshot, type EffectiveQuery, type QueryDataSource } from '@metriccanvas/page/internal';
import { createPeriodAggregationPreview } from '../../../apps/playground/fixtures/period-aggregation';
import { composeEffectiveQuery, executeQuery } from '../src/effective-query';
import { initialFilterValues } from '../src/filter-values';
import { createSourceProgram } from '../src/source-program/session';
import { effectiveDqeItem } from '../src/dqe/dqe';
import { evaluateTableView } from '../src/table-view';

function setup(state = 'ready') {
  const parsed = parsePage(JSON.parse(readFileSync('pages/capabilities/data/sdt-period-aggregation.json', 'utf8')));
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page, now = new Date('2026-11-07T04:00:00Z');
  const values = initialFilterValues(page.filters!, now), preview = createPeriodAggregationPreview(state);
  const query = () => composeEffectiveQuery({ page, dataSource: page.dataSources['rep-office-efficiency'] as QueryDataSource, filters: page.filters }, values, 0, [], {});
  return { page, now, values, preview, query };
}
it('folds 12 completed months by office with sum, arithmetic mean, zero and all-null values', async () => {
  const test = setup(), saved = structuredClone(test.page);
  const result = await executeQuery(test.query(), test.preview.dataGateway, {});
  expect(result).toMatchObject({ status: 'ready', totalCount: 3, rows: [
    { 'rep-office': '合成代表处甲', 'decision-count': 120, 'avg-decision-time': 6.5 },
    { 'rep-office': '合成代表处乙', 'decision-count': 60, 'avg-decision-time': 0 },
    { 'rep-office': '合成代表处丙', 'decision-count': null, 'avg-decision-time': null }
  ] });
  const items = test.preview.requests.map(effectiveDqeItem);
  expect(items).toHaveLength(12);
  expect(items[0]).toMatchObject({ filter: { time: { period: 'month', start: '2025-11', end: '2025-11', is_aggregate: true } } });
  expect(items[11]).toMatchObject({ filter: { time: { start: '2026-10', end: '2026-10' } } });
  expect(test.preview.requests.every(query => !query.periodAggregation && !query.pagination)).toBe(true);
  expect(test.page).toEqual(saved);
});
it('only activates for last12Months; month selection keeps one ordinary request and resets captured aggregation', async () => {
  const test = setup();
  test.values.set('period', { type: 'timeRange', ...resolvePeriodSelection({ mode: 'month', value: '2026-10' }, test.now) });
  const query = test.query();
  expect(query.periodAggregation).toBeUndefined();
  expect(await executeQuery(query, test.preview.dataGateway, {})).toMatchObject({ status: 'ready', rows: [{ 'decision-count': 10, 'avg-decision-time': 10 }, {}, {}] });
  expect(test.preview.requests).toHaveLength(1);
});
it('averages existing monthly values without adding absent months or replacing nulls with zero', async () => {
  const test = setup('missing');
  const result = await executeQuery(test.query(), test.preview.dataGateway, {});
  expect(result.status === 'ready' && result.rows.find(row => row['rep-office'] === '合成代表处乙')).toMatchObject({ 'decision-count': 55, 'avg-decision-time': 0 });
  let month = 0;
  const gateway = { async fetchData() { month++; return { rows: [{ 'rep-office': '甲', 'decision-count': 0, 'avg-decision-time': month <= 2 ? 6 : null }], totalCount: 1 }; } };
  expect(await executeQuery(test.query(), gateway, {})).toMatchObject({ rows: [{ 'decision-count': 0, 'avg-decision-time': 6 }] });
});
it.each(['error', 'truncated', 'duplicate'])('refuses %s monthly inputs without publishing a partial annual result', async state => {
  const test = setup(state);
  expect(await executeQuery(test.query(), test.preview.dataGateway, {})).toMatchObject({ status: 'error' });
});
it('filters and sorts annual values before selecting a window', async () => {
  const test = setup(), query = test.query();
  query.filterValues.push({ target: 'metricRange', metric: '商审审批人决策次数', from: 100 });
  query.sort = [{ queryField: '商审审批人决策次数', direction: 'desc' }];
  query.pagination = { offset: 0, limit: 1 };
  expect(await executeQuery(query, test.preview.dataGateway, {})).toMatchObject({ status: 'ready', totalCount: 1, rows: [{ 'rep-office': '合成代表处甲', 'decision-count': 120 }] });
  expect(test.preview.requests.every(query => !query.filterValues.some(value => value.target === 'metricRange'))).toBe(true);
});
it('shares the complete folded snapshot between table and chart, exports all groups and rejects stale seeds', async () => {
  const test = setup(), program = createSourceProgram(test.page, { gateway: test.preview.dataGateway, now: test.now });
  const snapshots = new Map<string, DataSnapshot>();
  try {
    for await (const update of program.read({ roots: ['rep-office-efficiency'], conditions: test.values, seeds: new Map([['rep-office-efficiency', { status: 'ready', rows: [{ 'rep-office': '旧数据' }], totalCount: 1 }]]) })) {
      snapshots.set(update.sourceId, update.snapshot);
      expect(update.initial).toBeUndefined();
    }
    const result = snapshots.get('rep-office-efficiency')!;
    expect(result).toMatchObject({ status: 'ready', totalCount: 3 });
    if (result.status !== 'ready') throw Error('missing result');
    const view = { pageIndex: 0, pageSize: 2, sort: [{ field: 'decision-count', direction: 'desc' as const }], predicates: [] };
    expect(evaluateTableView(result.rows, view).rows).toHaveLength(2);
    expect(evaluateTableView(result.rows, { ...view, pageIndex: 1 }).rows).toHaveLength(1);
    const candidates = await program.readColumnCandidates({ sourceId: 'rep-office-efficiency', field: 'rep-office', conditions: test.values, view });
    expect(candidates).toMatchObject({ kind: 'values', totalCount: 3 });
    for await (const update of program.read({ roots: ['rep-office-efficiency'], conditions: test.values, purpose: 'complete' })) expect(update.snapshot).toMatchObject({ status: 'ready', totalCount: 3 });
    expect(test.preview.requests).toHaveLength(12);
  } finally { program.dispose(); }
});
it('propagates cancellation without continuing the remaining monthly queries', async () => {
  const test = setup(), controller = new AbortController(), fetchData = vi.fn(async (_query: EffectiveQuery) => {
    controller.abort(); return { rows: [], totalCount: 0 };
  });
  const result = await executeQuery(test.query(), { fetchData }, {}, controller.signal);
  expect(result).toMatchObject({ status: 'error' });
  expect(fetchData).toHaveBeenCalledTimes(1);
});
it('rebuilds a captured annual query when the applied selection changes to month', async () => {
  const test = setup(), program = createSourceProgram(test.page, { gateway: test.preview.dataGateway, now: test.now });
  const captured = program.captureQueries(test.values, new Map(), new Map());
  test.values.set('period', { type: 'timeRange', ...resolvePeriodSelection({ mode: 'month', value: '2026-10' }, test.now) });
  try {
    for await (const update of program.read({ roots: ['rep-office-efficiency'], conditions: test.values, queries: captured })) {
      expect(update.query?.periodAggregation).toBeUndefined();
      expect(update.snapshot).toMatchObject({ status: 'ready', rows: [{ 'decision-count': 10 }, {}, {}] });
    }
    expect(test.preview.requests).toHaveLength(1);
  } finally { program.dispose(); }
});
it('rejects monthly input beyond the complete-read budget', async () => {
  const test = setup();
  const gateway = { async fetchData() { return { rows: Array.from({ length: 10001 }, (_, index) => ({ 'rep-office': String(index), 'decision-count': 1, 'avg-decision-time': 1 })), totalCount: 10001 }; } };
  expect(await executeQuery(test.query(), gateway, {})).toMatchObject({ status: 'error', error: { message: expect.stringContaining('10000') } });
});
it('retains dimension exclusion through monthly requests and annual projection', async () => {
  const test = setup(), query = test.query();
  query.filterValues.push({target:'dimension',queryField:'代表处',values:['合成代表处甲'],operator:'!='});
  const gateway = {async fetchData(monthly:EffectiveQuery){
    expect(monthly.filterValues).toContainEqual({target:'dimension',queryField:'代表处',values:['合成代表处甲'],operator:'!='});
    const result=await test.preview.dataGateway.fetchData(monthly);
    const rows=result.rows.filter(row=>row['rep-office']!=='合成代表处甲');
    return {...result,rows,totalCount:rows.length};
  }};
  expect(await executeQuery(query,gateway,{})).toMatchObject({status:'ready',totalCount:2,rows:[{'rep-office':'合成代表处乙'},{'rep-office':'合成代表处丙'}]});
});
