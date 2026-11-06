import { describe, expect, it } from 'vitest';
import { formatValue } from '../src/shared/value-format';

describe('explicit trimmed money formats', () => {
  it.each([
    [0, '0元', '0'], [999, '999元', '999'], [9999.6, '10,000元', '10,000'],
    [10000, '1万', '1万'], [12345, '1.2万', '1.2万'], [12500, '1.3万', '1.3万'],
    [50000, '5万', '5万'], [99999, '10万', '10万'], [100000, '10万', '10万'],
    [105000, '11万', '11万'], [1500000, '150万', '150万'],
    [99999999, '10,000万', '10,000万'], [99999999.6, '10,000万', '10,000万'],
    [100000000, '1亿', '1亿'], [123500000, '1.24亿', '1.24亿'],
    [250000000, '2.5亿', '2.5亿'], [999999999, '10亿', '10亿'],
    [1000000000, '10亿', '10亿'], [1235000000, '12.4亿', '12.4亿']
  ] as const)('CNY %s selects a band before rounding, without padding', (value, withYuan, withoutYuan) => {
    expect(formatValue(value, 'cny-adaptive-trimmed')).toBe(withYuan);
    expect(formatValue(value, 'cny-adaptive-trimmed-no-yuan')).toBe(withoutYuan);
  });

  it.each([
    [0, '0$'], [999, '999$'], [9999.6, '10,000$'], [10000, '10K'],
    [12345, '12.3K'], [12350, '12.4K'], [50000, '50K'], [999999, '1,000K'],
    [1000000, '1,000K'], [1005500, '1,006K'], [1500000, '1,500K'],
    [12345678, '12,346K'], [99999999, '100,000K'], [100000000, '100M'],
    [250000000, '250M'], [1000000000, '1,000M']
  ] as const)('USD %s selects $/K/M by the original value', (value, expected) => {
    expect(formatValue(value, 'usd-adaptive-km')).toBe(expected);
  });

  it.each([
    [105000, 'cny-adaptive-trimmed', '11万'],
    [12500, 'cny-adaptive-trimmed-no-yuan', '1.3万'],
    [123500000, 'cny-adaptive-trimmed', '1.24亿'],
    [1005500, 'usd-adaptive-km', '1,006K'],
    [15000000, 'usd-adaptive-km', '15,000K'],
    [100500000, 'usd-adaptive-km', '101M']
  ] as const)('negative %s uses the same magnitude rounding as positive', (value, format, expected) => {
    expect(formatValue(value, format)).toBe(expected);
    expect(formatValue(-value, format)).toBe(`-${expected}`);
  });

  it.each([
    ['cny-adaptive-trimmed', '0元', '1.2万'],
    ['cny-adaptive-trimmed-no-yuan', '0', '1.2万'],
    ['usd-adaptive-km', '0$', '12.3K']
  ] as const)('%s preserves missing values, numeric strings and zero', (format, zero, numericString) => {
    for (const value of [0, -0, -0.4]) expect(formatValue(value, format)).toBe(zero);
    for (const value of [null, undefined, NaN, Infinity, -Infinity]) expect(formatValue(value, format)).toBe('--');
    expect(formatValue('12345', format)).toBe(numericString);
    expect(formatValue('暂无', format)).toBe('暂无');
    expect(formatValue(null, format, '缺失')).toBe('缺失');
  });

  it('uses global device precision and strips zeros for standard adaptive formats', () => {
    expect(formatValue(10000, 'cny-adaptive')).toBe('1万');
    expect(formatValue(250000000, 'cny-adaptive')).toBe('2.5亿');
    expect(formatValue(1234.56, 'usd-adaptive')).toBe('1,235美元');
  });
});
