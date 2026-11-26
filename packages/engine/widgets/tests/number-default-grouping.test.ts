import { expect, it } from 'vitest';
import { formatValue, valuePolarity } from '../src/shared/value-format';
import { numericAxisPresentation } from '../src/shared/chart-axis-presentation';

it.each([
  [undefined, '12,345.6789012345'], ['number', '12,345.6789012345'],
  ['number-0', '12,346'], ['number-2', '12,345.68'], ['number-5', '12,345.6789'],
  ['number-grouped', '12,345.679'], ['number-2-signed', '+12,345.68'],
  ['number-ungrouped', '12345.6789012345'], ['number-0-ungrouped', '12346'],
  ['number-2-ungrouped', '12345.68'], ['number-5-ungrouped', '12345.6789'],
  ['number-ungrouped-signed', '+12345.6789012345'], ['number-2-ungrouped-signed', '+12345.68']
] as const)('%s keeps its precision and sign independently of grouping', (format, text) => {
  expect(formatValue(12345.6789012345, format)).toBe(text);
  expect(formatValue(-12345.6789012345, format)).toBe(`-${text.replace(/^\+/, '')}`);
  expect(formatValue(null, format)).toBe('—');
  expect(formatValue(0, format)).toBe('0');
});

it('keeps text, percent, points, scientific notation and displayed polarity intact', () => {
  expect(formatValue('001234')).toBe('001234');
  expect(formatValue(1234, 'text')).toBe('1234');
  expect(formatValue(1e-25, 'number')).toBe('1e-25');
  expect(formatValue(1e25, 'number')).toBe('1e+25');
  expect(formatValue(234.567, 'percent-2')).toBe('234.57%');
  expect(formatValue(123.4567, 'points-1-signed')).toBe('+123.5P');
  expect(formatValue(1.234567, 'yoy-p-signed')).toBe('+123P');
  expect(valuePolarity(-0.004, 'number-2-ungrouped-signed')).toBe('neutral');
  expect(formatValue(-0.004, 'number-2-ungrouped-signed')).toBe('0');
  expect(valuePolarity(1234, 'number-ungrouped-signed')).toBe('positive');
});

it.each([
  ['number-2', '12,345.68'], ['number-2-ungrouped', '12345.68'],
  ['number-2-ungrouped-signed', '+12345.68'], ['percent-2', '12345.68%'],
  ['points-1-signed', '+12345.7'], ['yoy-p-signed', '+1234568']
] as const)('numeric axes respect %s without leaking grouping into percent or points', (format, text) => {
  const axis = numericAxisPresentation([{ format }]);
  expect(axis.axisLabel.formatter(12345.6789)).toBe(text);
});
