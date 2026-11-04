import { readFileSync } from 'node:fs';
import { columnBindingKey, parsePage, resolveDataSourceFields, type FieldBinding } from '@metriccanvas/page/internal';
import { describe, expect, it } from 'vitest';
import { buildTableColumnLayout } from '../src/components/table/columns';
import { alignTableRows, alignedFieldValue } from '../src/components/table/rows';
import type { NamedDataSlots } from '../src/shared/component-data';

function multislotFixture() {
  const parsed = parsePage(JSON.parse(readFileSync(new URL('../../../../pages/capabilities/authoring/relay-multislot-presentation/relay-multislot-presentation.json', import.meta.url), 'utf8')));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const component = parsed.page.sections[0].components[0];
  if (component.type !== 'table') throw new Error('expected table');
  const data: NamedDataSlots = {};
  for (const [slot, sourceId] of Object.entries(component.data)) {
    const source = parsed.page.dataSources[sourceId];
    if (source.source.type !== 'inline') throw new Error('expected inline');
    data[slot] = { fields: resolveDataSourceFields(source), snapshot: { status: 'ready', rows: source.source.rows } };
  }
  return { data, props: component.props };
}

describe('table column binding identity', () => {
  it('renders legal same-name fields from actual main/prior slots with distinct identities and aligned values', () => {
    const { data, props } = multislotFixture();
    const { leaves } = buildTableColumnLayout(props.columns);
    expect(leaves.map(column => columnBindingKey(column.field))).toEqual([
      '["main","region"]', '["main","amount"]', '["prior","amount"]'
    ]);
    const rows = alignTableRows(data, props.rowKey);
    expect(rows.map(row => leaves.map(column => alignedFieldValue(column.field, data, row)))).toEqual([
      ['a', 2000000, undefined], ['b', 3000000, 1000000]
    ]);
  });

  it('normalizes main shorthand and presentation overrides without losing data slot identity', () => {
    expect(columnBindingKey('amount')).toBe(columnBindingKey({ data: 'main', field: 'amount', format: 'number-1' }));
    expect(columnBindingKey({ data: 'prior', field: 'amount' })).not.toBe(columnBindingKey('amount'));
    expect(columnBindingKey({ data: 'a:b', field: 'c' })).not.toBe(columnBindingKey({ data: 'a', field: 'b:c' }));
  });

  it('keeps byFilter case identity stable across object order while distinguishing slot, case and filter', () => {
    const binding: FieldBinding = { byFilter: { filterId: 'period', cases: {
      current: 'amount', previous: { data: 'prior', field: 'amount' }
    } } };
    const reordered: FieldBinding = { byFilter: { cases: {
      previous: { field: 'amount', data: 'prior' }, current: { data: 'main', field: 'amount' }
    }, filterId: 'period' } };
    expect(columnBindingKey(binding)).toBe(columnBindingKey(reordered));
    expect(columnBindingKey(binding)).not.toBe(columnBindingKey({ byFilter: { ...binding.byFilter, filterId: 'other' } }));
    expect(columnBindingKey(binding)).not.toBe(columnBindingKey({ byFilter: { filterId: 'period', cases: { current: 'amount', previous: 'amount' } } }));
    expect(columnBindingKey(binding)).not.toBe(columnBindingKey({ byFilter: { filterId: 'period', cases: { future: 'amount', previous: { data: 'prior', field: 'amount' } } } }));
  });
});
