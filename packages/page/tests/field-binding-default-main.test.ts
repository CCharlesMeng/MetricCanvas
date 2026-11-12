import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, normalizePageDocument } from '../src/validate';
import { defaultMainBindingPaths, materializeMainBindingSlots } from '../src/field-binding-defaults';
import { resolveField } from '../src/field-resolution';
import { fieldSlot, staticFieldBinding } from '../src/field';
import { mainColumnField, columnBindingKey } from '../src/table/columns';
import { fieldReferenceZ, staticFieldBindingZ } from '../src/schema/primitives';
import currencyPage from '../fixtures/contract-valid/currency-selection-page.json';

function document() {
  const scene = JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/number-precision-five.json', import.meta.url), 'utf8'));
  const { params: _params, ...focused } = scene;
  return { ...focused, sections: [scene.sections.at(-1)] };
}
function accepted(input: unknown) {
  const parsed = parsePage(input);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.page;
}
const fieldPath = '/sections/0/components/0/props/columns/1/field';

describe('object field bindings default to main', () => {
  it('materializes declared bindings without mutating or expanding persisted input', () => {
    const input = document(), before = structuredClone(input);
    const page = accepted(input);
    expect(input).toEqual(before);
    expect(defaultMainBindingPaths(input)).toHaveLength(5);
    expect(defaultMainBindingPaths(page)).toEqual([]);
    const normalized = normalizePageDocument(input);
    expect(normalized.ok && normalized.document).toEqual(input);
    expect(input.sections[0].components[0].props.columns[1].field).toEqual({ field: 'change', format: 'number-2-signed' });
  });

  it('resolves omitted and explicit main identically, including direct typed callers', () => {
    const slots = { main: document().dataSources['binding-samples'], extra: document().dataSources['binding-supplement'] };
    const omitted = { field: 'change', format: 'number-2-signed' } as const;
    expect(resolveField(omitted, slots)).toEqual(resolveField({ ...omitted, data: 'main' }, slots));
    expect(resolveField(omitted, slots).data).toBe('main');
    expect(resolveField({ ...omitted, data: 'extra' }, slots).data).toBe('extra');
    expect(mainColumnField(omitted)).toBe('change');
    expect(columnBindingKey(omitted)).toBe(columnBindingKey('change'));
    expect(fieldSlot(omitted)).toBe('main');
    expect(staticFieldBindingZ.safeParse(omitted).success).toBe(true);
    expect(staticFieldBinding(omitted)).toEqual({ ...omitted, data: 'main' });
    expect(fieldReferenceZ.safeParse({ field: 'change' }).success).toBe(false);
  });

  it.each(['6.113', '6.114', '6.115', '5.4'])('rejects the new declaration in %s at the binding path', schemaVersion => {
    const input = document(); input.schemaVersion = schemaVersion;
    const result = parsePage(input);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ path: fieldPath, message: expect.stringContaining('由 6.116 引入') }));
  });

  it('keeps old explicit declarations valid and produces identical runtime pages', () => {
    const concise = document(), explicit = structuredClone(concise);
    materializeMainBindingSlots(explicit);
    expect(accepted(concise)).toEqual(accepted(explicit));
    explicit.schemaVersion = '6.113';
    accepted(explicit);
  });

  it.each([null, '', 'unknown-slot'])('rejects explicit invalid slots instead of defaulting: %s', data => {
    const input = document(); input.sections[0].components[0].props.columns[1].field.data = data;
    const result = parsePage(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some(error => error.path.startsWith(fieldPath))).toBe(true);
  });

  it('never infers another slot when the field is absent from main', () => {
    const input = document();
    delete input.dataSources['binding-samples'].fields.change;
    const explicit = structuredClone(input); materializeMainBindingSlots(explicit);
    expect(parsePage(input)).toEqual(parsePage(explicit));
    expect(parsePage(input).errors).toContainEqual(expect.objectContaining({ message: expect.stringContaining('不在数据槽 main') }));
  });

  it('does not rewrite source rows, navigation field references or arbitrary ECharts options', () => {
    const input = document();
    input.dataSources['binding-samples'].source.rows[0].payload = { field: 'change' };
    input.sections[0].components[3].props.echartsOption = { custom: { field: 'change' } };
    input.sections[0].components[0].props.columns[0].selection = { writes: { region: { field: 'name' } } };
    const before = structuredClone(input); materializeMainBindingSlots(input);
    expect(input.dataSources).toEqual(before.dataSources);
    expect(input.sections[0].components[3].props.echartsOption).toEqual(before.sections[0].components[3].props.echartsOption);
    expect(input.sections[0].components[0].props.columns[0].selection).toEqual(before.sections[0].components[0].props.columns[0].selection);
  });

  it('covers byFilter cases while preserving applied currency selection', () => {
    const input = structuredClone(currencyPage); input.schemaVersion = '6.116';
    function omitMain(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      if ('data' in value && value.data === 'main' && 'field' in value) delete value.data;
      Object.values(value).forEach(omitMain);
    }
    omitMain(input);
    expect(defaultMainBindingPaths(input).some(path => path.includes('/byFilter/cases/'))).toBe(true);
    const explicit = structuredClone(input); materializeMainBindingSlots(explicit);
    expect(accepted(input)).toEqual(accepted(explicit));
  });

  it('finds bindings in inactive Tabs, detail views, grouped columns and child tables', () => {
    const table = structuredClone(document().sections[0].components[0]);
    table.props.columns = [{ kind: 'group', id: 'group', title: '组', children: [{ field: { field: 'change' }, secondaryField: { field: 'name' }, pinnedTop: { field: { field: 'change' } } }] }];
    table.props.rowExpansion = { table: { columns: [{ field: { field: 'change' } }] } };
    const input = { sections: [{ components: [{ type: 'tabContainer', props: { tabs: [{ id: 'inactive', component: table }] } }] }], detailViews: [{ components: [structuredClone(table)] }] };
    expect(defaultMainBindingPaths(input)).toHaveLength(8);
    materializeMainBindingSlots(input);
    expect(defaultMainBindingPaths(input)).toEqual([]);
  });
});
