import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createFilterState, initialFilterValues, parseFilterSearch } from '../src/filter-state';
import type { FilterDeclaration } from '@metriccanvas/page/internal';

const page = () => JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/time-point-no-future.json', import.meta.url), 'utf8'));
const point = (value: string) => ({ type: 'timePoint' as const, granularity: 'month' as const, value });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 15, 12)); });
afterEach(() => vi.useRealTimers());

it('未来写入、批量写入及URL不能更新已应用月份，合法历史月份可用', () => {
  const declarations: FilterDeclaration[] = page().filters;
  const state = createFilterState(initialFilterValues(declarations), declarations);
  let values = initialFilterValues(declarations); state.subscribe(next => values = new Map(next));
  state.write('report-month', point('2026-11'));
  expect(values.get('report-month')).toEqual(point('2026-10'));
  state.writeMany([['report-month', point('2027-01')]]);
  state.fromURL('report-month=2026-11', declarations);
  expect(values.get('report-month')).toEqual(point('2026-10'));
  expect(parseFilterSearch('report-month=2026-11', declarations).size).toBe(0);
  state.write('report-month', point('2026-09'));
  expect(values.get('report-month')).toEqual(point('2026-09'));
});

it('外部初值不能越界，跨月后新月份可正常写入', () => {
  const declarations = page().filters;
  expect(() => createFilterState(new Map([['report-month', point('2026-11')]]), declarations)).toThrow('初值');
  const state = createFilterState(initialFilterValues(declarations), declarations);
  let current: unknown; state.subscribe(values => current = values.get('report-month'));
  vi.setSystemTime(new Date(2026, 10, 1));
  state.write('report-month', point('2026-11'));
  expect(current).toEqual(point('2026-11'));
});
