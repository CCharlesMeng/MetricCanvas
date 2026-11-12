import { expect, it } from 'vitest';
import sample from '../../../../pages/capabilities/chart/chart-series-visibility.json';
import { parsePage } from '@metriccanvas/page';
import type { BarChartComponent, BarChartProps, ConditionContext, LineChartProps } from '@metriccanvas/page/internal';
import { compilePresentation } from '../src/presentation';
import { projectChartSeries } from '../src/chart-series-state';
import { barOption, barSeriesOrder } from '../../widgets/src/components/bar-chart/options';
import { lineOption } from '../../widgets/src/components/line-chart/options';
import { cartesianChartSource } from '../../widgets/src/shared/chart-series-presentation';
import type { MainDataSlots } from '../../widgets/src/shared/component-data';

function fixture() {
  const parsed = parsePage(structuredClone(sample));
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const source = parsed.page.dataSources.trend!;
  if (source.source.type !== 'inline') throw Error('expected inline data');
  const data: MainDataSlots = { main: { fields: source.fields, snapshot: { status: 'ready', rows: source.source.rows } } };
  return { page: parsed.page, data };
}
function input(scope = 'office', value = true): Omit<ConditionContext, 'declarations'> {
  return { filters: new Map([['scope', { type: 'dimension', values: [scope] }], ['show-rate', { type: 'boolean', value }]]) };
}
function mixed(props: BarChartProps, data: MainDataSlots) {
  const source = cartesianChartSource(() => barOption(data, props), props,
    { componentId: 'mixed', componentType: 'barChart', path: '/props/echartsOption' }, barSeriesOrder(props));
  expect(source.failure).toBeUndefined();
  return (source.extended ?? source.base)!;
}
function seriesOf(option: ReturnType<typeof mixed>) {
  return (Array.isArray(option.series) ? option.series : []) as Array<import('echarts').BarSeriesOption | import('echarts').LineSeriesOption>;
}
function projectedChart(program: ReturnType<typeof compilePresentation>, context: Omit<ConditionContext, 'declarations'>) {
  return program.evaluate(context).sections[1]!.components[0] as BarChartComponent;
}

it('hides/restores one mixed series, legend and unused axis while preserving data, colors and patches', () => {
  const { page, data } = fixture();
  const before = JSON.stringify(page);
  const program = compilePresentation(page);
  const shown = mixed(projectedChart(program, input()).props, data);
  for (const context of [input('global'), input('office', false)]) {
    const chart = projectedChart(program, context);
    expect(chart.props.series.map(series => series.label)).toEqual(['销售额', '目标额']);
    const hidden = mixed(chart.props, data);
    expect(seriesOf(hidden).map(series => series.name)).toEqual(['销售额', '目标额']);
    expect(hidden.legend).toMatchObject({ data: ['销售额', '目标额'] });
    expect(hidden.yAxis).toEqual([expect.any(Object), expect.objectContaining({ show: false, name: '', splitLine: { show: false } })]);
    expect(seriesOf(hidden).map(series => series.data)).toEqual(seriesOf(shown).slice(0, 2).map(series => series.data));
    expect(seriesOf(hidden)[1]).toMatchObject({ lineStyle: { type: 'dashed' }, itemStyle: seriesOf(shown)[1]!.itemStyle });
  }
  const restored = mixed(projectedChart(program, input()).props, data);
  expect(seriesOf(restored)[2]).toMatchObject({ name: '达成率', lineStyle: { width: 4 }, yAxisIndex: 1 });
  expect(JSON.stringify(page)).toBe(before);
});

it('keeps original palette and patch indices when the middle line disappears', () => {
  const { page, data } = fixture();
  const declared = (page.sections[1]!.components[0] as BarChartComponent).props;
  declared.series[1]!.visibleWhen = { permission: 'plan' };
  const program = compilePresentation(page);
  const visible = mixed(projectedChart(program, { ...input(), displaySnapshot: {
    permissionRevision: '1', values: {}, permissions: { plan: { status: 'ready', value: true } }
  } }).props, data);
  const hidden = mixed(projectedChart(program, input()).props, data);
  expect(seriesOf(hidden).map(series => series.name)).toEqual(['销售额', '达成率']);
  expect(seriesOf(hidden)[1]).toMatchObject({ lineStyle: { width: 4 }, itemStyle: seriesOf(visible)[2]!.itemStyle });
});

it('retains an empty chart title and removes all series without changing its source', () => {
  const { page, data } = fixture();
  const rendered = compilePresentation(page).evaluate(input('global')).sections[1]!.components[1]!;
  if (rendered.type !== 'lineChart') throw Error('expected line chart');
  expect(rendered.props.title).toBe('单系列对照：隐藏后保留标题');
  expect(rendered.props.series).toEqual([]);
  const result = cartesianChartSource(() => lineOption(data, rendered.props), rendered.props,
    { componentId: rendered.id, componentType: 'lineChart', path: '/props/echartsOption' }, []);
  expect(result.failure).toBeUndefined();
  expect(result.extended).toMatchObject({ series: [], legend: { show: false }, yAxis: { show: false } });
  expect(data.main.snapshot.rows).toHaveLength(3);
});

it.each(['pending', 'error'] as const)('fails closed on %s permission facts', status => {
  const { page } = fixture();
  const declared = (page.sections[1]!.components[0] as BarChartComponent).props;
  declared.series[2]!.visibleWhen = { permission: 'rate' };
  const chart = projectedChart(compilePresentation(page), { ...input(), displaySnapshot: {
    permissionRevision: '1', permissions: { rate: { status } }, values: {}
  } });
  expect(chart.props.series).toHaveLength(2);
});

it('preserves implicit secondary ownership and formatting when the first line is hidden', () => {
  const { data } = fixture();
  const original: LineChartProps = { xField: 'month', dualAxis: true, series: [
    { field: 'sales', visibleWhen: { permission: 'sales' } }, { field: 'rate' }, { value: 50, format: 'percent-0' }
  ] };
  const props = projectChartSeries(original, series => !series.visibleWhen);
  const result = cartesianChartSource(() => lineOption(data, props), props,
    { componentId: 'lines', componentType: 'lineChart', path: '/props/echartsOption' }, [0, 1]);
  expect(seriesOf(result.base!).map(series => 'yAxisIndex' in series ? series.yAxisIndex : 0)).toEqual([1, 1]);
  const axes = result.base!.yAxis;
  expect(axes).toEqual([expect.objectContaining({ show: false }), expect.objectContaining({ alignTicks: false, splitLine: { show: true } })]);
  if (!Array.isArray(axes)) throw Error('expected dual axes');
  const formatter = axes[1]!.axisLabel!.formatter;
  expect(formatter).toBeTypeOf('function');
  expect(axes[1]!.name).toBe('%');
  expect((formatter as (value: number) => string)(25)).toBe('25');
});

it('repeated presentation projection preserves declaration indices and advanced patches', () => {
  const { page, data } = fixture();
  const declaration = (page.sections[1]!.components[0] as BarChartComponent).props;
  declaration.series[1]!.visibleWhen = { permission: 'plan' };
  const once = projectChartSeries(declaration, series => series !== declaration.series[1]);
  const twice = projectChartSeries(once, series => series !== declaration.series[1]);
  expect(JSON.stringify(seriesOf(mixed(twice, data)))).toBe(JSON.stringify(seriesOf(mixed(once, data))));
});

it('recalculates visible stacked totals and keeps declaration patches after stack reordering', () => {
  const { data } = fixture();
  const declaration: BarChartProps = { categoryField: 'month', stacked: true, showStackTotalLabels: true,
    series: [{ value: 10, label: 'A', stackOrder: 2 }, { value: 20, label: 'B', stackOrder: 0, visibleWhen: { permission: 'b' } }, { value: 30, label: 'C', stackOrder: 1 }],
    echartsOption: { series: [{ itemStyle: { color: '#111111' } }, {}, { itemStyle: { color: '#333333' } }] }
  };
  const props = projectChartSeries(declaration, series => !series.visibleWhen);
  const result = mixed(props, data);
  expect(seriesOf(result).map(series => series.name)).toEqual(['C', 'A']);
  expect(seriesOf(result).map(series => series.itemStyle?.color)).toEqual(['#333333', '#111111']);
  expect(seriesOf(result)[1]!.markPoint).toMatchObject({ data: [
    { value: 40 }, { value: 40 }, { value: 40 }
  ] });
});

it('keeps explicit unit names aligned with projected visible series and legend entries', () => {
  const { page, data } = fixture();
  const chart = page.sections[1]!.components[0] as BarChartComponent;
  chart.props.series.forEach((series, index) => { series.unit = index === 2 ? '%' : '元'; });
  const program = compilePresentation(page);
  const hidden = mixed(projectedChart(program, input('global')).props, data);
  expect(seriesOf(hidden).map(series => series.name)).toEqual(['销售额（元）', '目标额（元）']);
  expect(hidden.legend).toMatchObject({ data: ['销售额（元）', '目标额（元）'] });
});
