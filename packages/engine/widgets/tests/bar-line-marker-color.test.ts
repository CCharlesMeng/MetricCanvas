import { expect, it } from 'vitest';
import { flattenPageComponents, parsePage, resolveDataSourceFields } from '@metriccanvas/page/internal';
import scene from '../../../../pages/capabilities/chart/bar-line-marker-color.json';
import { barOption } from '../src/components/bar-chart/options';
import type { MainDataSlots } from '../src/shared/component-data';

const red = '#f5222d';
const green = '#52c41a';
const parsed = parsePage(scene);
if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const chart = flattenPageComponents(parsed.page).find(component => component.type === 'barChart')!;
const [column, line] = chart.props.series;
const data: MainDataSlots = {
  main: {
    fields: resolveDataSourceFields(parsed.page.dataSources.sample!),
    snapshot: { status: 'ready', rows: scene.dataSources.sample.source.rows }
  }
};
if (!line || !column || !('markerColorRule' in line)) throw Error('示例需声明一个柱系列和一个字段折线系列');

it('按未舍入的数值选择环比圆点颜色，并保留原值和缺口', () => {
  expect(barOption(data, chart.props).series).toMatchObject([
    { type: 'bar', data: [24, 25, 27, 23, 26] },
    {
      type: 'line', symbol: 'circle', showAllSymbol: true, connectNulls: false,
      data: [
        { value: -2, itemStyle: { color: red } },
        { value: 0, itemStyle: { color: green } },
        { value: 2, itemStyle: { color: green } },
        null,
        { value: -0.004, itemStyle: { color: red } }
      ]
    }
  ]);
});

it('读取系列指定的配色，省略规则则沿用已有呈现', () => {
  const { markerColorRule, ...unchangedLine } = line;
  expect(markerColorRule).toBeDefined();
  const unconfigured = barOption(data, { ...chart.props, series: [column, unchangedLine] });
  const reversedRule: NonNullable<typeof markerColorRule> = { negative: 'green', nonNegative: 'red' };
  const reversed = barOption(data, {
    ...chart.props,
    series: [column, { ...unchangedLine, markerColorRule: reversedRule }]
  });
  if (!Array.isArray(unconfigured.series) || !Array.isArray(reversed.series)) throw Error('缺少图表系列');
  const [originalColumn, originalLine] = unconfigured.series;
  if (originalColumn?.type !== 'bar' || originalLine?.type !== 'line') throw Error('缺少原始柱线系列');
  expect(originalLine.data).toEqual([-2, 0, 2, null, -0.004]);
  expect(reversed.series[0]).toMatchObject({
    data: originalColumn.data, itemStyle: originalColumn.itemStyle
  });
  expect(reversed.series[1]).toMatchObject({
    itemStyle: originalLine.itemStyle,
    data: [
      { value: -2, itemStyle: { color: green } },
      { value: 0, itemStyle: { color: red } },
      { value: 2, itemStyle: { color: red } },
      null,
      { value: -0.004, itemStyle: { color: green } }
    ]
  });
});
