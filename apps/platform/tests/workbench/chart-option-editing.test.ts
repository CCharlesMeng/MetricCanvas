import { expect, it, vi } from 'vitest';
import scene from '../../../../pages/chart-echarts-option-page.json';
import typeFixture from './fixtures/document-edit.json';
import { changeComponentType, createCanvasAuthoringDraft, editComponent, restoreCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';
import { editProperty, propertyControls } from '../../src/lib/workbench/property-edit';

it('ordinary edits and persisted reopening retain hidden options; controls do not expose them', () => {
  const created = createCanvasAuthoringDraft(scene);
  if (!created.ok) throw Error(created.message);
  const locator = { sectionId: 'charts', componentId: 'bars' };
  expect(propertyControls(created.draft, locator).some(control => control.id === 'echartsOption')).toBe(false);
  const edited = editComponent(created.draft, locator, { title: '新标题', span: 12 });
  if (!edited.ok) throw Error(edited.message);
  const property = editProperty(edited.draft, locator, { kind: 'property', name: 'rounded', value: true });
  if (!property.ok) throw Error(property.message);
  const reopened = restoreCanvasAuthoringDraft(JSON.parse(JSON.stringify(property.draft)));
  if (!reopened.ok) throw Error(reopened.message);
  expect(JSON.stringify(reopened.draft)).toContain('#7c3aed');
  expect(JSON.stringify(reopened.draft)).toContain('echartsOption');
});

it('same type retains options, cross-type discards them and only logs to console', () => {
  const document = structuredClone(typeFixture);
  document.schemaVersion = '6.32';
  Object.assign(document.sections[0]!.components[0]!.props, { echartsOption: { color: ['#7c3aed'] } });
  const created = createCanvasAuthoringDraft(document);
  if (!created.ok) throw Error(created.message);
  const locator = { sectionId: 'main', componentId: 'region-tokens-bar-chart' };
  expect(changeComponentType(created.draft, locator, 'barChart')).toEqual(created);
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const switched = changeComponentType(created.draft, locator, 'lineChart');
  expect(switched.ok).toBe(true);
  if (!switched.ok) throw Error(switched.message);
  const sections = switched.draft.pageDocument.sections as typeof typeFixture.sections;
  expect(sections[0]!.components[0]!.props).not.toHaveProperty('echartsOption');
  expect(created.draft.pageDocument).toHaveProperty('sections.0.components.0.props.echartsOption');
  expect(log).toHaveBeenCalledWith('[MetricCanvas][CHART_OPTION_DROPPED]', expect.objectContaining({ componentId: 'region-tokens-bar-chart', path: 'props.echartsOption' }));
  log.mockRestore();
});
