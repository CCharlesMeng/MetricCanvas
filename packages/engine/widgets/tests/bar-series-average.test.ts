import { expect, it } from 'vitest';
import type { BarChartProps } from '@metriccanvas/page/internal';
import { projectChartSeries } from '../../runtime/src/chart-series-state';
import { barOption } from '../src/components/bar-chart/options';
import type { MainDataSlots } from '../src/shared/component-data';

function slots(values: Array<number | null | string>): MainDataSlots {
  return { main: { snapshot: { status: 'ready', rows: values.map((amount, index) => ({ office: String(index), amount, other: index * 10 })) },
    fields: { office: { type: 'string', role: 'dimension' }, amount: { type: 'number', role: 'measure', unit: '次' },
      other: { type: 'number', role: 'measure', unit: '天' } } } };
}
const props: BarChartProps = { categoryField: 'office', series: [
  { field: 'amount', label: '当前值', unit: '次' }, { field: 'amount', label: '均值', aggregate: 'avg', unit: '次' }
] };

it('pairs current and computed average bars at every original category without changing snapshots', () => {
  const data = slots([120, 60, null]), before = structuredClone(data);
  const result = barOption(data, props);
  expect(result.xAxis).toMatchObject({ data: ['0', '1', '2'] });
  expect(result.series).toMatchObject([
    { type: 'bar', name: '当前值（次）', data: [120, 60, undefined] },
    { type: 'bar', name: '均值（次）', data: [90, 90, 90] }
  ]);
  expect(data).toEqual(before);
  expect(barOption(slots([10, 5]), props).series).toMatchObject([{ data: [10, 5] }, { data: [7.5, 7.5] }]);
});

it.each([
  [[null, NaN, Infinity, -Infinity, ''], undefined],
  [[0, 0], 0],
  [[-10, 0, 10], 0],
  [[1.234, 2.345], 1.7895],
  [[Number.MAX_VALUE, Number.MAX_VALUE], Number.MAX_VALUE]
])('computes valid original values %j before formatting', (values, mean) => {
  const result = barOption(slots(values), { ...props, series: [{ field: { data: 'main', field: 'amount', format: 'number-1' }, aggregate: 'avg' }] });
  expect(result.series).toMatchObject([{ data: values.map(() => mean) }]);
});

it('preserves empty and legacy charts without adding categories', () => {
  expect(barOption(slots([]), props)).toMatchObject({ xAxis: { data: [] }, series: [{ data: [] }, { data: [] }] });
  const old = { categoryField: 'office', series: [{ field: 'amount' }] };
  expect(barOption(slots([10, 5]), old).series).toMatchObject([{ data: [10, 5] }]);
});

it('renders horizontal mean labels and includes values outside the zoom window', () => {
  expect(barOption(slots([-10, 0]), { ...props, horizontal: true, showValueLabels: true })).toMatchObject({
    yAxis: { data: ['0', '1'] }, series: [expect.anything(), { data: [
      { value: -5, label: { position: 'left' } }, { value: -5, label: { position: 'left' } }
    ] }]
  });
  const result = barOption(slots(Array.from({ length: 21 }, (_, index) => index)), props);
  expect(result.series).toMatchObject([expect.anything(), { data: Array.from({ length: 21 }, () => expect.closeTo(10)) }]);
  expect(result.dataZoom).toBeDefined();
});

it('averages the declared field independently of other series, visibility and comparison lines', () => {
  const mixed: BarChartProps = { ...props, dualAxis: true, series: [
    { field: 'amount', kind: 'bar', axis: 'primary' },
    { field: 'amount', aggregate: 'avg', kind: 'bar', axis: 'primary' },
    { field: 'other', kind: 'line', axis: 'secondary' },
    { field: 'other', aggregate: 'avg', kind: 'bar', axis: 'secondary' }
  ] };
  expect(barOption(slots([10, 0]), mixed).series).toMatchObject([
    { data: [10, 0] }, { data: [5, 5] }, { data: [0, 10] }, { data: [5, 5] }
  ]);
  mixed.series[0] = { ...mixed.series[0]!, visibleWhen: { filter: 'scope', part: 'value', op: 'eq', value: 'office' } };
  expect(barOption(slots([10, 0]), projectChartSeries(mixed, series => !series.visibleWhen)).series).toMatchObject([
    { data: [5, 5] }, { data: [0, 10] }, { data: [5, 5] }
  ]);
});
