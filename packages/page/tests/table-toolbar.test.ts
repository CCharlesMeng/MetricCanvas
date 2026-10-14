import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';
const fixture = () => JSON.parse(readFileSync(new URL('../fixtures/contract-valid/table-toolbar-page.json', import.meta.url), 'utf8'));
it('supports independent toolbar controls and rejects older schema versions', () => {
  const page = fixture(); expect(parsePage(page).ok).toBe(true);
  delete page.sections[0].components[0].props.toolbar.export;
  expect(parsePage(page).ok).toBe(true);
  page.schemaVersion = '6.20'; expect(parsePage(page).ok).toBe(false);
});
it.each([{ fields: ['value'] }, { fields: ['unknown'] }, { fields: ['name', 'name'] }])('rejects invalid search fields: %j', ({ fields }) => {
  const page = fixture(); page.sections[0].components[0].props.toolbar.search.fields = fields;
  expect(parsePage(page).ok).toBe(false);
});
it('rejects a shared query source for independently searched tables', () => {
  const page = fixture();
  page.dataSources.records.fields.name.queryField = '客户'; page.dataSources.records.fields.value.queryField = '金额';
  page.dataSources.records.source = { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['客户'], output_metrics: ['金额'] }] } } };
  delete page.sections[0].components[0].props.pagination;
  expect(parsePage(page).ok).toBe(true);
  const second = structuredClone(page.sections[0].components[0]); second.id = 'another-table'; page.sections[0].components.push(second);
  const result = parsePage(page); expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.some(error => error.message.includes('独占'))).toBe(true);
});
