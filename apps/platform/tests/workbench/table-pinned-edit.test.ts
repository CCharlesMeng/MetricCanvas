import { expect, it } from 'vitest';
import fixture from '../../../../pages/capabilities/table/table-pinned-summary.json';
import { createCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';
import { propertyControls, editProperty } from '../../src/lib/workbench/property-edit';
import { versionPolicy } from '@metriccanvas/page/internal';

it('edits the pinned source and its fields atomically and preserves body configuration', () => {
  const original = { ...structuredClone(fixture), schemaVersion: versionPolicy.current };
  const created = createCanvasAuthoringDraft(original);
  if (!created.ok) throw Error(created.message);
  const locator = {sectionId:'main',componentId:'regional-table'};
  const control = propertyControls(created.draft, locator).find(control => control.id === 'table-pinned');
  expect(control?.kind).toBe('json');
  expect(control?.value).toMatchObject({slot:'china',source:'summary',cells:expect.any(Array)});
  const removed = editProperty(created.draft, locator, {kind:'table-pinned',value:undefined});
  expect(removed.ok).toBe(true);
  if (!removed.ok) return;
  const restored = editProperty(removed.draft, locator, {kind:'table-pinned',value:control?.value});
  expect(restored.ok).toBe(true);
  expect(created.draft.pageDocument).toEqual(original);
  const invalid = editProperty(created.draft, locator, {kind:'table-pinned',value:{slot:'china',source:'regions',cells:[]}});
  expect(invalid.ok).toBe(false);
  expect(created.draft.pageDocument).toEqual(original);
});
