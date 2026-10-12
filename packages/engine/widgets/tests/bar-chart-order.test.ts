import { expect, it } from 'vitest';
import * as echarts from 'echarts';
import { barOption } from '../src/components/bar-chart/options';
import type { MainDataSlots } from '../src/shared/component-data';

const data: MainDataSlots = { main: { fields: { category: { type: 'string', role: 'dimension' }, value: { type: 'number', role: 'measure' } }, snapshot: { status: 'ready', rows: [{ category: 'first', value: 300 }, { category: 'second', value: 200 }, { category: 'third', value: 100 }] } } };
it.each([false, true])('preserves source reading order with horizontal=%s', horizontal => {
  const option = barOption(data, { categoryField: 'category', series: [{ field: 'value' }], horizontal });
  const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 600, height: 400 });
  try {
    chart.setOption(option);
    const first = chart.convertToPixel({ seriesIndex: 0 }, horizontal ? [300, 0] : [0, 300]) as number[];
    const second = chart.convertToPixel({ seriesIndex: 0 }, horizontal ? [200, 1] : [1, 200]) as number[];
    expect(first[horizontal ? 1 : 0]).toBeLessThan(second[horizontal ? 1 : 0]!);
    expect(chart.getOption().series).toMatchObject([{ data: [300, 200, 100] }]);
    expect(horizontal ? chart.getOption().yAxis : chart.getOption().xAxis).toMatchObject([{ data: ['first', 'second', 'third'] }]);
  } finally { chart.dispose(); }
});
