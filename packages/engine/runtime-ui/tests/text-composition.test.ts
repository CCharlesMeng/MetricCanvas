import { describe, expect, it } from 'vitest';
import fixture from '../../../../pages/report-date-filter-example.json';
import { parsePage } from '@metriccanvas/page';
import { collectFilterTextValueReferences, resolveParamTextValues } from '@metriccanvas/page/internal';
import { createFilterState, initialFilterValues, initializePageParams, resolvePageParams } from '../../runtime/src';
import { filterTextPage } from '../src/filter-text';

describe('composed report title state and export', () => {
  it('updates multiple references in whole text slots, preserves parameter text and freezes an export capture', () => {
    const parsed = parsePage(fixture); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
    const params = resolvePageParams('', parsed.page.params ?? []);
    const loaded = initializePageParams(parsed.page, params.values);
    const bindings = collectFilterTextValueReferences(resolveParamTextValues(fixture, { values: params.values }));
    const state = createFilterState(initialFilterValues(loaded.filters ?? []));
    let shown = loaded;
    const stop = state.subscribe(values => { shown = filterTextPage(loaded, bindings, values); });
    const title = () => (shown.sections[0].components[0].props as any).title;
    expect(title()).toBe('2026-09 经营分析报告');
    state.write('report-month', { type: 'timePoint', granularity: 'month', value: '2026-10' });
    state.write('report-range', { type: 'timeRange', from: '2026-02', to: '2026-04' });
    expect(title()).toBe('2026-10 经营分析报告');
    expect((shown.sections[1].components[1].props as any).body).toBe('当前：2026-10；对照：2026-02 至 2026-04');
    const capture = structuredClone(shown);
    state.write('report-range', { type: 'timeRange', from: '2026-03', to: '2026-03' });
    expect((shown.sections[0].components[0].props as any).asOf.value).toBe('2026-03 对照分析');
    state.write('report-month', { type: 'timePoint', granularity: 'month', value: 'invalid' });
    expect(title()).toBe('2026-10 经营分析报告');
    state.write('report-month', null);
    expect(title()).toBe('全部期间 经营分析报告');
    expect((capture.sections[0].components[0].props as any).title).toBe('2026-10 经营分析报告');
    expect((shown.sections[0].components[0].props as any).subtitle).toBe('打开时名称：经营分析报告；已应用月份：全部期间');
    expect(shown.dataSources).toBe(loaded.dataSources);
    expect(params.values.get('report-name')).toBe('经营分析报告');
    expect((fixture.sections[0].components[0].props as any).title.parts).toHaveLength(3);
    stop();
  });
});
