import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage } from '../src/validate';

function fixture(kind = 'query') { return JSON.parse(readFileSync(new URL(`../fixtures/contract-valid/table-row-expansion-${kind}.json`, import.meta.url), 'utf8')); }

describe('row expansion contract', () => {
  it.each(['query', 'inline'])('accepts the real %s example and clean defaults', kind => {
    const document = fixture(kind), parsed = parsePage(document);
    expect(parsed, JSON.stringify(parsed)).toMatchObject({ ok: true });
    const props = document.sections[0].components[0].props.rowExpansion.table;
    expect(props.title).toBeUndefined(); expect(props.toolbar).toBeUndefined();
    expect(props.columns.some((column: { sortable?: boolean }) => column.sortable)).toBe(false);
  });
  it.each(['version', 'parent-key', 'source-shared', 'missing-input', 'unbound-parent', 'complete', 'window', 'row-key-mapping', 'actions', 'recursive', 'export'] as const)('rejects %s', mode => {
    const doc = fixture(), parent = doc.sections[0].components[0], expansion = parent.props.rowExpansion;
    if (mode === 'version') doc.schemaVersion = '6.43';
    if (mode === 'parent-key') delete parent.props.rowKey;
    if (mode === 'source-shared') { const table = structuredClone(parent); table.id = 'shared'; table.data.main = 'orders-default'; delete table.props.rowExpansion; doc.sections[0].components.push(table); }
    if (mode === 'missing-input') expansion.data.bindings = {};
    if (mode === 'unbound-parent') expansion.data.bindings['customer-default'] = { source: 'filter', id: 'customer-optional' };
    if (mode === 'complete') doc.dataSources['orders-default'].source.resultScope = 'complete';
    if (mode === 'window') expansion.table.pagination = { mode: 'local', pageSize: 10 };
    if (mode === 'row-key-mapping') { doc.dataSources['orders-default'].compute = []; delete doc.dataSources['orders-default'].fields['order-id'].queryField; }
    if (mode === 'actions') expansion.table.columns[0].openDetail = { surface: 'drawer', fields: [{ label: '订单', field: 'order-id' }] };
    if (mode === 'recursive') expansion.table.rowExpansion = expansion;
    if (mode === 'export') parent.props.toolbar = { export: { format: 'xlsx' } };
    // Recursive shape is rejected structurally before walking the tree.
    if (mode === 'recursive') expansion.table.rowExpansion = structuredClone(fixture().sections[0].components[0].props.rowExpansion);
    expect(parsePage(doc).ok).toBe(false);
  });
  it('does not allow a scalar as a nested-list source or invalid child fields', () => {
    const doc = fixture('inline'); doc.sections[0].components[0].props.rowExpansion.data.field = 'amount';
    expect(parsePage(doc).ok).toBe(false);
    const missing = fixture('inline'); missing.sections[0].components[0].props.rowExpansion.table.columns[0].field = 'not-declared';
    expect(parsePage(missing).ok).toBe(false);
  });
});
