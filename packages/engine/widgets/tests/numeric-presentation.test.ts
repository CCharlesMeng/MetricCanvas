import { describe, expect, it } from 'vitest';
import { formatValue } from '../src/shared/value-format';
import { resolveField } from '../src/shared/component-data';
import { formatFieldValue, formatChangeValue } from '../src/shared/field-presentation';

describe('semantic numeric presentation', () => {
  it.each([
    [9999.5, false, '10,000元'], [10000, false, '1万'], [12345, false, '1.23万'],
    [12345, true, '1.2万'], [99999, false, '10万'], [100000, false, '10万'],
    [99999999, false, '10,000万'], [100000000, false, '1亿'],
    [123456789, false, '1.23亿'], [1000000000, false, '10亿'],
    [1234567890, true, '12.3亿'], [-12345, true, '-1.2万'], [0, false, '0元']
  ] as const)('CNY %s mobile=%s → %s', (value, mobile, expected) => {
    expect(formatValue(value, 'cny-adaptive', undefined, { mobile })).toBe(expected);
  });
  it.each([
    [9999.5, '10,000美元'], [10000, '10K'], [12345, '12.3K'],
    [999999, '1,000K'], [1000000, '1,000K'], [99999999, '100,000K'],
    [100000000, '100M'], [-123456789, '-123M']
  ] as const)('USD %s → %s', (value, expected) => {
    expect(formatValue(value, 'usd-adaptive')).toBe(expected);
  });
  it.each([
    [0.001, '0.001%'], [0.009, '0.009%'], [0.099, '0.1%'], [0.1, '0.1%'],
    [0.999, '1%'], [1, '1%'], [9.995, '10%'], [10, '10%'], [12.34, '12.3%'],
    [99.99, '100%'], [100, '100%'], [499.9, '500%'], [500, '上升>500%'],
    [-500, '下降>500%'], [-0.001, '-0.001%'], [0, '0%'], [-0, '0%']
  ] as const)('ratio %s → %s', (value, expected) => {
    expect(formatValue(value, 'percent-adaptive')).toBe(expected);
  });
  it.each([
    [9999, 'count-adaptive', '人', '9,999人'], [12345, 'count-adaptive', '户', '1.2万户'],
    [123456, 'count-adaptive', '人', '12万人'], [12345, 'resource-adaptive', '核', '1.23万核'],
    [100000000, 'resource-adaptive', 'TB', '1亿TB'],
    [999, 'minutes-adaptive', '', '999分钟'], [1000, 'minutes-adaptive', '', '1千分钟'],
    [1234, 'minutes-adaptive', '', '1.23千分钟'], [10000, 'minutes-adaptive', '', '1万分钟'],
    [9999, 'messages-adaptive', '', '9,999条'], [12345, 'messages-adaptive', '', '1.23万条'],
    [3600, 'billing-hours', '', '1小时'], [3666, 'billing-hours', '', '1.02小时']
  ] as const)('quantity %s / %s → %s', (value, format, unit, expected) => {
    expect(formatValue(value, format, undefined, { unit })).toBe(expected);
  });
  it.each([
    [1023, 'Bytes', '1,023 Bytes'], [1024, 'Bytes', '1 KB'], [1024, 'KB', '1 MB'],
    [1.5, 'GB', '1.5 GB'], [1024, 'GB', '1 TB'], [1024, 'TB', '1 PB'],
    [1024, 'PB', '1 EB'], [1024, 'EB', '1 ZB'], [1024, 'ZB', '1 YB'],
    [1024, 'YB', '1,024 YB'], [0, 'TB', '0 Bytes'], [1024, 'Mbps', '1 Gb/s']
  ] as const)('storage/rate %s %s → %s', (value, unit, expected) => {
    expect(formatValue(value, 'bytes-adaptive', undefined, { unit })).toBe(expected);
  });
  it('uses metadata, preserves explicit exceptions, and never guesses from a label', () => {
    const data = { main: { fields: {
      money: { type: 'money', role: 'measure', currency: 'CNY', defaultFormat: 'compact-wan-1' },
      rate: { type: 'number', role: 'measure', unit: '%', defaultFormat: 'percent-2' },
      people: { type: 'number', role: 'measure', unit: '人' },
      slo: { type: 'number', role: 'measure', unit: '%', defaultFormat: 'percent-raw' },
      unknown: { type: 'number', role: 'measure', label: '销售金额', defaultFormat: 'number-2' }
    } } } as const;
    expect(formatFieldValue(12345, resolveField('money', data))).toBe('1.23万');
    expect(formatFieldValue(12.34, resolveField('rate', data))).toBe('12.3%');
    expect(formatFieldValue(12345, resolveField({ data: 'main', field: 'people', format: 'number-grouped' }, data))).toBe('12,345');
    expect(formatFieldValue(99.999, resolveField('slo', data))).toBe('99.999%');
    expect(formatFieldValue(99.999, resolveField({ data: 'main', field: 'slo', format: 'number' }, data))).toBe('99.999');
    expect(resolveField('unknown', data).format).toBe('number-2');
    expect(formatChangeValue(12.3, resolveField('rate', data))).toBe('+12.3%');
    expect(formatChangeValue(null, resolveField('rate', data))).toBe('--');
  });
});


it.each([99.999, 99.99999, 0.001, 0, -0.001])('personalized percent-raw preserves %s exactly', value => {
  expect(formatValue(value, 'percent-raw')).toBe(`${value}%`);
});

it('keeps personalized money defaults', () => {
  const data = { main: { fields: { amount: {
    type: 'money', role: 'measure', currency: 'CNY', defaultFormat: 'cny-adaptive-trimmed'
  } } } } as const;
  const field = resolveField('amount', data);
  expect(formatFieldValue(12345, field)).toBe('1.2万');
});
