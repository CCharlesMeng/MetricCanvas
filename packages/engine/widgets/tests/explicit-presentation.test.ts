import { describe, expect, it } from 'vitest';
import type { MainDataSlots, MetricDataSlots } from '../src/shared/component-data';
import { valueColor, changeValueColor, tableValueColor } from '../src/shared/value-color';
import { barOption } from '../src/components/bar-chart/options';
import { lineOption } from '../src/components/line-chart/options';
import { cartesianFrame } from '../src/shared/chart-presentation';
import { init } from 'echarts';

describe('numeric color rules', () => {
  it('uses resolved display precision at both consumers while preserving fixed and old rules', () => {
    const colorRule = { mode: 'sign', positive: 'red', negative: 'green' } as const;
    for (const value of [0, -0, 0.04, -0.04, '0.04', '-0.04', null, Infinity]) {
      expect(tableValueColor(value, { field: 'delta', colorRule }, 'number-1-signed')).toBeUndefined();
      expect(changeValueColor(value, { label: '变化', field: 'delta', colorRule }, 'number-1-signed')).toBeUndefined();
    }
    for (const [value, expected] of [[0.05, 'red'], [-0.05, 'green']] as const) {
      expect(tableValueColor(value, { field: 'delta', colorRule }, 'number-1-signed')).toBe(expected);
      expect(changeValueColor(value, { label: '变化', field: 'delta', colorRule }, 'number-1-signed')).toBe(expected);
    }
    expect(valueColor(0.04, colorRule, 'number-1')).toBe('red');
    expect(valueColor(0.04, { mode: 'fixed', color: 'green' }, 'number-1-signed')).toBe('green');
    expect(changeValueColor(0.04, { label: '变化', field: 'delta', tone: 'positive' }, 'number-1-signed')).toBeUndefined();
  });
  it('maps raw sign independently from display format and keeps zero/missing ordinary', () => {
    const rule = { mode: 'sign', positive: 'red', negative: 'green' } as const;
    expect([2, -2, 0, 0.00001, null, undefined].map(value => valueColor(value, rule)))
      .toEqual(['red', 'green', undefined, 'red', undefined, undefined]);
    expect(valueColor(2, { ...rule, positive: 'green', negative: 'red' })).toBe('green');
  });
  it('fixed color includes zero and excludes missing values', () => {
    for (const color of ['red', 'green'] as const) {
      expect([2, -2, 0].map(value => valueColor(value, { mode: 'fixed', color }))).toEqual([color, color, color]);
      expect(valueColor(null, { mode: 'fixed', color })).toBeUndefined();
    }
  });
  it('uses the same rule at table and metric change consumers, with independent local overrides', () => {
    const colorRule = { mode: 'sign', positive: 'red', negative: 'green' } as const;
    expect(tableValueColor(2, { field: 'delta', colorRule })).toBe('red');
    expect(changeValueColor(2, { label: '变化', field: 'delta', colorRule })).toBe('red');
    expect(tableValueColor(2, { field: 'delta', colorRule: { mode: 'fixed', color: 'green' } })).toBe('green');
    expect(tableValueColor(2, { field: 'delta', visual: 'signed' })).toBe('green');
    expect(changeValueColor(-2, { label: '变化', field: 'delta' })).toBe('red');
  });
});

const data: MainDataSlots = { main: {
  fields: { name: { type: 'string', role: 'dimension' }, value: { type: 'number', role: 'measure', defaultFormat: 'number-1' } },
  snapshot: { status: 'ready', rows: Array.from({ length: 60 }, (_, i) => ({ name: `代表处${i}`, value: i === 59 ? null : i - 2 })) }
} };
void (data satisfies MetricDataSlots);

describe('all labels and persistent values', () => {
  it('keeps dense numeric labels close to their own bar end or line node', () => {
    const dense: MainDataSlots = { main: { ...data.main,
      snapshot: { status: 'ready', rows: Array.from({ length: 30 }, (_, i) => ({ name: `分类${i}`, value: i === 0 ? -2 : i })) }
    } };
    const props = { categoryLabels: { mode: 'all' as const, rotate: 90 }, showValueLabels: true };
    for (const option of [
      barOption(dense, { ...props, categoryField: 'name', series: [{ field: 'value' }] }),
      lineOption(dense, { ...props, xField: 'name', series: [{ field: 'value' }] }),
      barOption(dense, { ...props, categoryField: 'name', series: [{ field: 'value', kind: 'bar', axis: 'primary' }, { field: 'value', kind: 'line', axis: 'primary' }] })
    ]) {
      const frame = cartesianFrame(option, 1076, true);
      const chart = init(null, undefined, { renderer: 'svg', ssr: true, width: 1076, height: frame.minHeight });
      try {
        chart.setOption({ ...frame.option, animation: false });
        const labels = [...chart.renderToSVGString().matchAll(/<text([^>]+)>(.*?)<\/text>/gu)]
          .filter(text => text[1]!.includes('font-size:11px'));
        const seriesCount = Array.isArray(option.series) ? option.series.length : 0;
        expect(labels).toHaveLength(30 * seriesCount);
        labels.forEach((label, i) => {
          const index = i % 30, seriesIndex = Math.floor(i / 30);
          const value = dense.main.snapshot.rows[index]!.value;
          if (typeof value !== 'number') throw new Error('Expected numeric test value');
          const point = chart.convertToPixel({ seriesIndex }, [index, value]) as number[];
          const transform = /translate\([\d.-]+ ([\d.-]+)\)/u.exec(label[1]!);
          expect(transform).not.toBeNull();
          const gap = Math.abs(Number(transform![1]) - point[1]!);
          expect(gap, `series ${seriesIndex}, category ${index}, value ${label[2]}`).toBeLessThanOrEqual(16);
        });
      } finally { chart.dispose(); }
    }
  });
  it('actually paints every category and every nonmissing value in ECharts SVG without hover', () => {
    const props = { categoryLabels: { mode: 'all' as const, rotate: 90 }, showValueLabels: true };
    const options = [
      barOption(data, { ...props, categoryField: 'name', series: [{ field: 'value' }] }),
      lineOption(data, { ...props, xField: 'name', series: [{ field: 'value' }] }),
      barOption(data, { ...props, categoryField: 'name', series: [{ field: 'value', kind: 'bar', axis: 'primary' }, { field: 'value', kind: 'line', axis: 'primary' }] })
    ];
    options.forEach((option, index) => {
      const frame = cartesianFrame(option, 1190, true);
      const chart = init(null, undefined, { renderer: 'svg', ssr: true, width: 1190, height: frame.minHeight });
      try {
        chart.setOption({ ...frame.option, animation: false });
        const texts = [...chart.renderToSVGString().matchAll(/<text([^>]+)>(.*?)<\/text>/gu)];
        for (const row of data.main.snapshot.rows) expect(texts.some(text => text[2] === row.name)).toBe(true);
        const valueLabels = texts.filter(text => text[1]!.includes('font-size:11px'));
        expect(valueLabels).toHaveLength(59 * (index === 2 ? 2 : 1));
        expect(valueLabels.filter(text => text[2] === '0.0')).toHaveLength(index === 2 ? 2 : 1);
        chart.resize({ width: 800, height: frame.minHeight });
        const once = [...chart.renderToSVGString().matchAll(/<text([^>]+)>(.*?)<\/text>/gu)].filter(text => text[1]!.includes('font-size:11px')).map(text => text[0]);
        chart.resize({ width: 800, height: frame.minHeight });
        const twice = [...chart.renderToSVGString().matchAll(/<text([^>]+)>(.*?)<\/text>/gu)].filter(text => text[1]!.includes('font-size:11px')).map(text => text[0]);
        expect(twice).toEqual(once);
      } finally { chart.dispose(); }
    });
  });
  it('does not window or omit category names in any chart branch', () => {
    for (const option of [
      barOption(data, { categoryField: 'name', series: [{ field: 'value' }], categoryLabels: { mode: 'all', rotate: 45 }, showValueLabels: true }),
      barOption(data, { categoryField: 'name', series: [{ field: 'value', kind: 'bar', axis: 'primary' }, { field: 'value', kind: 'line', axis: 'primary' }], categoryLabels: { mode: 'all', rotate: 45 }, showValueLabels: true }),
      lineOption(data, { xField: 'name', series: [{ field: 'value' }], categoryLabels: { mode: 'all', rotate: 45 }, showValueLabels: true })
    ]) {
      expect(option.dataZoom).toBeUndefined();
      expect(option.xAxis).toMatchObject({ data: data.main.snapshot.rows.map(row => row.name), axisLabel: { interval: 0, hideOverlap: false, rotate: 45 } });
      for (const series of Array.isArray(option.series) ? option.series : []) {
        expect(series).toMatchObject({ label: { show: true, formatter: expect.any(Function) }, labelLayout: expect.any(Function) });
        expect(series.data).toHaveLength(60);
        expect(Array.isArray(series.data) ? series.data[59] : undefined).toBeNull();
      }
    }
  });
  it('formats value labels using the same binding override as tooltips, including zero', () => {
    const option = lineOption(data, { xField: 'name', series: [{ field: { data: 'main', field: 'value', format: 'number-2' } }], showValueLabels: true });
    const series = option.series as Array<{ label: { formatter: (params: unknown) => string }; tooltip: { valueFormatter: (value: unknown) => string } }>;
    for (const value of [0, -2.35, 3.12]) expect(series[0]!.label.formatter({ value })).toBe(series[0]!.tooltip.valueFormatter(value));
    expect(series[0]!.label.formatter({ value: null })).toBe('');
  });
  it('grows the frame for rotated categories and wrapping legends without business knowledge', () => {
    const option = lineOption(data, { xField: 'name', series: [{ field: 'value', label: '第一条较长的系列名称' }, { field: 'value', label: '第二条较长的系列名称' }], categoryLabels: { mode: 'all', rotate: 45 }, showValueLabels: true });
    const wide = cartesianFrame(option, 1190, true), narrow = cartesianFrame(option, 260, true);
    expect(narrow.minHeight).toBeGreaterThan(wide.minHeight!);
    expect(wide.minHeight).toBeGreaterThan(280);
  });
});
