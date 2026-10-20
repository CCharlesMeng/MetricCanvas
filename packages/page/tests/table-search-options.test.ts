import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';
const fixture = () => JSON.parse(readFileSync(new URL('../fixtures/contract-valid/table-search-options-page.json', import.meta.url), 'utf8'));
const search = (page: ReturnType<typeof fixture>) => page.sections[0].components[0].props.toolbar.search;

it('accepts static options and gates the capability at 6.42', () => {
  const page = fixture();
  expect(parsePage(page).ok).toBe(true);
  page.schemaVersion = '6.41';
  expect(parsePage(page).ok).toBe(false);
});
it('retains toolbar conditions and rejects the legacy-version bypass for static search options', () => {
  const page = fixture();
  search(page).enabledWhen = { permission: 'search' };
  search(page).visibleWhen = { permission: 'visible' };
  expect(parsePage(page).ok).toBe(true);
  page.schemaVersion = '5.4';
  expect(parsePage(page).ok).toBe(false);
});
it.each(['empty', 'duplicate', 'default', 'numeric', 'missing', 'both', 'operator'])('rejects malformed option configuration: %s', kind => {
  const page = fixture(), config = search(page);
  if (kind === 'empty') config.options = [];
  if (kind === 'duplicate') config.options[1].value = config.options[0].value;
  if (kind === 'default') config.defaultValue = 'missing';
  if (kind === 'numeric') config.options[1].field = 'amount';
  if (kind === 'missing') config.options[1].field = 'missing';
  if (kind === 'both') config.fields = ['name'];
  if (kind === 'operator') config.options[1].match = 'contains';
  expect(parsePage(page).ok).toBe(false);
});
it('validates query mappings for every option, including non-default ones', () => {
  const page = fixture();
  delete page.dataSources.queried.fields.owner.queryField;
  expect(parsePage(page).ok).toBe(false);
});

it('gates equality in serialized joined views and validates its single-field invariant', () => {
  const page = JSON.parse(readFileSync(new URL('../fixtures/contract-valid/paged-join-page.json', import.meta.url), 'utf8'));
  page.schemaVersion = '6.42';
  const source = page.dataSources['office-overview'].source;
  source.initial = { capturedAt: '2026-10-20T00:00:00Z', rows: [], totalCount: 0,
    view: { pageIndex: 0, pageSize: source.pagination.pageSize, sort: source.ordering.default, predicates: [],
      search: { fields: ['rep-office-name'], query: '', match: 'equals' } } };
  expect(parsePage(page).ok).toBe(true);
  page.schemaVersion = '6.41';
  expect(parsePage(page).ok).toBe(false);
  page.schemaVersion = '6.42';
  source.initial.view.search.fields.push('rep-office-code');
  const result = parsePage(page);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.some(error => error.message === '等值搜索只允许一个字段')).toBe(true);
});
