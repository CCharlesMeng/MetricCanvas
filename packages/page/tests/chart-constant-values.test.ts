import { expect, it } from 'vitest';
import { parsePage, normalizePageDocument } from '../src/validate';
import { versionPolicy } from '../src/version';
import { barForecastBoundaryIssues } from '../src/bar-forecast-boundary';

function document(type: string, props: Record<string, unknown>, withData = true) {
  return {schemaVersion: versionPolicy.current, id: 'constant-test', layout: 'dashboard',
    dataSources: {main: {fields: {
      category: {type: 'string', role: 'dimension', label: '地区'},
      actual: {type: 'number', role: 'measure', label: '实际', unit: '个'}
    }, source: {type: 'inline', rows: [{category: '北京', actual: 1}]}}},
    sections: [{id: 's', components: [{id: 'c', type, layout: {span: 6},
      ...(withData ? {data: {main: 'main'}} : {}), props}]}]};
}

it.each([
  ['barChart', {categoryField: 'category', series: [{field: 'actual'}, {value: 2}]}],
  ['lineChart', {xField: 'category', series: [{value: 0}]}],
  ['pieChart', {categoryField: 'category', value: 2}],
  ['mapChart', {nameField: 'category', value: 2, map: 'china', tooltipFields: [{label: '目标', value: 3}]}],
  ['gauge', {value: 2}]
])('accepts constant values for %s', (type, props) => {
  const result = parsePage(document(type, props));
  expect(result.ok, JSON.stringify(result)).toBe(true);
});

it.each([
  {field: 'actual', value: 2}, {}, {value: '2'}, {value: [2]}, {value: {value: 2}}, {value: Number.NaN}, {value: Infinity}
])('rejects invalid or ambiguous series origins: %j', source => {
  expect(parsePage(document('lineChart', {xField: 'category', series: [source]})).ok).toBe(false);
  expect(normalizePageDocument(document('lineChart', {xField: 'category', series: [source]})).ok).toBe(false);
});
it('accepts a standalone constant gauge, but requires a slot for field values', () => {
  expect(parsePage(document('gauge', {value: 2}, false)).ok).toBe(true);
  expect(parsePage(document('gauge', {valueField: 'actual'}, false)).ok).toBe(false);
});
it('retains the same-axis unit and currency checks for mixed constants', () => {
  const series = [{field: 'actual', kind: 'bar', axis: 'primary'}, {value: 2, kind: 'line', axis: 'primary', unit: '个'}];
  expect(parsePage(document('barChart', {categoryField: 'category', series})).ok).toBe(true);
  expect(parsePage(document('barChart', {categoryField: 'category', series: [series[0], {...series[1], unit: '元'}]})).ok).toBe(false);
});
it('requires an explicit compatible currency for money presentation', () => {
  expect(parsePage(document('gauge', {value: 2, format: 'cny-adaptive'}, false)).ok).toBe(false);
  expect(parsePage(document('gauge', {value: 2, format: 'cny-adaptive', currency: 'CNY'}, false)).ok).toBe(true);
});
it('enforces the capability floor on constants and empty behavior', () => {
  const input = document('gauge', {value: 2}, false); input.schemaVersion = '6.51';
  expect(parsePage(input).ok).toBe(false);
});
it('applies the existing forecast boundary to constant series', () => {
  const props = {categoryField: 'category', series: [{value: 2, role: 'forecast' as const}]};
  expect(barForecastBoundaryIssues(props, [{category: '1月'}], '2026-02-01')).toHaveLength(1);
  expect(barForecastBoundaryIssues(props, [{category: '3月'}], '2026-02-01')).toEqual([]);
});

it('locates a constant forecast error at its series declaration rather than a fake row field', () => {
  const base = document('barChart', {categoryField: 'category', series: [{value: 2, role: 'forecast'}]});
  const fields = base.dataSources.main.fields;
  const input = {...base, dataSources: {main: {fields: {
    category: {...fields.category, queryField: 'category'}, actual: {...fields.actual, queryField: 'actual'}
  }, source: {type: 'query', query: {language: 'dqe', body: {dsl_list: [{output_dims: ['category'], output_metrics: ['actual']}]}},
    initial: {capturedAt: '2026-02-01T00:00:00Z', rows: [{category: '1月', actual: 1}]}}}}};
  const result = parsePage(input);
  expect(result.ok).toBe(false);
  expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({path: '/sections/0/components/0/props/series/0/value'})]));
});
