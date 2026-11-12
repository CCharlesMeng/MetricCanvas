import { expect, it } from 'vitest';
import type { ValueFormatPreset } from '@metriccanvas/page/internal';
import { barOption } from '../src/components/bar-chart/options';
import { lineOption } from '../src/components/line-chart/options';
import type { MainDataSlots } from '../src/shared/component-data';
import { dualOrSingleAxis } from '../src/shared/chart-option';

type Axis = { name?: string; nameLocation?: string; nameRotate?: number; axisLabel: { formatter: (value: number) => string } };

function charts(format: ValueFormatPreset, unit: string | undefined, max: number, displayUnit?: string) {
  const data: MainDataSlots = { main: {
    fields: { category: { type: 'string', role: 'dimension' }, value: { type: 'number', role: 'measure', unit } },
    snapshot: { status: 'ready', rows: [{ category: '甲', value: max }, { category: '乙', value: 0 }, { category: '丙', value: -max }] }
  } };
  const series = [{ field: { data: 'main', field: 'value', format }, unit: displayUnit }];
  const options = [
    barOption(data, { categoryField: 'category', series }),
    lineOption(data, { xField: 'category', series }),
    barOption(data, { categoryField: 'category', series: [{ ...series[0]!, kind: 'bar', axis: 'primary' }] }),
    barOption(data, { categoryField: 'category', horizontal: true, series })
  ];
  return options.map((option, index) => ({ option, axis: (index === 3 ? option.xAxis : option.yAxis) as Axis }));
}

it.each([
  ['number-1', '天', 12.5, '天', '12.5', undefined],
  ['number-1', '天', 12.5, '日', '12.5', '日'],
  ['number-1', '天', 12.5, undefined, '12.5', ''],
  ['percent-1', '%', 25, '%', '25', undefined],
  ['percent-adaptive', undefined, 600, '%', '600', undefined],
  ['compact-wan-1', '元', 125000, '万元', '12.5', undefined],
  ['compact-wan-1', '元', 125000, '万元', '12.5', '万元'],
  ['compact-million-2', undefined, 1250000, '百万', '1.25', undefined],
  ['cny-adaptive', undefined, 125000, '万元', '12.5', undefined],
  ['usd-adaptive', undefined, 125000, 'K美元', '125', undefined],
  ['count-adaptive', '人', 125000, '万人', '12.5', undefined],
  ['count-adaptive', '人', 125000, '万人次', '12.5', '人次'],
  ['count-adaptive', undefined, 125000, '万人次', '12.5', '人次'],
  ['resource-adaptive', '核', 125000000, '亿核', '1.25', undefined],
  ['minutes-adaptive', '分钟', 1250, '千分钟', '1.25', undefined],
  ['messages-adaptive', '条', 125000, '万条', '12.5', undefined],
  ['bytes-adaptive', 'MB/s', 2048, 'GB/s', '2', undefined],
  ['billing-hours', '秒', 7200, '小时', '2', undefined],
  ['cny-adaptive-trimmed', undefined, 125000, '万元', '13', undefined],
  ['usd-adaptive-km', undefined, 125000, 'K美元', '125', undefined],
  ['points-1-signed', undefined, 12.5, 'P', '+12.5', undefined],
  ['yoy-p-signed', undefined, 0.29, 'P', '+29', undefined]
] as const)('unifies %s axes while preserving raw data', (format, unit, max, name, expected, displayUnit) => {
  for (const { option, axis } of charts(format, unit, max, displayUnit)) {
    expect(axis).toMatchObject({ nameLocation: 'end', nameRotate: 0 });
    expect(axis.name).toBe(name);
    expect(axis.axisLabel.formatter(max)).toBe(expected);
    expect(axis.axisLabel.formatter(0)).toBe('0');
    expect(axis.axisLabel.formatter(-max)).toBe(`-${expected.replace(/^\+/, '')}`);
    expect(option.series).toMatchObject([{ data: [max, 0, -max] }]);
  }
});

it('keeps one adaptive scale for the entire axis and leaves tooltip formatting independent', () => {
  const { option, axis } = charts('count-adaptive', '人', 125000)[0]!;
  expect(axis.name).toBe('万人');
  expect(axis.axisLabel.formatter(5000)).toBe('0.5');
  const series = option.series as Array<{ tooltip: { valueFormatter: (value: number) => string } }>;
  expect(series[0]!.tooltip.valueFormatter(5000)).toBe('5,000人');
});

it('keeps a shared unit across different precision but never guesses conflicting units', () => {
  const axis = dualOrSingleAxis(false, 2, false, [
    { format: 'number-1', unit: '天' }, { format: 'number-2', unit: '天' }
  ]) as Axis;
  expect(axis.name).toBe('天');
  expect(axis.axisLabel.formatter(12.345)).toBe('12.35');
  const conflict = dualOrSingleAxis(false, 2, false, [
    { format: 'count-adaptive', unit: '人', magnitude: 125000 },
    { format: 'count-adaptive', unit: '个', magnitude: 125000 }
  ]) as Axis;
  expect(conflict.name).toBeUndefined();
  expect(conflict.axisLabel.formatter(125000)).toBe('125000');
  expect(dualOrSingleAxis(false, 1, true, [{ format: 'percent-1', unit: '%' }])).toMatchObject({ name: '', axisLabel: { show: false } });
});
