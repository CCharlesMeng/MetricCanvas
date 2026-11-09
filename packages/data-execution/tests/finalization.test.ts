import {afterEach, describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {parsePage, type PageDocument} from '@metriccanvas/page';
import type {FilterDeclaration, Page} from '@metriccanvas/page/internal';
import {resolveFinalizationDates, type FinalizationSourceDefinition} from '../src/finalization';
import {initialFilterValues} from '../src/filter-values';
import {createPageDataExecutor} from '../src/execute';
import {createDqeGateway} from '../src/dqe';
import type {RuntimeDataGateway} from '../src/ports';

const now = new Date(2026, 10, 9, 12);
const source: FinalizationSourceDefinition = {body: {dsl_list: [{object: 'synthetic-cutoffs'}]}, nameField: '名称', dateField: '截止日期'};
const filters: FilterDeclaration[] = [{id: 'period', type: 'timeRange', display: 'period', precision: 'month', default: {mode: 'month', finalizationName: '经营数据'}}];
const page = {id: 'finalization-test', filters};
function gateway(rows: Record<string, string | null>[] = [{name: '经营数据', date: '2026-10-18'}]): RuntimeDataGateway {
  return {finalizationSource: source, fetchData: vi.fn(async () => ({rows}))};
}
function document(): PageDocument {
  const value = JSON.parse(readFileSync(new URL('../../page/fixtures/contract-valid/dashboard-period-filter.json', import.meta.url), 'utf8'));
  value.schemaVersion = '6.104'; value.filters[0].default = filters[0]!.default;
  return value;
}
afterEach(() => {vi.useRealTimers(); vi.restoreAllMocks();});

describe('page-scoped finalization initialization', () => {
  it('queries once for the entire group and preserves the configured query', async () => {
    const base = gateway([{name: '经营数据', date: '2026-10-18'}, {name: '审批数据', date: '2026-09-30'}]);
    const configured = structuredClone(source);
    const declarations: FilterDeclaration[] = [...filters, {id: 'date', type: 'timePoint', granularity: 'date', default: {finalizationName: '审批数据'}}];
    const dates = await resolveFinalizationDates({...page, filters: declarations}, base, now);
    expect(Object.fromEntries(dates)).toEqual({'经营数据': '2026-10-18', '审批数据': '2026-09-30'});
    expect(base.fetchData).toHaveBeenCalledTimes(1);
    expect(base.fetchData).toHaveBeenCalledWith(expect.objectContaining({language: 'dqe', body: source.body, fieldMappings: expect.objectContaining({date: expect.objectContaining({queryField: '截止日期'})})}), {pageId: page.id}, expect.any(AbortSignal));
    expect(source).toEqual(configured);
    expect(initialFilterValues(declarations, now, undefined, 0, dates).get('date')).toEqual({type: 'timePoint', granularity: 'date', value: '2026-09-30'});
  });
  it.each([
    ['year', '2026-01', '2026-12'], ['quarter', '2026-10', '2026-12'], ['month', '2026-10', '2026-10'], ['last12Months', '2025-11', '2026-10']
  ] as const)('adapts a day to complete %s periods', async (mode, from, to) => {
    const declarations: FilterDeclaration[] = [{...filters[0] as Extract<FilterDeclaration, {type: 'timeRange'}>, default: {mode, finalizationName: '经营数据'}}];
    const dates = await resolveFinalizationDates({...page, filters: declarations}, gateway(), now);
    expect(initialFilterValues(declarations, now, undefined, 0, dates).get('period')).toMatchObject({type: 'timeRange', from, to, selection: {mode}});
  });
  it.each(['date', 'month'] as const)('adapts timePoint and ordinary ranges to %s', async granularity => {
    const declarations: FilterDeclaration[] = [{id: 'point', type: 'timePoint', granularity, default: {finalizationName: '经营数据'}}, {id: 'range', type: 'timeRange', precision: granularity, default: {finalizationName: '经营数据'}}];
    const dates = await resolveFinalizationDates({...page, filters: declarations}, gateway(), now);
    const values = initialFilterValues(declarations, now, undefined, 0, dates);
    const date = granularity === 'month' ? '2026-10' : '2026-10-18';
    expect(values.get('point')).toMatchObject({value: date}); expect(values.get('range')).toMatchObject({from: date, to: date});
  });
  it.each([
    [], [{name: '其他', date: '2026-10-18'}], [{name: '经营数据', date: null}], [{name: '经营数据', date: '2026-02-30'}],
    [{name: '经营数据', date: '2026-10-18'}, {name: '经营数据', date: '2026-09-30'}]
  ].map(rows => [rows]))('falls back to the captured current date for missing or invalid records', async rows => {
    const dates = await resolveFinalizationDates(page, gateway(rows), now);
    expect(dates.get('经营数据')).toBe('2026-11-09');
  });
  it('accepts identical duplicate records and trims names', async () => {
    const dates = await resolveFinalizationDates(page, gateway([{name: ' 经营数据 ', date: '2026-10-18'}, {name: '经营数据', date: '2026-10-18'}]), now);
    expect(dates.get('经营数据')).toBe('2026-10-18');
  });
  it('falls back on failed, unconfigured and partial queries', async () => {
    const failed: RuntimeDataGateway = {...gateway(), fetchData: vi.fn().mockRejectedValue(new Error('private upstream failure'))};
    const partial: RuntimeDataGateway = {...gateway(), fetchData: vi.fn().mockResolvedValue({rows: [], totalCount: 3})};
    const unconfigured: RuntimeDataGateway = {fetchData: vi.fn()};
    for (const base of [failed, partial, unconfigured]) expect((await resolveFinalizationDates(page, base, now)).get('经营数据')).toBe('2026-11-09');
    expect(unconfigured.fetchData).not.toHaveBeenCalled();
  });
  it('times out even if an adapter ignores cancellation', async () => {
    vi.useFakeTimers();
    const base: RuntimeDataGateway = {...gateway(), finalizationSource: {...source, timeoutMs: 10}, fetchData: () => new Promise(() => {})};
    const pending = resolveFinalizationDates(page, base, now);
    await vi.advanceTimersByTimeAsync(11);
    expect((await pending).get('经营数据')).toBe('2026-11-09');
  });
  it('cancels an obsolete page without publishing a fallback', async () => {
    const controller = new AbortController();
    const base: RuntimeDataGateway = {...gateway(), fetchData: () => new Promise(() => {})};
    const pending = resolveFinalizationDates(page, base, now, controller.signal);
    controller.abort(new Error('page disposed'));
    await expect(pending).rejects.toThrow('page disposed');
  });
  it('does not cache across page instances or query ordinary pages', async () => {
    const base = gateway();
    await resolveFinalizationDates(page, base, now); await resolveFinalizationDates(page, base, now);
    expect(base.fetchData).toHaveBeenCalledTimes(2);
    await resolveFinalizationDates({id: 'ordinary'}, base, now);
    expect(base.fetchData).toHaveBeenCalledTimes(2);
  });
  it('validates resolved dates against the real clock and falls back when future dates are disabled', async () => {
    const declaration: FilterDeclaration = {id: 'point', type: 'timePoint', granularity: 'date', default: {finalizationName: '经营数据'}};
    const values = initialFilterValues([declaration], now, undefined, 0, new Map([['经营数据', '2027-01-01']]));
    expect(values.get('point')).toMatchObject({value: '2026-11-09'});
  });
  it('falls back when a calendar-valid cutoff cannot produce the requested twelve-month window', () => {
    const declaration: FilterDeclaration = {id:'period',type:'timeRange',display:'period',precision:'month',default:{mode:'last12Months',finalizationName:'经营数据'}};
    expect(initialFilterValues([declaration], now, undefined, 0, new Map([['经营数据','0001-01-01']])).get('period')).toMatchObject({from:'2025-12',to:'2026-11'});
  });
  it('uses the configured DQE transport and normalizes external name/date fields', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({retCode:'CBC.0000', results:[{code:'SUCCESS', data:[{'名称':'经营数据','截止日期':'2026-10-18'}], total_count:1}]}), {headers:{'content-type':'application/json'}}));
    const base = createDqeGateway({endpoint:'https://example.test/dqe', finalizationSource:source, fetchImpl});
    expect((await resolveFinalizationDates(page, base, now)).get('经营数据')).toBe('2026-10-18');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('shares the finalization path with one-shot prefetch', async () => {
    const metadata = document();
    const base: RuntimeDataGateway = {...gateway(), fetchData: vi.fn(async query => query.fieldMappings.name ? {rows: [{name: '经营数据', date: '2026-10-18'}]} : {rows: []})};
    expect(parsePage(metadata).ok).toBe(true);
    await createPageDataExecutor({gateway: base, now}).execute(metadata);
    const calls = vi.mocked(base.fetchData).mock.calls;
    expect(calls[0]![0].fieldMappings.name).toBeDefined();
    expect(calls.slice(1).some(([query]) => query.filterValues.some(value => value.target === 'time' && value.value.from.startsWith('2026-10')))).toBe(true);
    expect((metadata.filters![0] as Extract<FilterDeclaration, {type: 'timeRange'}>).default).toEqual({mode: 'month', finalizationName: '经营数据'});
  });
});
