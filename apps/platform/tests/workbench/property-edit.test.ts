import { expect, it } from 'vitest';
import { createCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';
import { editProperty, propertyControls, type PropertyEdit } from '../../src/lib/workbench/property-edit';
import { propertyFixture } from './property-fixture';
function setup() { const result = createCanvasAuthoringDraft(propertyFixture()); if (!result.ok) throw Error(result.message); return result.draft; }
function apply(id: string, edit: PropertyEdit) {
  const original = setup(); const before = structuredClone(original);
  const result = editProperty(original, { sectionId: 's', componentId: id }, edit);
  expect(original).toEqual(before); expect(result.ok).toBe(true); if (!result.ok) throw Error(result.message);
  const components = result.draft.pageDocument.sections as { components: { id: string; props: Record<string, unknown> }[] }[];
  return { original, result: result.draft, props: components[0].components.find((c) => c.id === id)!.props };
}
it.each([
  ['header', { kind: 'property', name: 'badge', value: '新徽标' }],
  ['header', { kind: 'property', name: 'tags', value: ['一', '二'] }],
  ['metric', { kind: 'property', name: 'showTrendArrows', value: false }],
  ['bar', { kind: 'property', name: 'horizontal', value: true }],
  ['line', { kind: 'property', name: 'areaGradient', value: true }],
  ['pie', { kind: 'property', name: 'ring', value: '55%' }],
  ['table', { kind: 'property', name: 'fit', value: 'container' }]
] satisfies [string, PropertyEdit][])('edits the supported %s property without touching sources or siblings', (id, edit) => {
  const { original, result } = apply(id, edit);
  expect(result.pageDocument.dataSources).toEqual(original.pageDocument.dataSources);
  const before = (original.pageDocument.sections as { components: { id: string }[] }[])[0].components;
  const after = (result.pageDocument.sections as { components: { id: string }[] }[])[0].components;
  expect(after.filter((c) => c.id !== id)).toEqual(before.filter((c) => c.id !== id));
});
it('series and metric row edits preserve roles, field formats, changes and actions', () => {
  const series = apply('bar', { kind: 'series-label', index: 0, value: '新系列' });
  expect(series.props.series).toEqual([{ field: 'value', label: '新系列', role: 'actual', stackOrder: 1 }]); expect(series.props.dualAxis).toBe(true); expect(series.props.actions).toEqual(propertyFixture().sections[0].components[2].props.actions);
  const metric = apply('metric', { kind: 'metric-row', rows: 'rows', index: 0, field: 'unit', value: '万元' });
  expect(metric.props.rows).toMatchObject([{ valueField: { data: 'main', field: 'value', format: 'compact-yi-1' }, unit: '万元', changes: [{ label: '同比', field: 'delta', tone: 'positive' }] }]);
});
it('nested existing table columns preserve group titles, binding, visual and pagination', () => {
  const result = apply('table', { kind: 'table-column', indices: [0, 1], field: 'width', value: 200 });
  expect(result.props.columns).toMatchObject([{ title: '分组', children: [{ field: 'category', sortable: true }, { field: 'value', width: 200, visual: 'signed' }] }]);
  expect(result.props.pagination).toEqual({ mode: 'local', pageSize: 10 });
});
it('rejects out-of-whitelist, invalid target and schema-invalid values atomically', () => {
  const draft = setup(); const before = structuredClone(draft);
  const cases: [string, unknown][] = [
    ['bar', { kind: 'property', name: 'dualAxis', value: false }], ['line', { kind: 'property', name: 'stacked', value: false }],
    ['metric', { kind: 'metric-row', rows: 'rows', index: 0, field: 'valueField', value: 'delta' }],
    ['bar', { kind: 'series-label', index: 100, value: 'bad' }], ['pie', { kind: 'property', name: 'ring', value: '100%' }],
    ['table', { kind: 'table-column', indices: [0, 1], field: 'width', value: 0 }], ['table', { kind: 'table-column', indices: [0], field: 'title', value: 'group unsupported' }],
    ['table', { kind: 'table-column', indices: [0, 1], field: 'align', value: 'center' }]
  ];
  for (const [id, edit] of cases) expect(editProperty(draft, { sectionId: 's', componentId: id }, edit as PropertyEdit).ok).toBe(false);
  expect(draft).toEqual(before);
});
it('clearing an optional choice restores absence and a same-value operation changes nothing', () => {
  const result = apply('metric', { kind: 'property', name: 'showTrendArrows', value: undefined }); expect(result.props).not.toHaveProperty('showTrendArrows');
  const unchanged = apply('header', { kind: 'property', name: 'subtitle', value: '原副标题' }); expect(unchanged.result).toEqual(unchanged.original);
  expect(propertyControls(setup(), { sectionId: 's', componentId: 'line' }).map((item) => item.id)).not.toContain('stacked');
});
it('property edits preserve empty authoring sections outside the formal projection', () => {
  const draft = setup(); (draft.canvasDocument.sections as unknown[]).push({ id: 'empty', components: [] }); draft.authoringSections.push({ id: 'empty', componentIds: [] });
  const result = editProperty(draft, { sectionId: 's', componentId: 'header' }, { kind: 'property', name: 'subtitle', value: '更新' });
  expect(result.ok).toBe(true); if (!result.ok) return;
  expect(result.draft.authoringSections.at(-1)).toEqual({ id: 'empty', componentIds: [] }); expect(result.draft.pageDocument.sections).toHaveLength(1);
});
