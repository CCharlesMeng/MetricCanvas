import { describe, expect, it, vi } from 'vitest';
import scene from '../../../../pages/capabilities/chart/chart-echarts-option-page.json';
import { flattenPageComponents, parsePage, resolveDataSourceFields } from '@metriccanvas/page/internal';
import type { MainDataSlots } from '../src/shared/component-data';
import { barOption, barSeriesOrder } from '../src/components/bar-chart/options';
import { pieOption, pieRows } from '../src/components/pie-chart/options';
import { cartesianFrame } from '../src/shared/chart-presentation';
import { chartSource, mergeChartOption, logChartFailure } from '../src/shared/chart-option-extension';

function parsed() {
  const result = parsePage(scene);
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  const data: MainDataSlots = { main: { fields: resolveDataSourceFields(result.page.dataSources.sales!), snapshot: { status: 'ready', rows: scene.dataSources.sales.source.rows } } };
  return { components: flattenPageComponents(result.page), data };
}

describe('ECharts 呈现合并', () => {
  it('按声明序补充重排后的柱系列，不污染基础 option 和数据', () => {
    const { components, data } = parsed();
    const bar = components.find(component => component.type === 'barChart');
    if (bar?.type !== 'barChart') throw Error('fixture missing bar');
    const base = barOption(data, bar.props);
    const original = structuredClone(scene);
    const merged = mergeChartOption(base, bar.props.echartsOption!, barSeriesOrder(bar.props));
    expect(Array.isArray(merged.series) && merged.series.map(series => [series.name, 'itemStyle' in series ? series.itemStyle : undefined])).toEqual([
      ['目标', expect.objectContaining({ color: '#0891b2' })],
      ['实际', expect.objectContaining({ color: '#7c3aed', opacity: 0.7 })]
    ]);
    expect(merged.series).not.toBe(base.series);
    expect(base.grid).not.toEqual(merged.grid);
    expect(scene).toEqual(original);
  });
  it('普通数组替换，空 series 补丁保留数据和内部 formatter 函数', () => {
    const formatter = () => 'engine';
    const base = { color: ['red', 'green'], tooltip: { formatter }, series: [{ type: 'pie' as const, radius: ['10%', '70%'], data: [1, 2] }] };
    const merged = mergeChartOption(base, { color: ['blue'], series: [{ radius: ['30%', '60%'] }] });
    expect(merged.color).toEqual(['blue']);
    expect(merged.tooltip).toEqual({ formatter });
    expect(merged.series).toEqual([{ type: 'pie', radius: ['30%', '60%'], data: [1, 2] }]);
    expect(mergeChartOption(base, { series: [] }).series).toEqual(base.series);
    expect(base.color).toEqual(['red', 'green']);
  });
  it('构造异常变成失败值，非法数据补丁不能回退绕过校验', () => {
    const diagnostic = { componentId: 'fixture', componentType: 'lineChart' as const, path: '/sections/0/components/0/props/echartsOption' };
    const cause = Error('base unavailable');
    expect(chartSource(() => { throw cause; }, {}, diagnostic)).toMatchObject({ failure: { stage: 'build', cause } });
    const source = chartSource(() => ({ series: [] }), { series: [{}], echartsOption: { series: [{ data: [5] }] } }, diagnostic);
    expect(source.base).toBeUndefined();
    expect(source.failure).toMatchObject({ stage: 'validate', path: `${diagnostic.path}/series/0/data` });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logChartFailure(source, 'apply', cause, true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('CHART_OPTION_DEGRADED'), expect.objectContaining({ ...diagnostic, stage: 'apply', cause }));
    warn.mockRestore();
  });
  it('饼图扇区与点击共享有效行，保留真实零和重复类别身份', () => {
    const { components, data } = parsed();
    const pie = components.find(component => component.type === 'pieChart');
    if (pie?.type !== 'pieChart') throw Error('fixture missing pie');
    const rows = pieRows(data, pie.props);
    expect(rows.map(row => row.actual)).toEqual([12, 0, 26]);
    expect(rows[1]).toBe(data.main.snapshot.rows[2]);
    const option = pieOption(data, pie.props);
    expect(Array.isArray(option.series) && option.series[0]?.data).toHaveLength(3);
    const repeated = { month: '一月', actual: 19, target: 20 };
    const duplicateData: MainDataSlots = { main: { ...data.main, snapshot: { status: 'ready', rows: [...data.main.snapshot.rows, repeated] } } };
    const projected = pieRows(duplicateData, pie.props);
    expect(projected).toHaveLength(4);
    expect(projected[0]).toBe(data.main.snapshot.rows[0]);
    expect(projected[3]).toBe(repeated);

  });
});

it('merge-stage exceptions remain recoverable values rather than escaping the parent derivation', () => {
  const cause = Error('merge fault');
  const base = Object.defineProperty({}, 'series', { enumerable: true, get() { throw cause; } });
  const result = chartSource(() => base, { series: [{}], echartsOption: { color: ['red'] } }, { componentId: 'fault', componentType: 'lineChart', path: '/props/echartsOption' });
  expect(result.base).toBe(base);
  expect(result.failure).toEqual({ stage: 'merge', cause });
});
it('percentage grid input is converted against the actual drawing box before safe-space clamping', () => {
  const result = cartesianFrame({ grid: { top: '10%', left: '10%', right: '10%', bottom: '10%' }, xAxis: { type: 'category', data: ['A'] }, yAxis: { type: 'value' } }, 500, true, 400);
  expect(result.option.grid).toMatchObject({ top: 40, left: 50, right: 50 });
  expect(result.minHeight).toBeGreaterThan(300);
});
