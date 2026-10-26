import { expect, it } from 'vitest';
import { retainChartConstants } from '../../src/lib/workbench/chart-value-conversion';
import fixture from './fixtures/document-edit.json';
import { createCanvasAuthoringDraft, changeComponentType } from '../../src/lib/workbench/document-edit';
import { versionPolicy } from '@metriccanvas/page';

it('retains mixed field/constant series when switching between cartesian chart shapes', () => {
  const previous = {xField: 'date', emptyBehavior: 'showConstants', series: [{field: 'actual'}, {value: 2, label: '基线', format: 'number'}]};
  expect(retainChartConstants(previous, 'barChart', {categoryField: 'other', series: [{field: 'actual'}]})).toEqual({ok: true, props: {
    categoryField: 'date', emptyBehavior: 'showConstants', series: previous.series
  }});
});
it('retains a scalar constant across single-value shapes and into a series', () => {
  expect(retainChartConstants({value: 2, unit: '个'}, 'gauge', {valueField: 'actual'})).toEqual({ok: true, props: {value: 2, unit: '个'}});
  expect(retainChartConstants({value: 2}, 'lineChart', {xField: 'date'})).toEqual({ok: true, props: {xField: 'date', series: [{value: 2}]}});
});
it('rejects lossy series and axis conversions rather than silently deleting constants', () => {
  expect(retainChartConstants({series: [{field: 'actual'}, {value: 2}]}, 'pieChart', {valueField: 'actual'}).ok).toBe(false);
  expect(retainChartConstants({dualAxis: true, series: [{value: 2, axis: 'secondary'}, {field: 'actual', axis: 'primary'}]}, 'lineChart', {}).ok).toBe(false);
  expect(retainChartConstants({value: 2}, 'table', {}).ok).toBe(false);
});

it('preserves a constant through the real whole-document type-change operation', () => {
  const input = structuredClone(fixture);
  input.schemaVersion = versionPolicy.current;
  const chart = input.sections[0].components[1];
  const source = {...chart, props: {...chart.props, series: [{field: 'tokens'}, {value: 2, label: '基线'}]}};
  const document = {...input, sections: [{...input.sections[0], components: [input.sections[0].components[0], source]}]};
  const original = createCanvasAuthoringDraft(document);
  if (!original.ok) throw Error(original.message);
  const changed = changeComponentType(original.draft, {sectionId: 'main', componentId: chart.id}, 'barChart');
  expect(changed.ok).toBe(true);
  if (!changed.ok) throw Error(changed.message);
  const sections = changed.draft.pageDocument.sections as {components: {props: {series: unknown[]}}[]}[];
  expect(sections[0].components[1].props.series).toEqual([{field: 'tokens'}, {value: 2, label: '基线'}]);
});
