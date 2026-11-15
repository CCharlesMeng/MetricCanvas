import { expect, it } from 'vitest';
import type { EChartsOption } from 'echarts';
import { loadingChartOption, loadingChartSource } from '../src/shared/chart-loading';

function barValues(option: EChartsOption) {
  const series = Array.isArray(option.series) ? option.series : [];
  const bar = series.find(item => item.type === 'bar');
  if (bar?.type !== 'bar') throw new Error('Expected native bar geometry');
  return bar.data;
}

it('paints configured native shapes without changing the input option or its data', () => {
  const option: EChartsOption = { xAxis: { type: 'category', data: [] }, yAxis: { type: 'value', min: 0, max: 100 },
    series: [{ type: 'bar', stack: 'total', data: [] }, { type: 'line', smooth: true, data: [] }] };
  const original = structuredClone(option);
  const result = loadingChartOption(option);
  expect(result.series).toEqual([
    expect.objectContaining({ type: 'bar', stack: 'total', data: expect.any(Array), silent: true }),
    expect.objectContaining({ type: 'line', smooth: true, data: expect.any(Array), label: { show: false } })
  ]);
  expect(barValues(result)).toHaveLength(6);
  expect(barValues(result)?.every(value => typeof value === 'number' && value > 0 && value < 100)).toBe(true);
  expect(result.xAxis).toEqual([expect.objectContaining({ type: 'category', data: ['', '', '', '', '', ''] })]);
  expect(result.tooltip).toEqual({ show: false });
  expect(option).toEqual(original);
});

it('preserves horizontal axes and pie radius and reuses previous geometry on refresh', () => {
  const previous: EChartsOption = { xAxis: { type: 'value', max: 1 }, yAxis: { type: 'category', inverse: true, data: ['A', 'B'] },
    series: [{ type: 'bar', data: [0.2, 0.7] }] };
  expect(loadingChartOption(previous).series).toEqual([expect.objectContaining({ data: [0.2, 0.7] })]);
  const ring = loadingChartOption({ series: [{ type: 'pie', radius: ['58%', '82%'], data: [] }] });
  expect(ring.series).toEqual([expect.objectContaining({ type: 'pie', radius: ['58%', '82%'], data: [{ value: 1, name: '' }] })]);
  expect(loadingChartOption(previous).yAxis).toEqual(previous.yAxis);
});

it('keeps fractional axis ranges, custom series and map geometry in the screen projection', () => {
  const option: EChartsOption = { xAxis: { type: 'value', min: 0, max: 0.01 }, yAxis: { type: 'category', inverse: true },
    series: [{ type: 'bar' }, { type: 'map', map: 'china', data: [] }] };
  const result = loadingChartSource({ base: option, extended: { series: [{ type: 'line', smooth: true }] } });
  expect(result.base?.series).toEqual([
    expect.objectContaining({ type: 'bar', data: expect.any(Array) }),
    expect.objectContaining({ type: 'map', map: 'china', data: [] })
  ]);
  expect(barValues(result.base!)?.every(value => typeof value === 'number' && value > 0 && value < 0.01)).toBe(true);
  expect(result.extended?.series).toEqual([expect.objectContaining({ type: 'line', smooth: true })]);
});
