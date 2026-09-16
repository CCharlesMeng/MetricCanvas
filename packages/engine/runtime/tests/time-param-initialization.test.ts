import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import type { EffectiveQuery, DataSnapshot } from '@metriccanvas/page/internal';
import { createFilterState, initializePageParams, orchestrate, pageParamSearch, resolvePageParams } from '../src';
import { effectiveDqeItem } from '../../data-gateway/src/dqe';

const document = () => JSON.parse(readFileSync('pages/flow-analysis-report-params.json', 'utf8'));
function parse(raw: unknown): Page {
  const parsed = parsePage(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.page;
}

it('月份与代表处进入12个数据源，等价查询复用；跨年、空结果均不回退，模板不变', async () => {
  const raw = document();
  const before = JSON.stringify(raw);
  const parsed = parse(raw);
  for (const [month, previous, rollingStart, yearStart, queryCount] of [
    ['2026-03', '2026-02', '2025-04', '2026-01', 12],
    ['2027-01', '2026-12', '2026-02', '2027-01', 12],
    ['2099-12', '2099-11', '2099-01', '2099-01', 10]
  ] as const) {
    const inputs = resolvePageParams(`?report-month=${month}&representative-office=上海代表处`, parsed.params ?? []);
    expect(inputs.missing).toEqual([]);
    const loaded = initializePageParams(parsed, inputs.values);
    const queries: EffectiveQuery[] = [];
    let snapshots: ReadonlyMap<string, DataSnapshot> = new Map();
    const stream = orchestrate(loaded, {fetchData: async query => {
      queries.push(query);
      return { rows: [], totalCount: 0 };
    }}, createFilterState());
    const dispose = stream.subscribe(value => { snapshots = value; });
    try {
      await vi.waitFor(() => expect(queries).toHaveLength(queryCount));
      await vi.waitFor(() => expect([...snapshots.values()].every(s => s.status === 'empty')).toBe(true));
      const items = queries.map(effectiveDqeItem);
      const times = items.map(item => item.filter as {time: {start: string; end: string}}).map(f => f.time);
      expect(times.filter(t => t.start === month && t.end === month).length).toBeGreaterThanOrEqual(7);
      expect(times.filter(t => t.start === `${month.slice(0,4)}-01` && t.end === `${month.slice(0,4)}-12`).length).toBeGreaterThanOrEqual(2);
      for (const [id, start, end] of [
        ['flow-previous-month', previous, previous],
        ['flow-last-12-months', rollingStart, month],
        ['flow-year-to-date', yearStart, month]
      ]) {
        const source = loaded.dataSources[id].source;
        if (source.type !== 'query') throw new Error('expected query');
        expect(source.query.body.dsl_list[0].filter).toMatchObject({time: {start, end}});
        expect(times).toContainEqual(expect.objectContaining({start, end}));
      }
      for (const item of items) expect(item.filter).toMatchObject({dims:[{dim_name:'代表处',dim_value_list:['上海代表处']}]});
    } finally { dispose(); }
  }
  expect(JSON.stringify(raw)).toBe(before);
});

it('缺省使用保存值；显式非法时间不改用默认值；日期URL可往返', () => {
  const declarations = parse(document()).params ?? [];
  expect(resolvePageParams('', declarations).values.get('report-month')).toBe('2026-02');
  for (const value of ['202602', '2026-13', '', '2026-02&report-month=2026-03']) {
    const result = resolvePageParams(`report-month=${value}`, declarations);
    expect(result.missing).toContain('report-month');
    expect(result.values.has('report-month')).toBe(false);
  }
  const date = [{id:'as-of',type:'time',granularity:'date',required:true}] as const;
  const values = new Map([['as-of','2024-02-29']]);
  expect(resolvePageParams(pageParamSearch(values), date).values).toEqual(values);
  expect(resolvePageParams('as-of=2023-02-29', date).missing).toEqual(['as-of']);
});

it('时间实例不消费无法证明对应月份的内嵌旧行；标题同步使用实际参数', () => {
  const raw = document();
  raw.dataSources['flow-kpis'].source.initial = {capturedAt:'2026-02-28T00:00:00Z',rows:[]};
  const page = parse(raw);
  const values = resolvePageParams('report-month=2027-01',page.params ?? []).values;
  const loaded = initializePageParams(page,values);
  const source = loaded.dataSources['flow-kpis'].source;
  expect('initial' in source).toBe(false);
  expect(raw.dataSources['flow-kpis'].source.initial).toBeDefined();
  const displayed = parsePage(raw, {textValues:{values}});
  expect(displayed.ok).toBe(true);
  if (displayed.ok) expect(JSON.stringify(displayed.page.sections)).toContain('2027-01');
});
