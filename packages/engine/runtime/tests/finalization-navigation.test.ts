import {describe, expect, it} from 'vitest';
import {initialFilterValues} from '@metriccanvas/data-execution/runtime';
import type {FilterDeclaration} from '@metriccanvas/page/internal';
import {createFilterState, filterSearch, parseFilterSearch} from '../src/filter-state';
import {navigationHref} from '../src/navigate';
const now = new Date(2026, 10, 9);
const filter: FilterDeclaration = {id: 'period', type: 'timeRange', display: 'period', precision: 'date', default: {mode: 'last12Months', finalizationName: '经营数据'}};
const initial = () => initialFilterValues([filter], now, undefined, 0, new Map([['经营数据', '2026-08-18']]));
describe('finalized periods keep their applied window', () => {
  it('roundtrips an anchored twelve-month window across clocks', () => {
    const values = initial();
    const state = createFilterState(values, [filter], new Map(), {now: () => now});
    const observed: unknown[] = [];
    const release = state.subscribe(value => observed.push(value.get('period')));
    expect(observed[0]).toMatchObject({from: '2025-09-01', to: '2026-08-31'}); release();
    const search = filterSearch(values, [filter]);
    expect(search).toContain('period.from=2025-09-01');
    expect(parseFilterSearch(search, [filter], new Date(2027, 1, 1))).toEqual(values);
  });
  it('uses existing explicit navigation bindings to preserve mode and exact boundaries', () => {
    const href = navigationHref({href: '/pages/detail', query: {
      period: {source: 'filter', id: 'period'},
      'period.from': {source: 'filter', id: 'period', part: 'from'},
      'period.to': {source: 'filter', id: 'period', part: 'to'}
    }}, initial(), new Map());
    expect(parseFilterSearch(new URL(href, 'https://example.test').search, [filter], new Date(2027, 1, 1))).toEqual(initial());
  });
  it.each(['period=last12Months&period.from=2025-09-01', 'period=last12Months&period.from=2025-09-02&period.to=2026-08-31'])('rejects incomplete or truncated inherited windows', search => {
    expect(parseFilterSearch(search, [filter], now).has('period')).toBe(false);
  });
  it('keeps the legacy unanchored rolling rule', () => {
    expect(parseFilterSearch('period=last12Months', [filter], now).get('period')).toMatchObject({from: '2025-11-01', to: '2026-10-31'});
  });
});
