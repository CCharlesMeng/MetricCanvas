import { describe, expect, it } from 'vitest';
import { formatValue } from '../src/shared/value-format';
import { formatTime, timeInstant } from '../src/shared/time-format';
const format = { type: 'time', pattern: 'YYYY-MM-DD HH:mm:ss' } as const;

describe('fixed UTC+8 time formatting', () => {
  it.each([
    ['2026-11-09T18:30:00Z', '2026-11-10 02:30:00'],
    ['2026-11-09T18:30:00.123456789Z', '2026-11-10 02:30:00'],
    ['2026-11-09T18:30:00+00:00', '2026-11-10 02:30:00'],
    ['2026-11-10T02:30:00+0800', '2026-11-10 02:30:00'],
    ['2026-11-09T13:30:00-05:00', '2026-11-10 02:30:00'],
    ['2026-11-09 18:30:00', '2026-11-10 02:30:00'],
    ['2026/11/9 18:30', '2026-11-10 02:30:00'],
    ['2026.11.09 18:30:00 UTC', '2026-11-10 02:30:00'],
    ['2026年11月09日 18:30:00', '2026-11-10 02:30:00'],
    ['20261109T183000Z', '2026-11-10 02:30:00'],
    ['20261109183000', '2026-11-10 02:30:00'],
    ['20261109', '2026-11-09 08:00:00'],
    ['2026-11-09', '2026-11-09 08:00:00'],
    [0, '1970-01-01 08:00:00'],
    [1794249000, '2026-11-10 02:30:00'],
    [1794249000000, '2026-11-10 02:30:00'],
    ['1794249000000', '2026-11-10 02:30:00'],
    [1794249000.123, '2026-11-10 02:30:00'],
    ['2024-02-29T23:00:00Z', '2024-03-01 07:00:00'],
    ['2026-12-31T18:30:00Z', '2027-01-01 02:30:00']
  ])('formats %s deterministically', (input, expected) => {
    expect(formatValue(input, format)).toBe(expected);
  });
  it.each(['2026-02-30T18:30:00Z', '20260230', '2026-11-09T24:00:00Z', '2026-11-09T18:60:00Z', '2026-11-09T18:00:00+14:01', 'not-a-date', '11/09/2026', '2026', '1794249000000000', '9999-12-31T23:00:00Z'])('preserves invalid or ambiguous %s', value => {
    expect(timeInstant(value)).toBeUndefined();
    expect(formatTime(value, format)).toBe(value);
  });
  it('supports patterns, missing text and legacy formats', () => {
    const value = '2026-11-09T18:30:00Z';
    expect(formatValue(value, { type: 'time', pattern: 'YYYY/MM/DD HH:mm' })).toBe('2026/11/10 02:30');
    expect(formatValue(value, { type: 'time', pattern: 'YYYY年MM月DD日' })).toBe('2026年11月10日');
    expect(formatValue(null, format)).toBe('--');
    expect(formatValue(undefined, format, '无')).toBe('无');
    expect(formatValue(value, 'date')).toBe('2026-11-09');
    expect(formatValue(12.5, 'number-2')).toBe('12.5');
  });
});
