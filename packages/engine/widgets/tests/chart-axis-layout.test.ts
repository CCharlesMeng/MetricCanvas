import { expect, it } from 'vitest';
import { init } from 'echarts';
import { lineOption } from '../src/components/line-chart/options';
import type { MainDataSlots } from '../src/shared/component-data';

const data: MainDataSlots = { main: {
  fields: { category: { type: 'string', role: 'dimension' },
    duration: { type: 'number', role: 'measure', unit: '天' },
    count: { type: 'number', role: 'measure', unit: '人' } },
  snapshot: { status: 'ready', rows: [{ category: 'A', duration: 10, count: 20 }] }
} };

it.each([640, 390])('aligns both axis units with their tick text at width %i', width => {
  const chart = init(null, undefined, { renderer: 'svg', ssr: true, width, height: 320 });
  try {
    chart.setOption({ ...lineOption(data, { xField: 'category', dualAxis: true,
      series: [{ field: 'duration' }, { field: 'count' }] }), animation: false });
    const texts = chart.getZr().storage.getDisplayList().filter(item => item.type === 'tspan');
    const bounds = (text: string, occurrence = 0) => {
      const item = texts.filter(item => (item as unknown as { style: { text: string } }).style.text === text)[occurrence]!;
      expect(item, `rendered text ${text}`).toBeDefined();
      const rect = item.getBoundingRect().clone();
      rect.applyTransform(item.transform!);
      return rect;
    };
    const left = bounds('天');
    const leftTick = bounds('10');
    expect(left.x + left.width).toBeCloseTo(leftTick.x + leftTick.width, 5);
    const right = bounds('人');
    const rightTick = bounds('20');
    expect(right.x).toBeCloseTo(rightTick.x, 5);
    expect(leftTick.y - left.y - left.height).toBeCloseTo(16, 5);
    const numericTicks = texts.filter(item => /^-?\d/.test((item as unknown as { style: { text: string } }).style.text));
    const rightTicks = numericTicks.map(item => {
      const rect = item.getBoundingRect().clone();
      rect.applyTransform(item.transform!);
      return rect;
    }).filter(rect => Math.abs(rect.x - right.x) < 1e-5);
    expect(Math.min(...rightTicks.map(rect => rect.y)) - right.y - right.height).toBeCloseTo(16, 5);
  } finally {
    chart.dispose();
  }
});

it('renders percentage ticks with suffixes and no separate percent heading', () => {
  const option = lineOption(data, { xField: 'category', series: [{ field: {
    data: 'main', field: 'duration', format: 'percent-1'
  }, unit: '%' }] });
  const axis = option.yAxis as { name?: string; axisLabel: { formatter(value: number): string } };
  expect(axis.name).toBeUndefined();
  expect([0, 10, 20, -10].map(axis.axisLabel.formatter)).toEqual(['0%', '10%', '20%', '-10%']);
});

it('keeps longer aligned units inside a narrow chart', () => {
  const chart = init(null, undefined, { renderer: 'svg', ssr: true, width: 300, height: 240 });
  try {
    chart.setOption({ ...lineOption(data, { xField: 'category', dualAxis: true,
      series: [{ field: 'duration', unit: '万元' }, { field: 'count', unit: '百万美元' }] }), animation: false });
    const units = chart.getZr().storage.getDisplayList().filter(item =>
      ['万元', '百万美元'].includes((item as unknown as { style?: { text: string } }).style?.text ?? ''));
    expect(units).toHaveLength(2);
    for (const item of units) {
      const rect = item.getBoundingRect().clone();
      rect.applyTransform(item.transform!);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(300);
    }
  } finally {
    chart.dispose();
  }
});
