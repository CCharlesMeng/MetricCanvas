import { describe, expect, it } from 'vitest';
import { barOption } from '../src/components/bar-chart/options';
import { lineOption } from '../src/components/line-chart/options';
import { pieOption, pieRows } from '../src/components/pie-chart/options';
import { mapOption } from '../src/components/map-chart/options';
import { resolveComponentValue } from '../src/shared/component-value';
import type { MainDataSlots } from '../src/shared/component-data';

function data(): MainDataSlots {
  return {main: {snapshot: {status: 'ready', rows: [
    {category: '北京', actual: 1}, {category: '上海', actual: null}, {category: '广东', actual: 4}
  ]}, fields: {
    category: {type: 'string', role: 'dimension', label: '地区'},
    actual: {type: 'number', role: 'measure', label: '实际值', unit: '个'}
  }}};
}
function series(option: unknown): {name?: string; data: unknown[]; label?: unknown}[] {
  return (option as {series: {data: unknown[]}[]}).series;
}

describe('constant consumer values', () => {
  it('shares the existing category rows and keeps snapshots unchanged', () => {
    const input = data(), original = structuredClone(input);
    const option = lineOption(input, {xField: 'category', series: [{field: 'actual'}, {value: 2, label: '基线'}]});
    expect(series(option).map(s => s.data)).toEqual([[1, undefined, 4], [2, 2, 2]]);
    expect(series(option)[1].name).toBe('基线');
    expect(input).toEqual(original);
  });
  it.each([false, true])('includes constants in stacked/horizontal bars (%s)', horizontal => {
    const option = barOption(data(), {categoryField: 'category', stacked: true, horizontal,
      series: [{field: 'actual'}, {value: 2}]});
    expect(series(option)[1].data).toEqual([2, 2, 2]);
  });
  it('handles mixed axes and zero without losing the constant series', () => {
    const option = barOption(data(), {categoryField: 'category', dualAxis: true,
      series: [{field: 'actual', kind: 'bar', axis: 'primary'}, {value: 0, kind: 'line', axis: 'secondary', unit: '个'}]});
    expect(series(option)[1].data).toEqual([0, 0, 0]);
  });
  it('uses constant values for all existing pie categories and preserves click rows', () => {
    const props = {categoryField: 'category', value: 2};
    expect(series(pieOption(data(), props))[0].data).toEqual([
      {name: '北京', value: 2}, {name: '上海', value: 2}, {name: '广东', value: 2}
    ]);
    expect(pieRows(data(), props)).toEqual(data().main.snapshot.rows);
  });
  it('uses constant map values without adding unrepresented regions', () => {
    const option = mapOption(data(), {nameField: 'category', value: 2, map: 'china'}, new Map());
    expect(series(option)[0].data).toEqual([
      {name: '北京', value: 2}, {name: '上海', value: 2}, {name: '广东', value: 2}
    ]);
  });
  it.each(['point', 'effect'] as const)('uses the constant in %s scatter coordinates', scatter => {
    const option = mapOption(data(), {nameField: 'category', value: 2, map: 'china', scatter}, new Map([['北京', [116, 39]]]));
    expect(series(option)[1].data).toEqual([{name: '北京', value: [116, 39, 2]}]);
  });
  it('keeps constant forecast values in the existing forecast presentation', () => {
    const option = barOption(data(), {categoryField: 'category', variant: 'reportForecast',
      series: [{value: 2, label: '固定预测', role: 'forecast', format: 'number'}]});
    expect(series(option)[0].data).toEqual([2, 2, 2]);
    expect(series(option)[0].name).toBe('固定预测');
  });
  it('distinguishes standalone, successful empty, loading and failed input', () => {
    expect(resolveComponentValue({value: 2}, {}).read()).toBe(2);
    const empty: MainDataSlots = {main: {fields: {}, sourceStatus: 'empty', snapshot: {status: 'ready', rows: []}}};
    expect(resolveComponentValue({value: 2}, empty).read()).toBeUndefined();
    expect(resolveComponentValue({value: 2}, empty, 'showConstants').read()).toBe(2);
    for (const sourceStatus of ['error', 'loading'] as const) {
      expect(resolveComponentValue({value: 2}, {main: {...empty.main, sourceStatus}}, 'showConstants').read()).toBeUndefined();
    }
  });
  it('does not create category positions when the result is empty', () => {
    const input = data(); input.main.snapshot.rows = [];
    const option = lineOption(input, {xField: 'category', emptyBehavior: 'showConstants', series: [{value: 2}]});
    expect(series(option)[0].data).toEqual([]);
  });
  it('keeps explicit constant formatting independent of the first field', () => {
    const value = resolveComponentValue({value: 2, format: 'percent-1', unit: '%'}, data());
    expect(value.format).toBe('percent-1'); expect(value.unit).toBe('%'); expect(value.read()).toBe(2);
  });
});
