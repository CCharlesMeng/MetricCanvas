import { describe, expect, it } from 'vitest';
import { resolveTimeWindow } from '../src/time-param';

describe('确定性日历窗口，不读取系统日期或最新数据期', () => {
  it.each([
    ['2026-03', { kind: 'period', unit: 'month' }, '2026-03', '2026-03'],
    ['2026-01', { kind: 'period', unit: 'month', offset: -1 }, '2025-12', '2025-12'],
    ['2026-03', { kind: 'period', unit: 'year', offset: -1 }, '2025-01', '2025-12'],
    ['2026-03', { kind: 'lastN', unit: 'month', n: 12 }, '2025-04', '2026-03'],
    ['2026-03', { kind: 'toDate', unit: 'year' }, '2026-01', '2026-03'],
    ['2024-03-01', { kind: 'lastN', unit: 'day', n: 7 }, '2024-02-24', '2024-03-01'],
    ['2024-02-29', { kind: 'period', unit: 'month' }, '2024-02-01', '2024-02-29'],
    ['2024-02-29', { kind: 'period', unit: 'year', offset: -1 }, '2023-01-01', '2023-12-31'],
    ['2026-03-15', { kind: 'toDate', unit: 'month' }, '2026-03-01', '2026-03-15'],
  ] as const)('%s / %j', (value, window, start, end) => {
    expect(resolveTimeWindow(value, window)).toEqual({ start, end });
  });
  it.each(['2026-02-29', '2026-13', '202603', '0000-01', '2026-03-01T00:00:00Z'])('拒绝非法时间 %s', value => {
    expect(() => resolveTimeWindow(value, {kind:'period',unit:'month'})).toThrow();
  });
  it('不猜测月内日期且拒绝越界年份', () => {
    expect(() => resolveTimeWindow('2026-03', {kind:'period',unit:'day'})).toThrow();
    expect(() => resolveTimeWindow('0001-01', {kind:'lastN',unit:'month',n:2})).toThrow();
  });
});
