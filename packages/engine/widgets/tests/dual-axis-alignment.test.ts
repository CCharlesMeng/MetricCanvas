import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { init, type ECharts, type EChartsOption } from 'echarts';
import type { BarChartProps, LineChartProps } from '@metriccanvas/page/internal';
import type { MainDataSlots } from '../src/shared/component-data';
import { barOption } from '../src/components/bar-chart/options';
import { lineOption } from '../src/components/line-chart/options';
import { mergeChartOption } from '../src/shared/chart-option-extension';

interface Scene { type: 'barChart' | 'lineChart'; id: string; props: BarChartProps | LineChartProps }
interface Fixture { dataSources: { sample: { fields: MainDataSlots['main']['fields']; source: { rows: MainDataSlots['main']['snapshot']['rows'] } } }; sections: Array<{ components: Scene[] }> }

const page: Fixture = JSON.parse(readFileSync(new URL('../../../../pages/capabilities/chart/dual-axis-alignment.json', import.meta.url), 'utf8'));
const source = page.dataSources.sample;
const data: MainDataSlots = { main: { fields: source.fields, snapshot: { status: 'ready', rows: source.source.rows } } };

interface NumericAxis {
  scale: { getTicks(): Array<{ value: number }> };
  dataToCoord(value: number): number;
  model: { get(path: string): unknown };
}

// Tick coordinates are an internal ECharts diagnostic, rather than an option assertion.
function numericAxes(chart: ECharts, dimension: string): NumericAxis[] {
  const inspected = chart as unknown as { getModel(): { getComponent(type: string, index: number): { axis: NumericAxis } } };
  return [0, 1].map(index => inspected.getModel().getComponent(dimension, index).axis);
}

function expectAligned(chart: ECharts, dimension = 'yAxis') {
  const [primary, secondary] = numericAxes(chart, dimension);
  const positions = (axis: NumericAxis) => axis.scale.getTicks().map(tick => axis.dataToCoord(tick.value));
  const left = positions(primary!);
  const right = positions(secondary!);
  expect(right).toHaveLength(left.length);
  right.forEach((value, index) => expect(value).toBeCloseTo(left[index]!, 6));
  expect(primary!.model.get('splitLine.show')).toBe(true);
  expect(secondary!.model.get('splitLine.show')).toBe(false);
}

function render(option: EChartsOption, verify: (chart: ECharts) => void) {
  const chart = init(null, undefined, { renderer: 'svg', ssr: true, width: 640, height: 320 });
  try {
    chart.setOption({ ...option, animation: false });
    verify(chart);
  } finally {
    chart.dispose();
  }
}

function sceneOption(component: (typeof page.sections)[number]['components'][number]): EChartsOption {
  const option = component.type === 'lineChart'
    ? lineOption(data, component.props as LineChartProps)
    : barOption(data, component.props as BarChartProps);
  return component.props.echartsOption ? mergeChartOption(option, component.props.echartsOption) : option;
}

describe('dual-axis tick alignment in the real ECharts scale', () => {
  it.each(page.sections[0]!.components.slice(0, 3))('$id uses aligned ticks and one grid', component => {
    render(sceneOption(component), chart => expectAligned(chart));
  });

  it.each([
    [{ month: 'A', actual: -160, previous: -87 }, { month: 'B', actual: 120, previous: 38 }],
    [{ month: 'A', actual: 0, previous: 0 }],
    []
  ])('handles signed, zero and empty data (%#)', (...rows) => {
    const changed: MainDataSlots = { main: { ...data.main, snapshot: { status: 'ready', rows } } };
    render(lineOption(changed, { xField: 'month', dualAxis: true, series: [{ field: 'actual' }, { field: 'previous' }] }), chart => expectAligned(chart));
  });

  it('retains axis formats and recomputes alignment after updates and resize', () => {
    const props: LineChartProps = { xField: 'month', dualAxis: true, series: [{ field: 'actual' }, { field: 'previous' }] };
    const option = lineOption(data, props);
    render(option, chart => {
      expectAligned(chart);
      chart.resize({ width: 360, height: 240 });
      expectAligned(chart);
      const changed: MainDataSlots = { main: { ...data.main, snapshot: { status: 'ready', rows: [{ month: 'A', actual: 730, previous: 23 }] } } };
      chart.setOption(lineOption(changed, props));
      expectAligned(chart);
    });
    expect(option.yAxis).toMatchObject([{}, { axisLabel: { formatter: expect.any(Function) } }]);
  });

  it('keeps single-axis defaults and explicit presentation overrides', () => {
    expect(sceneOption(page.sections[0]!.components[3]!).yAxis).toMatchObject({ type: 'value' });
    expect(sceneOption(page.sections[0]!.components[3]!).yAxis).not.toHaveProperty('alignTicks');
    const overridden = mergeChartOption(sceneOption(page.sections[0]!.components[2]!), { yAxis: [{}, { alignTicks: false, splitLine: { show: true } }] });
    expect(overridden.yAxis).toMatchObject([{}, { alignTicks: false, splitLine: { show: true } }]);
  });

  it('respects an explicitly fixed secondary range and interval', () => {
    const bounded = mergeChartOption(sceneOption(page.sections[0]!.components[2]!), { yAxis: [{}, { min: 0, max: 100, interval: 20 }] });
    render(bounded, chart => {
      const secondary = numericAxes(chart, 'yAxis')[1]!;
      expect(secondary.scale.getTicks().map(tick => tick.value)).toEqual([0, 20, 40, 60, 80, 100]);
      expect(secondary.model.get('splitLine.show')).toBe(false);
    });
  });

  it('preserves hidden-axis behavior', () => {
    const option = lineOption(data, { xField: 'month', dualAxis: true, hideYAxis: true, series: [{ field: 'actual' }, { field: 'previous' }] });
    expect(option.yAxis).toMatchObject([
      { axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false } },
      { axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false }, splitLine: { show: false } }
    ]);
  });
});
