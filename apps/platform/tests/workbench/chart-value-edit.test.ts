import { expect, it } from 'vitest';
import sample from '../../../../pages/capabilities/chart/chart-constant-values-page.json';
import { createCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';
import { editProperty, propertyControls } from '../../src/lib/workbench/property-edit';

function draft() {
  const result = createCanvasAuthoringDraft(sample);
  if (!result.ok) throw Error(result.message);
  return result.draft;
}
function componentProps(document: Record<string, unknown>, id: string): Record<string, unknown> {
  const sections = document.sections as {components: {id: string; props: Record<string, unknown>}[]}[];
  return sections[0].components.find(c => c.id === id)!.props;
}
it('switches field and constant sources atomically while keeping data sources unchanged', () => {
  const original = draft(), before = structuredClone(original);
  const locator = {sectionId: 'charts', componentId: 'line'};
  const result = editProperty(original, locator, {kind: 'chart-value', scope: 'series', index: 0, key: 'source', value: 'constant'});
  expect(result.ok).toBe(true); expect(original).toEqual(before);
  if (!result.ok) throw Error(result.message);
  expect(componentProps(result.draft.pageDocument, 'line').series).toMatchObject([{value: 0, unit: '个'}, {value: 2}]);
  expect(result.draft.pageDocument.dataSources).toEqual(original.pageDocument.dataSources);
  const restored = editProperty(result.draft, locator, {kind: 'chart-value', scope: 'series', index: 0, key: 'source', value: 'field'});
  expect(restored.ok).toBe(true);
  if (!restored.ok) throw Error(restored.message);
  expect(componentProps(restored.draft.pageDocument, 'line').series).toMatchObject([{field: 'actual'}, {value: 2}]);
  expect((componentProps(restored.draft.pageDocument, 'line').series as Record<string, unknown>[])[0]).not.toHaveProperty('value');
});
it('adds an ordinary constant series and exposes shared source controls', () => {
  const original = draft(), locator = {sectionId: 'charts', componentId: 'line'};
  expect(propertyControls(original, locator).map(c => c.id)).toContain('chart-series-1-source');
  const result = editProperty(original, locator, {kind: 'chart-series-add', value: 'constant'});
  expect(result.ok).toBe(true);
  if (result.ok) expect(componentProps(result.draft.pageDocument, 'line').series).toHaveLength(3);
});
it('edits map tooltip constants and the chart-level empty policy', () => {
  const original = draft(), locator = {sectionId: 'charts', componentId: 'map'};
  const result = editProperty(original, locator, {kind: 'chart-value', scope: 'tooltip', index: 0, key: 'value', value: 4});
  expect(result.ok).toBe(true);
  if (result.ok) expect(componentProps(result.draft.pageDocument, 'map').tooltipFields).toEqual(expect.arrayContaining([expect.objectContaining({value: 4})]));
  const empty = editProperty(original, locator, {kind: 'chart-empty', value: true});
  expect(empty.ok).toBe(true);
  if (empty.ok) expect(componentProps(empty.draft.pageDocument, 'map').emptyBehavior).toBe('showConstants');
});
it('rejects invalid values, stale indices and a missing field slot without altering the draft', () => {
  const original = draft(), before = structuredClone(original);
  for (const index of [0, 99]) {
    expect(editProperty(original, {sectionId: 'charts', componentId: 'line'},
      {kind: 'chart-value', scope: 'series', index, key: 'value', value: 'bad'}).ok).toBe(false);
  }
  expect(editProperty(original, {sectionId: 'charts', componentId: 'gauge'},
    {kind: 'chart-value', scope: 'main', index: 0, key: 'source', value: 'field'}).ok).toBe(false);
  expect(original).toEqual(before);
});

it('uses the product role expansion when editing grouped query field declarations', () => {
  const input = {...sample, dataSources: {...sample.dataSources, main: {
    fields: {
      dimensions: {category: {queryField: 'category', type: 'string', label: '地区'}},
      measures: {actual: {queryField: 'actual', type: 'number', label: '实际值', unit: '个'}}
    }, source: {type: 'query', query: {language: 'dqe', body: {dsl_list: [{output_dims: ['category'], output_metrics: ['actual']}]}}}
  }}};
  const created = createCanvasAuthoringDraft(input);
  if (!created.ok) throw Error(created.message);
  const result = editProperty(created.draft, {sectionId: 'charts', componentId: 'line'},
    {kind: 'chart-value', scope: 'series', index: 0, key: 'source', value: 'constant'});
  expect(result.ok).toBe(true);
  if (result.ok) expect(componentProps(result.draft.pageDocument, 'line').series).toMatchObject([{value: 0, unit: '个'}, {value: 2}]);
});
