import { describe, expect, it } from 'vitest';
import type { PieChartProps } from '@metriccanvas/page/internal';
import type { MainDataSlots } from '../src/shared/component-data';
import { pieRows, pieLegendData, pieCategoryDomain } from '../src/components/pie-chart/presentation';
import { pieOption } from '../src/components/pie-chart/options';
import { categoryBreakdownView } from '../src/components/category-breakdown/rows';

const data: MainDataSlots = { main: {
  fields: {
    band: { type: 'string', role: 'dimension' },
    count: { type: 'number', role: 'measure' },
    share: { type: 'number', role: 'measure', defaultFormat: 'percent-1' }
  },
  snapshot: { status: 'ready', rows: [
    { band: '低', count: 2, share: 15 }, { band: '中', count: 6, share: 75 },
    { band: '高', count: 2, share: 10 }, { band: '缺失', count: null, share: null },
    { band: '零', count: 0, share: 0 }
  ] }
} };
const props: PieChartProps = { categoryField: 'band', valueField: 'count',
  legend: { type: 'table', columns: [
    { label: '数量', field: 'count' }, { label: '占比', value: 'percentage' }
  ] } };
const palette = ['#111', '#222', '#333', '#444', '#555'];

function table(config = props, input = data) {
  const projection = pieLegendData(input, config);
  return categoryBreakdownView(projection.data, projection.props, palette, pieCategoryDomain(input, config), projection.columnPresentation);
}

describe('pie table legend', () => {
  it('shares constant-value resolution with sectors, percentages and stable row identities', () => {
    const config: PieChartProps = { categoryField: 'band', value: 3, sort: 'desc',
      legend: { type: 'table', columns: [{ label: '占比', value: 'percentage' }] } };
    expect(pieRows(data, config)).toEqual(data.main.snapshot.rows);
    expect(table(config).rows.map(row => row.values)).toEqual(Array(5).fill(['20.0%']));
    expect(pieOption(data, config).series).toMatchObject([{ data: Array(5).fill({ value: 3 }) }]);
    expect(pieRows(data, config)[0]).toBe(data.main.snapshot.rows[0]);
  });

  it('preserves empty and error source behavior for constant-value legends', () => {
    const config: PieChartProps = { categoryField: 'band', value: 3,
      legend: { type: 'table', columns: [{ label: '占比', value: 'percentage' }] } };
    const empty = structuredClone(data);
    empty.main.snapshot.rows = [];
    expect(table(config, empty).rows).toEqual([]);
    const error = structuredClone(data);
    error.main.sourceStatus = 'error';
    expect(table(config, error).rows).toEqual([]);
    expect(pieRows(error, config)).toEqual([]);
  });

  it('appends optional units after formatting without changing numeric sectors or input rows', () => {
    const config: PieChartProps = { ...props, legend: { type: 'table', columns: [
      { label: '客户数量', field: { data: 'main', field: 'count', format: 'number-1' }, unit: '家', align: 'center' },
      { label: '占比', value: 'percentage', align: 'left' }
    ] } };
    const original = structuredClone(data);
    expect(table(config).rows[0]!.values).toEqual(['2.0 家', '20.0%']);
    expect(table(config).rows[3]!.values).toEqual(['0.0 家', '0.0%']);
    expect(pieRows(data, config)[0]!.count).toBe(2);
    expect(data).toEqual(original);
    expect(pieLegendData(data, config).columnPresentation).toEqual([
      { unit: '家', align: 'center' }, { unit: undefined, align: 'left' }
    ]);
  });

  it('keeps missing values free of unit suffixes and leaves omitted options unchanged', () => {
    const input = structuredClone(data);
    input.main.snapshot.rows[0]!.share = null;
    const config: PieChartProps = { ...props, legend: { type: 'table', columns: [
      { label: '缺失字段', field: { data: 'main', field: 'share', missingText: '暂无' }, unit: '家' },
      { label: '数量', field: 'count' }
    ] } };
    expect(table(config, input).rows[0]!.values).toEqual(['暂无', '2']);
    expect(table().rows[0]!.values).toEqual(['2', '20.0%']);
    expect(pieLegendData(data, props).columnPresentation).toEqual([
      { unit: undefined, align: undefined }, { unit: undefined, align: undefined }
    ]);
  });

  it('keeps source order by default and stable ties in explicit value sorting, without mutating source', () => {
    const original = structuredClone(data);
    expect(pieRows(data, props).map(row => row.band)).toEqual(['低', '中', '高', '零']);
    expect(pieRows(data, { ...props, sort: 'desc' }).map(row => row.band)).toEqual(['中', '低', '高', '零']);
    expect(pieRows(data, { ...props, sort: 'asc' }).map(row => row.band)).toEqual(['零', '低', '高', '中']);
    expect(data).toEqual(original);
  });

  it('fixes configured category order and colors across value and input-order changes', () => {
    const config: PieChartProps = { ...props, categoryOrder: ['低', '中', '高', '缺失', '零'] };
    const changed = structuredClone(data);
    changed.main.snapshot.rows.reverse();
    changed.main.snapshot.rows[2]!.count = 100;
    expect(table(config, changed).rows.map(row => [row.category, row.swatch]))
      .toEqual(table(config).rows.map(row => [row.category, row.swatch]));
  });

  it('keeps source row identities for sorted sector clicks, with zero rows and no missing-number rows', () => {
    const rows = pieRows(data, { ...props, sort: 'desc' });
    expect(rows[0]).toBe(data.main.snapshot.rows[1]);
    expect(rows[3]).toBe(data.main.snapshot.rows[4]);
    expect(table({ ...props, sort: 'desc' }).rows.map(row => row.category)).toEqual(rows.map(row => row.band));
  });

  it('distinguishes returned percentage fields from calculated percentages and retains column order', () => {
    expect(table().rows[0]!.values).toEqual(['2', '20.0%']);
    const bound: PieChartProps = { ...props, legend: { type: 'table', columns: [
      { label: '返回占比', field: 'share' }, { label: '数量', field: 'count' }
    ] } };
    expect(table(bound).columns).toEqual(['返回占比', '数量']);
    expect(table(bound).rows[0]!.values).toEqual(['15.0%', '2']);
    expect(table().categoryLabel).toBeUndefined();
  });

  it('leaves a zero-total percentage missing and retains distinct rows with duplicate display labels', () => {
    const zero = structuredClone(data);
    zero.main.snapshot.rows = [{ band: '重复', count: 0 }, { band: '重复', count: 0 }];
    const view = table(props, zero);
    expect(view.rows).toHaveLength(2);
    expect(view.rows[0]!.values[1]).toBe('—');
  });

  it('hides outer labels only by default for table legends and keeps existing charts unchanged', () => {
    expect(pieOption(data, props).series).toMatchObject([{ label: { show: false } }]);
    expect(pieOption(data, { ...props, labelLine: true }).series).toMatchObject([{ label: { show: true } }]);
    expect(pieOption(data, { categoryField: 'band', valueField: 'count' }).series)
      .toMatchObject([{ label: { show: true } }]);
  });
});
