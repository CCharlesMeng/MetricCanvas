import { describe, expect, it } from 'vitest';
import { formatValue, valuePolarity } from '../src/shared/value-format';

describe('formatValue', () => {
  it('无格式时保持存量直观输出,空值显示占位符', () => {
    expect(formatValue(1234.5)).toBe('1234.5');
    expect(formatValue('06-23')).toBe('06-23');
    expect(formatValue(null)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
  });

  it('按封闭预设格式化精度和千分位', () => {
    expect(formatValue(123456.789, 'number-2')).toBe('123456.79');
    expect(formatValue(123456.789, 'number-grouped')).toBe('123,456.789');
  });

  it('压缩万/亿并保留数量级单位，供排行等组件继承', () => {
    expect(formatValue(1_070_000, 'compact-wan-0')).toBe('107万');
    expect(formatValue(866_160_000_000, 'compact-yi-1')).toBe('8,661.6亿');
  });

  it.each([
    [9_999, '9,999元'],
    [10_000, '1.00万'],
    [99_999, '10.00万'],
    [100_000, '10万'],
    [99_999_999, '10,000万'],
    [100_000_000, '1.00亿'],
    [999_999_999, '10.00亿'],
    [1_000_000_000, '10.0亿'],
    [-9_999, '-9,999元'],
    [-10_000, '-1.00万'],
    [-99_999, '-10.00万'],
    [-100_000, '-10万'],
    [-99_999_999, '-10,000万'],
    [-100_000_000, '-1.00亿'],
    [-999_999_999, '-10.00亿'],
    [-1_000_000_000, '-10.0亿']
  ] as const)('cny-adaptive 按原始绝对值为 %s 选档后得到 %s', (value, expected) => {
    expect(formatValue(value, 'cny-adaptive')).toBe(expected);
  });

  it('cny-adaptive 处理小数、零、空值与非有限值回退', () => {
    expect(formatValue(12.6, 'cny-adaptive')).toBe('13元');
    expect(formatValue(-12.6, 'cny-adaptive')).toBe('-13元');
    expect(formatValue(0, 'cny-adaptive')).toBe('0元');
    expect(formatValue(-0, 'cny-adaptive')).toBe('0元');
    expect(formatValue(null, 'cny-adaptive')).toBe('—');
    expect(formatValue(Number.NaN, 'cny-adaptive')).toBe('NaN');
    expect(formatValue(Number.POSITIVE_INFINITY, 'cny-adaptive')).toBe('Infinity');
  });

  it('百分比不乘 100,并接受数据快照中的数值字符串', () => {
    expect(formatValue(4.24, 'percent-2')).toBe('4.24%');
    expect(formatValue(4.24, 'percent-2-signed')).toBe('+4.24%');
    expect(formatValue('-2.52', 'percent-2-signed')).toBe('-2.52%');
  });

  it('空值统一显示占位符', () => {
    expect(formatValue(null, 'number')).toBe('—');
  });

  it('支持日期完整值与 Tokens 趋势所需 MM-DD', () => {
    expect(formatValue('2026-06-23T08:30:00+08:00', 'date')).toBe('2026-06-23');
    expect(formatValue('2026-06-23T08:30:00+08:00', 'date-month-day')).toBe('06-23');
  });
});

describe('valuePolarity', () => {
  it('按数值及数值字符串返回语义状态', () => {
    expect(valuePolarity(4.24)).toBe('positive');
    expect(valuePolarity('-2.52')).toBe('negative');
    expect(valuePolarity(0)).toBe('neutral');
    expect(valuePolarity(null)).toBe('neutral');
    expect(valuePolarity('暂无')).toBe('neutral');
  });
});
