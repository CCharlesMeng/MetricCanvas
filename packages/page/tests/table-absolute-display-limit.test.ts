import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';
import { requiredMinorVersion } from '../src/version';
const sample = () => JSON.parse(readFileSync('pages/capabilities/table/table-absolute-display-limit.json', 'utf8'));
const path = '/sections/0/components/0/props/columns/2/children/0/absoluteDisplayLimit';
it('accepts the agreed single-field declaration without modifying authored values', () => {
  const page = sample(), before = structuredClone(page);
  expect(page.sections[0].components[0].props.columns[2].children[0].absoluteDisplayLimit).toBe(500);
  expect(parsePage(page).ok).toBe(true);
  expect(requiredMinorVersion(page)).toBe(119);
  expect(page).toEqual(before);
});
it.each([0, -1, '500', null, true, {}, Infinity, NaN])('rejects invalid limits %j at the column', limit => {
  const page = sample(); page.sections[0].components[0].props.columns[2].children[0].absoluteDisplayLimit = limit;
  const result = parsePage(page);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ path }));
});
it('rejects nonnumeric columns and preserves the old arrow diagnostic', () => {
  const page = sample();
  page.sections[0].components[0].props.columns[0].absoluteDisplayLimit = 500;
  const result = parsePage(page);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ path: '/sections/0/components/0/props/columns/0/absoluteDisplayLimit', message: 'absoluteDisplayLimit 只支持 number 或 money 字段' }));
});
it.each(['6.118', '5.4'])('gates the new field in %s, including nested groups', version => {
  const page = sample(); page.schemaVersion = version;
  const result = parsePage(page);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ path }));
});
it('supports money and optional omission in historical pages', () => {
  const page = sample(); page.dataSources.sample.fields.change = { type: 'money', role: 'measure', currency: 'CNY', nullable: true };
  expect(parsePage(page).ok).toBe(true);
  page.schemaVersion = '6.118';
  delete page.sections[0].components[0].props.columns[2].children[0].absoluteDisplayLimit;
  delete page.sections[1].components[0].props.columns[1].absoluteDisplayLimit;
  expect(parsePage(page).ok).toBe(true);
});
it('validates limits and version boundaries in expanded child tables', () => {
  const page = JSON.parse(readFileSync('packages/page/fixtures/contract-valid/table-row-expansion-inline.json', 'utf8'));
  const columns = page.sections[0].components.find((component: { type: string }) => component.type === 'table').props.rowExpansion.table.columns;
  const column = columns.find((column: { field: string | { field: string } }) => typeof column.field === 'object' && column.field.field === 'amount');
  column.absoluteDisplayLimit = 500;
  page.schemaVersion = '6.119'; expect(parsePage(page).ok).toBe(true);
  column.absoluteDisplayLimit = -1; expect(parsePage(page).ok).toBe(false);
  column.absoluteDisplayLimit = 500; page.schemaVersion = '6.118';
  const result = parsePage(page); expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.some(error => error.path.endsWith('/absoluteDisplayLimit'))).toBe(true);
});
