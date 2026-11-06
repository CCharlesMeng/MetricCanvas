import { expect, it } from 'vitest';
import { formatValue, valuePolarity } from '../src/shared/value-format';
import { changeValueColor, tableValueColor } from '../src/shared/value-color';

it.each([
  [0.123456, '+12P', 'positive', 'red'],
  [-0.05678, '-6P', 'negative', 'green'],
  [0.004, '0P', 'neutral', undefined],
  [-0.004, '0P', 'neutral', undefined],
  [0.005, '+1P', 'positive', 'red'],
  [-0.005, '-1P', 'negative', 'green'],
  [0.29, '+29P', 'positive', 'red'],
  [-0.29, '-29P', 'negative', 'green'],
  [1.005, '+101P', 'positive', 'red'],
  [-1.005, '-101P', 'negative', 'green'],
  [0, '0P', 'neutral', undefined],
  [-0, '0P', 'neutral', undefined],
  ['0.123456', '+12P', 'positive', 'red'],
  ['-0.004', '0P', 'neutral', undefined],
  [null, '--', 'neutral', undefined],
  [undefined, '--', 'neutral', undefined],
  [NaN, '--', 'neutral', undefined],
  [Infinity, '--', 'neutral', undefined]
] as const)('同比先保留2位再乘100：%s → %s，符号和颜色一致', (value, text, polarity, color) => {
  const colorRule = { mode: 'sign', positive: 'red', negative: 'green' } as const;
  expect(formatValue(value, 'yoy-p-signed')).toBe(text);
  expect(valuePolarity(value, 'yoy-p-signed')).toBe(polarity);
  expect(tableValueColor(value, { field: 'yoy', colorRule }, 'yoy-p-signed')).toBe(color);
  expect(changeValueColor(value, { label: '同比', field: 'yoy', colorRule }, 'yoy-p-signed')).toBe(color);
});

it('keeps legacy colors, fixed colors and missing text consistent', () => {
  expect(tableValueColor(-0.004, { field: 'yoy', visual: 'signed' }, 'yoy-p-signed')).toBeUndefined();
  expect(changeValueColor(0.004, { label: '同比', field: 'yoy', tone: 'positive' }, 'yoy-p-signed')).toBeUndefined();
  expect(tableValueColor(0.004, { field: 'yoy', colorRule: { mode: 'fixed', color: 'green' } }, 'yoy-p-signed')).toBe('green');
  expect(formatValue(null, 'yoy-p-signed', '暂无')).toBe('暂无');
  expect(formatValue(0.123456, 'number-2-signed')).toBe('+0.12');
  expect(formatValue(0.123456, 'percent-2-signed')).toBe('+0.12%');
  expect(formatValue(0.123456, 'points-1-signed')).toBe('+0.1P');
});
