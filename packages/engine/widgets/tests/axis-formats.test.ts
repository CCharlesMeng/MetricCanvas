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
