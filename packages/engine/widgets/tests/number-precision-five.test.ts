import { expect, it } from 'vitest';
import { formatValue, valuePolarity } from '../src/shared/value-format';
import { changeValueColor, tableValueColor } from '../src/shared/value-color';

const precisions = [
  ['number-3', 'number-3-signed', '1234.123', 0.0004, 0.0005, '0.001'],
  ['number-4', 'number-4-signed', '1234.1235', 0.00004, 0.00005, '0.0001'],
  ['number-5', 'number-5-signed', '1234.12346', 0.000004, 0.000005, '0.00001']
] as const;

it.each(precisions)('%s and %s round without grouping or padding', (plain, signed, rounded) => {
  expect(formatValue(1234.12345678, plain)).toBe(rounded);
  expect(formatValue(-1234.12345678, plain)).toBe(`-${rounded}`);
  expect(formatValue('1234.12345678', signed)).toBe(`+${rounded}`);
  expect(formatValue('-1234.12345678', signed)).toBe(`-${rounded}`);
  expect(formatValue(12.3, plain)).toBe('12.3');
  expect(formatValue(12.3, signed)).toBe('+12.3');
  expect(formatValue(9.999999, plain)).toBe('10');
  expect(formatValue(-9.999999, signed)).toBe('-10');
  expect(formatValue(-0, signed)).toBe('0');
  expect(formatValue(0, plain)).toBe('0');
});

it.each(precisions)('%s shares the displayed zero boundary across signed consumers', (plain, signed, _rounded, zero, half, minimum) => {
  const colorRule = { mode: 'sign', positive: 'red', negative: 'green' } as const;
  for (const value of [zero, -zero, 0, -0]) {
    expect(formatValue(value, signed)).toBe('0');
    expect(valuePolarity(value, signed)).toBe('neutral');
    expect(tableValueColor(value, { field: 'delta', colorRule }, signed)).toBeUndefined();
    expect(changeValueColor(value, { label: '变化', field: 'delta', colorRule }, signed)).toBeUndefined();
    expect(tableValueColor(value, { field: 'delta', colorRule: { mode: 'fixed', color: 'green' } }, signed)).toBe('green');
  }
  for (const [value, text, polarity, color] of [
    [half, `+${minimum}`, 'positive', 'red'],
    [-half, `-${minimum}`, 'negative', 'green']
  ] as const) {
    expect(formatValue(value, signed)).toBe(text);
    expect(valuePolarity(value, signed)).toBe(polarity);
    expect(tableValueColor(value, { field: 'delta', colorRule }, signed)).toBe(color);
    expect(changeValueColor(value, { label: '变化', field: 'delta', colorRule }, signed)).toBe(color);
  }
  expect(valuePolarity(zero, plain)).toBe('positive');
});

it.each(precisions)('%s and %s keep missing values and nonnumeric text safe', (plain, signed) => {
  for (const format of [plain, signed]) {
    for (const missing of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(formatValue(missing, format)).toBe('--');
      expect(formatValue(missing, format, '未提供')).toBe('未提供');
      expect(valuePolarity(missing, format)).toBe('neutral');
    }
    expect(formatValue('未计算', format)).toBe('未计算');
  }
});
