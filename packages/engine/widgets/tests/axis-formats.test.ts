import { describe, expect, it } from 'vitest';
import { dualOrSingleAxis } from '../src/shared/chart-option';
import { lineOption } from '../src/components/line-chart/options';
import { barOption } from '../src/components/bar-chart/options';
import type { MainDataSlots } from '../src/shared/component-data';

const data: MainDataSlots = {
  main: {
    snapshot: { status: 'ready', rows: [{ month: '2026-01', tokens: 11358989639011.566 }] },
    fields: {
      month: { type: 'string', role: 'dimension' },
      tokens: { type: 'number', role: 'measure', defaultFormat: 'compact-yi-1' }
    }
  }
};

describe('numeric axis display formats', () => {
  it('line and horizontal bar axes use the field format without scaling series data', () => {
    const series = [{ field: 'tokens' }];
    const line = lineOption(data, { xField: 'month', series });
    const bar = barOption(data, { categoryField: 'month', horizontal: true, series });
    for (const axis of [line.yAxis, bar.xAxis]) {
      expect(axis).toMatchObject({ axisLabel: { formatter: expect.any(Function) } });
      const formatter = (axis as { axisLabel: { formatter: (value: number) => string } }).axisLabel.formatter;
      expect(formatter(11358989639011.566)).toBe('113,589.9亿');
    }
    expect(line.series).toMatchObject([{ data: [11358989639011.566] }]);
    expect(bar.series).toMatchObject([{ data: [11358989639011.566] }]);
  });

  it('mixed formats on a shared axis keep raw ticks; separate axes retain their own units', () => {
    expect(dualOrSingleAxis(false, 2, false, ['compact-yi-1', 'percent-2'])).toEqual({ type: 'value' });
    const axes = dualOrSingleAxis(true, 2, false, ['compact-yi-1', 'percent-2']);
    expect(axes).toMatchObject([{ axisLabel: { formatter: expect.any(Function) } }, { axisLabel: { formatter: expect.any(Function) } }]);
    expect(dualOrSingleAxis(false, 1, true, ['compact-yi-1'])).toMatchObject({ axisLabel: { show: false } });
  });
});

it('windows large category sets without discarding series or category rows', () => {
  const rows = Array.from({ length: 714 }, (_, i) => ({ month: `category-${i}`, tokens: i + 1 }));
  const full = { main: { ...data.main, snapshot: { status: 'ready' as const, rows } } };
  for (const horizontal of [false, true]) {
    const option = barOption(full, { categoryField: 'month', series: [{ field: 'tokens' }], horizontal });
    expect(option.dataZoom).toMatchObject([{ type: 'slider', [horizontal ? 'yAxisIndex' : 'xAxisIndex']: 0, filterMode: 'none', endValue: 19 }, { type: 'inside' }]);
    expect(option.series).toMatchObject([{ data: rows.map(r => r.tokens) }]);
    expect(horizontal ? option.yAxis : option.xAxis).toMatchObject({ data: rows.map(r => r.month) });
  }
  const line = lineOption(full, { xField: 'month', series: [{ field: 'tokens' }] });
  expect(line.dataZoom).toMatchObject([{ xAxisIndex: 0, filterMode: 'none' }, { type: 'inside' }]);
  expect(line.series).toMatchObject([{ data: rows.map(r => r.tokens) }]);
});

it('uses the same fixed unit for numeric axes, bar labels, and tooltips', () => {
  const fixed: MainDataSlots = { main: {
    fields: { month: { type: 'string', role: 'dimension' }, tokens: { type: 'number', role: 'measure', unit: '元', defaultFormat: 'compact-wan-1' } },
    snapshot: { status: 'ready', rows: [{ month: 'a', tokens: 5000 }, { month: 'b', tokens: 125000000 }] }
  } };
  for (const horizontal of [true, false]) {
    for (const variant of [undefined, 'reportForecast'] as const) {
      const option = barOption(fixed, { categoryField: 'month', series: [{ field: 'tokens' }], horizontal, variant, showSegmentLabels: true });
      const axis = (horizontal ? option.xAxis : option.yAxis) as { axisLabel: { formatter: (v: number) => string } };
      const series = (option.series as Array<{ label: { formatter: (p: {value:number}) => string }; tooltip: { valueFormatter: (v: number) => string } }>)[0];
      for (const [value, expected] of [[5000, '0.5万'], [125000000, '12,500.0万']] as const) {
        expect(axis.axisLabel.formatter(value)).toBe(expected);
        expect(series.label.formatter({ value })).toBe(expected);
        expect(series.tooltip.valueFormatter(value)).toBe(expected);
      }
    }
  }
});
