import { readFileSync } from 'node:fs';

function fixture(name: string) {
  return JSON.parse(readFileSync(new URL(`../../fixtures/contract-valid/${name}.json`, import.meta.url), 'utf8'));
}
function invalidQueryExpansion() {
  const page = fixture('table-row-expansion-query');
  const table = page.sections[0].components[0], expansion = table.props.rowExpansion;
  delete table.props.rowKey;
  table.props.mergeBy = ['customer-id'];
  table.props.toolbar = { export: { format: 'xlsx' } };
  expansion.data.bindings = { unknown: { source: 'filter', id: 'missing' } };
  expansion.table.pagination = { mode: 'local', pageSize: 10 };
  expansion.table.columns[0].filterable = true;
  page.dataSources[expansion.data.source].source.resultScope = 'complete';
  return page;
}
function sharedExpansionInputs() {
  const page = fixture('table-row-expansion-query');
  const parent = page.sections[0].components[0];
  const duplicate = structuredClone(parent);
  duplicate.id = 'shared-parent';
  page.sections[0].components.push(duplicate);
  page.detailViews = [{ id: 'detail', title: '详情', components: [structuredClone(parent)] }];
  return page;
}
function invalidInlineExpansion() {
  const page = fixture('table-row-expansion-inline');
  const table = page.sections[0].components[0];
  table.props.rowExpansion.data.field = 'amount';
  table.props.rowExpansion.table.pagination = { mode: 'query', pageSize: 10 };
  page.dataSources[table.data.main].source.rows[1][table.props.rowKey] = page.dataSources[table.data.main].source.rows[0][table.props.rowKey];
  return page;
}
function invalidPolicyPage() {
  const page = fixture('table-row-expansion-query');
  const table = page.sections[0].components[0];
  table.visibleWhen = { filter: 'missing', test: 'eq', value: true };
  table.props.rowVisibleWhen = { row: 'amount', test: 'eq', value: 'bad-type' };
  table.props.actions = [{ id: 'select', label: '选择', writeFilter: 'missing', field: 'customer-id' }];
  delete table.props.rowKey;
  page.sections[0].components.push({ id: 'text', type: 'text', layout: { span: 12 }, props: {
    body: 'conflict', parts: [{ id: 'part', body: 'one' }, { id: 'part', body: 'two' }],
  } });
  page.sections[0].components.push({ id: 'button', type: 'button', layout: { span: 12 }, props: {
    label: '详情', action: { openDetail: { view: 'missing' } },
  } });
  return page;
}

/** Mutations exercise simultaneous errors through the public validation entry points. */
export function hotspotCases() {
  return {
    query: fixture('table-row-expansion-query'), inline: fixture('table-row-expansion-inline'),
    hierarchy: fixture('table-hierarchy-selection'),
    invalidQuery: invalidQueryExpansion(), shared: sharedExpansionInputs(),
    invalidInline: invalidInlineExpansion(), policies: invalidPolicyPage(),
  };
}
