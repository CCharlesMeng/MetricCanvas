import { expect, it } from 'vitest';
import { formatValue } from '../src/shared/value-format';
import { formatChartNumber } from '../src/shared/chart-option';

it.each([
  [1234.4, '1234'], [1234.5, '1235'], [-1234.4, '-1234'], [-1234.5, '-1235'],
  [9.999, '10'], [0.5, '1'], [-0.5, '-1'], [0.4, '0'], [-0.4, '0'], [-0, '0'],
  [0, '0'], [1234, '1234'], ['12.6', '13'], [null, '--'], [undefined, '--'],
  [NaN, '--'], [Infinity, '--'], [-Infinity, '--'], ['未计算', '未计算']
] as const)('formats %s as integer %s', (value, expected) => {
  expect(formatValue(value, 'number-0')).toBe(expected);
});

it('shares integer formatting with chart labels and keeps existing precision unchanged', () => {
  expect(formatChartNumber(1234.5, 'number-0')).toBe('1235');
  expect(formatValue(null, 'number-0', '未提供')).toBe('未提供');
  expect(formatValue(1234.5678, 'number')).toBe('1234.5678');
  expect(formatValue(1234.5678, 'number-1')).toBe('1234.6');
  expect(formatValue(1234.5678, 'number-grouped')).toBe('1,234.568');
});
