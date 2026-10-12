import { describe, expect, it } from 'vitest';
import fixture from '../../../page/fixtures/contract-valid/report-date-filters-page.json';
import { parsePage } from '@metriccanvas/page';
import { collectFilterTextValueReferences, resolveParamTextValues } from '@metriccanvas/page/internal';
import { createFilterState, initialFilterValues, initializePageParams, resolvePageParams, type FilterValues } from '../../runtime/src';
import { filterText, filterTextPage } from '../src/filter-text';
import { headerPeriod } from '../src/report-date-header';

describe('filter text presentation and export capture', () => {
  it.each([
    ['month', '2026-01', '2026-05'],
    ['date', '2026-01-01', '2026-05-31']
  ] as const)('displays %s singles, ranges and equal endpoints consistently', (granularity, from, to) => {
    const state = createFilterState(); const ref = { filter: 'period', format: 'period' } as const;
    state.write('period', { type: 'timePoint', granularity, value: from });
    let values: FilterValues = initialFilterValues([]); const stop = state.subscribe(next => { values = next; });
    expect(filterText(ref, values)).toBe(from);
    state.write('period', { type: 'timeRange', from, to });
    expect(filterText(ref, values)).toBe(`${from} 至 ${to}`);
    state.write('period', { type: 'timeRange', from, to: from });
    expect(filterText(ref, values)).toBe(from);
    state.write('period', { type: 'timeRange', from: to, to: from });
    expect(filterText(ref, values)).toBe(from); // invalid draft never enters applied state
    state.write('period', null);
    expect(filterText(ref, values)).toBe('全部期间'); stop();
  });
  it('updates multiple text slots, preserves static text and parameters, and freezes exported text', () => {
    const raw = structuredClone(fixture) as any; raw.schemaVersion = '6.15';
    raw.sections[0].components[0].props.asOf = { label: '报告期间', value: { filter: 'period-filter', format: 'period' } };
    raw.sections[0].components[0].props.subtitle = { param: 'period', format: 'period' };
    raw.params.display = [{ id: 'optional-tag', type: 'string', required: false }];
    raw.sections[0].components[0].props.tags = [{ param: 'optional-tag' }, { filter: 'period-filter', format: 'period' }];
    raw.sections.push({ id: 'caption', title: { filter: 'period-filter', format: 'period' }, components: [{ id: 'caption-text', type: 'text', layout: { span: 12 }, props: { body: { filter: 'period-filter', format: 'period' } } }] });
    const parsed = parsePage(raw); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
    const params = resolvePageParams('', parsed.page.params ?? []);
    const loaded = initializePageParams(parsed.page, params.values);
    const bindings = collectFilterTextValueReferences(resolveParamTextValues(raw, { values: params.values }));
    const state = createFilterState(initialFilterValues(loaded.filters ?? []));
    let shown = loaded; const stop = state.subscribe(values => { shown = filterTextPage(loaded, bindings, values); });
    state.write('period-filter', { type: 'timeRange', from: '2026-02', to: '2026-04' });
    const header = shown.sections[0].components[0]; if (header.type !== 'reportHeader') throw Error('header');
    expect(header.props.asOf?.value).toBe('2026-02 至 2026-04');
    expect(header.props.subtitle).toBe('2026-01 至 2026-06');
    expect(header.props.tags).toEqual(['2026-02 至 2026-04']);
    expect(shown.sections[2].title).toBe('2026-02 至 2026-04');
    expect(params.values.get('period')).toEqual({ start: '2026-01', end: '2026-06' });
    expect(shown.dataSources).toBe(loaded.dataSources);
    const capture = structuredClone(shown);
    state.write('period-filter', { type: 'timeRange', from: '2026-03', to: '2026-05' });
    expect((capture.sections[0].components[0].props as any).asOf.value).toBe('2026-02 至 2026-04');
    expect((shown.sections[0].components[0].props as any).asOf.value).toBe('2026-03 至 2026-05'); stop();
  });
  it('gates implicit legacy header overriding instead of inventing text in new pages', () => {
    const props = { title: '报告', filterIds: ['period'], asOf: { label: '版本', value: '静态初稿' } };
    const values = new Map([['period', { type: 'timeRange' as const, from: '2026-01', to: '2026-05' }]]);
    const filters = [{ id: 'period', type: 'timeRange' as const }];
    expect(headerPeriod(props, filters, values, '6.14')).toBe('2026-01 至 2026-05');
    expect(headerPeriod(props, filters, values, '6.15')).toBeUndefined();
  });
});
