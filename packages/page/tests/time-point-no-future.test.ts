import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resolvePageParams, validate, validateTimePointValue } from '../src/internal';

const load = () => JSON.parse(readFileSync(new URL('../../../pages/time-point-no-future.json', import.meta.url), 'utf8'));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 15, 12)); });
afterEach(() => vi.useRealTimers());

it('允许当前期间，拒绝未来月份和日期；未声明时保持原有能力', () => {
  expect(validate(load())).toEqual([]);
  expect(validateTimePointValue('2026-10', 'month', undefined, true)).toBeUndefined();
  expect(validateTimePointValue('2026-11', 'month', undefined, true)).toContain('不得晚于');
  expect(validateTimePointValue('2026-10-15', 'date', undefined, true)).toBeUndefined();
  expect(validateTimePointValue('2026-10-16', 'date', undefined, true)).toContain('不得晚于');
  expect(validateTimePointValue('2027-01', 'month')).toBeUndefined();
  expect(validateTimePointValue('2027-01', 'month', undefined, false)).toBeUndefined();
});

it('月份上限随时间推进，并与已有下限共同生效', () => {
  vi.setSystemTime(new Date(2026, 10, 1));
  expect(validateTimePointValue('2026-11', 'month', '2020-06', true)).toBeUndefined();
  expect(validateTimePointValue('2020-05', 'month', '2020-06', true)).toContain('不得早于');
  expect(validateTimePointValue('2026-12', 'month', '2020-06', true)).toContain('不得晚于');
});

it('非法默认值和旧版本声明拒绝；页面参数不能绕过上限', () => {
  const page = load(); page.filters[0].default = '2026-11';
  expect(validate(page)).toEqual(expect.arrayContaining([expect.objectContaining({ path: '/filters/0/default', message: expect.stringContaining('不得晚于') })]));
  page.filters[0].default = '2026-10'; page.schemaVersion = '6.24';
  expect(validate(page).some(e => e.message.includes('由 6.25 引入'))).toBe(true);
  const paramPage = JSON.parse(readFileSync(new URL('../../../pages/sdt/commercial-sdt-efficiency-ultimate-monthly.json', import.meta.url), 'utf8'));
  expect(resolvePageParams(paramPage).ok).toBe(true);
  expect(resolvePageParams(paramPage, { 'report-period': { start: '2026-11', end: '2026-11' } }).ok).toBe(false);
});
