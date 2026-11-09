import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';
import { requiredMinorVersion } from '../src/version';

const sample = () => JSON.parse(readFileSync('pages/capabilities/table/table-trend-arrows.json', 'utf8'));
const path = '/sections/0/components/0/props/columns/1/children/0/arrowRule';

it('accepts independent arrows, colors and units without mutating the authored page', () => {
  const page = sample(), before = structuredClone(page);
  const parsed = parsePage(page);
  expect(parsed.ok ? [] : parsed.errors).toEqual([]);
  expect(requiredMinorVersion(page)).toBe(99);
  expect(page).toEqual(before);
});
it('allows arrows for money fields', () => {
  const page = sample();
  page.dataSources.sample.fields.growth = { type: 'money', role: 'measure', currency: 'CNY', nullable: true };
  expect(parsePage(page).ok).toBe(true);
});

it.each(['before', 'after'])('accepts %s in both arrow rule modes without changing authored input', position => {
  const page = sample(), columns = page.sections[0].components[0].props.columns;
  columns[1].children[0].arrowRule.position = position;
  columns[2].arrowRule.position = position;
  const before = structuredClone(page);
  expect(parsePage(page).ok).toBe(true);
  expect(page).toEqual(before);
});

it.each(['left', '', null, 1])('rejects invalid arrow positions %j in both modes', position => {
  for (const rule of [{ mode: 'fixed', arrow: 'up' }, { mode: 'sign', positive: 'down', negative: 'up' }]) {
    const page = sample();
    page.sections[0].components[0].props.columns[1].children[0].arrowRule = { ...rule, position };
    const parsed = parsePage(page);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors).toContainEqual(expect.objectContaining({ path: path + '/position' }));
  }
});

it.each(['6.97', '6.98', '5.4'])('rejects arrow declarations in %s at the nested column', version => {
  const page = sample(); page.schemaVersion = version;
  const parsed = parsePage(page);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.errors).toContainEqual(expect.objectContaining({ path }));
});

it.each(['yes', null, 1, true, false, {}, { mode: 'sign', positive: 'up' }, { mode: 'sign', positive: 'up', negative: 'left' }, { mode: 'fixed' }, { mode: 'fixed', arrow: 'up', positive: 'down' }])('rejects invalid arrow rules %j', setting => {
  const page = sample(); page.sections[0].components[0].props.columns[1].children[0].arrowRule = setting;
  const parsed = parsePage(page);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.errors).toContainEqual(expect.objectContaining({ path }));
});

it.each([{ mode: 'sign', positive: 'down', negative: 'up' }, { mode: 'fixed', arrow: 'none' }])('rejects arrows on a text field with %j', rule => {
  const page = sample(); page.sections[0].components[0].props.columns[0].arrowRule = rule;
  const parsed = parsePage(page);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.errors).toContainEqual(expect.objectContaining({ path: path.replace('1/children/0', '0'), message: 'arrowRule 只支持 number 或 money 字段' }));
});

it('retains old pages when rules are omitted and gates explicitly hidden rules', () => {
  const page = sample(); page.schemaVersion = '6.94';
  for (const section of page.sections) for (const table of section.components) {
    for (const column of table.props.columns) {
      delete column.arrowRule;
      for (const child of column.children ?? []) delete child.arrowRule;
    }
  }
  expect(parsePage(page).ok).toBe(true);
  page.sections[0].components[0].props.columns[1].children[0].arrowRule = { mode: 'fixed', arrow: 'none' };
  const parsed = parsePage(page);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.errors).toContainEqual(expect.objectContaining({ path }));
});

it('validates expanded child columns and enforces their version boundary', () => {
  const page = JSON.parse(readFileSync('packages/page/fixtures/contract-valid/table-row-expansion-inline.json', 'utf8'));
  const table = page.sections[0].components.find((component: { type: string }) => component.type === 'table');
  const columns = table.props.rowExpansion.table.columns;
  const index = columns.findIndex((column: { field: string | { field: string } }) => typeof column.field === 'object' && column.field.field === 'amount');
  columns[index].arrowRule = { mode: 'sign', positive: 'down', negative: 'up' };
  page.schemaVersion = '6.99';
  expect(parsePage(page).ok).toBe(true);
  page.schemaVersion = '6.98';
  const parsed = parsePage(page);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.errors.some(error => error.path.endsWith(`/props/rowExpansion/table/columns/${index}/arrowRule`))).toBe(true);
});

it('rejects the discarded table boolean switch', () => {
  const page = sample();
  page.sections[0].components[0].props.columns[1].children[0].showTrendArrows = true;
  const parsed = parsePage(page);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.errors).toContainEqual(expect.objectContaining({ path: path.replace('/arrowRule', '/showTrendArrows') }));
});
