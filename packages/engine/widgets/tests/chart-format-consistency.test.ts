import { describe, expect, it } from 'vitest';
import { barOption } from '../src/components/bar-chart/options';
import { lineOption } from '../src/components/line-chart/options';
import type { MainDataSlots } from '../src/shared/component-data';
import type { ValueFormatPreset } from '@metriccanvas/page/internal';

interface DisplayOption {
  yAxis: { name?: string; axisLabel: { formatter: (value: number) => string } };
  series: Array<{
    name: string;
    tooltip: { valueFormatter: (value: unknown) => string };
    label: { formatter: (value: unknown) => string };
    markPoint?: { label: { formatter: (value: unknown) => string } };
  }>;
}

const data: MainDataSlots = { main: {
  fields: { category: { type: 'string', role: 'dimension' }, value: { type: 'number', role: 'measure' } },
  snapshot: { status: 'ready', rows: [{ category: '甲', value: 12345.6789 }, { category: '乙', value: 0 }] }
} };

function options(input: MainDataSlots, format?: ValueFormatPreset) {
  const series = [{ field: { data: 'main', field: 'value', format, missingText: '暂无' }, label: '2026销量' }];
  return [
    barOption(input, { categoryField: 'category', series, showValueLabels: true }),
    lineOption(input, { xField: 'category', series, showValueLabels: true }),
    lineOption(input, { xField: 'category', series, showPointLabels: true }),
    barOption(input, { categoryField: 'category', series, showSegmentLabels: true, showStackTotalLabels: true }),
    barOption(input, { categoryField: 'category', series, variant: 'reportForecast', showSegmentLabels: true }),
    barOption(input, { categoryField: 'category', series: [{ ...series[0]!, kind: 'line', axis: 'primary' }], showValueLabels: true })
  ] as unknown as DisplayOption[];
}

describe('chart numeric display consistency', () => {
  it('defaults numeric surfaces to two decimals without an implicit unit or grouping', () => {
    const original = structuredClone(data);
    for (const option of options(data)) {
      expect(option.yAxis.name).toBeUndefined();
      for (const [value, expected] of [[12345.6789, '12345.68'], [0, '0.00'], [-12345.6789, '-12345.68']] as const) {
        const series = option.series[0]!;
        expect(series.tooltip?.valueFormatter?.(value)).toBe(expected);
        expect(series.label.formatter({ value })).toBe(expected);
        expect(option.yAxis.axisLabel?.formatter?.(value)).toBe(expected);
        if (series.markPoint) expect(series.markPoint.label.formatter({ value })).toBe(expected);
      }
      expect(option.series[0]!.name).toBe('2026销量');
    }
    expect(data).toEqual(original);
  });

  it('inherits field format and lets the binding override it across all numeric surfaces', () => {
    const formatted = structuredClone(data);
    formatted.main.fields.value = { type: 'number', role: 'measure', defaultFormat: 'compact-wan-1' };
    for (const [format, expected] of [[undefined, '1.2万'], ['number-1', '12345.7'], ['number', '12345.6789']] as const) {
      for (const option of options(formatted, format)) {
        expect(option.yAxis.axisLabel.formatter(12345.6789)).toBe(expected);
        expect(option.series[0]!.tooltip.valueFormatter(12345.6789)).toBe(expected);
        expect(option.series[0]!.label.formatter({ value: 12345.6789 })).toBe(expected);
      }
    }
  });

  it('keeps missing tooltip text and skips missing point labels', () => {
    for (const option of options(data)) {
      for (const missing of [null, undefined, NaN, Infinity]) {
        expect(option.series[0]!.tooltip?.valueFormatter?.(missing)).toBe('暂无');
      }
    }
    for (const option of options(data).slice(0, 2)) {
      expect(option.series[0]!.label.formatter({ value: null })).toBe('');
    }
  });
});


it('gives constants the chart default while preserving an explicit constant format', () => {
  for (const [format, expected] of [[undefined, '12345.68'], ['number-1', '12345.7']] as const) {
    const series = [{ value: 12345.6789, format }];
    const charts = [
      barOption(data, { categoryField: 'category', series, showValueLabels: true }),
      lineOption(data, { xField: 'category', series, showValueLabels: true })
    ] as unknown as DisplayOption[];
    for (const option of charts) {
      expect(option.series[0]!.tooltip.valueFormatter(12345.6789)).toBe(expected);
      expect(option.series[0]!.label.formatter({ value: 12345.6789 })).toBe(expected);
      expect(option.yAxis.axisLabel.formatter(12345.6789)).toBe(expected);
    }
  }
});


it('formats horizontal numeric axes and labels while retaining raw data and category text', () => {
  const option = barOption(data, { categoryField: 'category', series: [{ field: 'value' }], horizontal: true, showValueLabels: true });
  const view = option as unknown as DisplayOption & { xAxis: DisplayOption['yAxis']; yAxis: { data: string[] } };
  expect(view.xAxis.axisLabel.formatter(12345.6789)).toBe('12345.68');
  expect(view.series[0]!.label.formatter({ value: 0 })).toBe('0.00');
  expect(view.yAxis.data).toEqual(['甲', '乙']);
  expect(option.series).toMatchObject([{ data: [{ value: 12345.6789 }, { value: 0 }] }]);
});
