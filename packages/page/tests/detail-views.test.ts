import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { validate } from '../src/validate';
import type { Page } from '../src/page';
const fixture = (): Page => JSON.parse(readFileSync(new URL('../fixtures/contract-valid/detail-views.json', import.meta.url), 'utf8'));
describe('detail view contract', () => {
  it('accepts declared view, required row binding and complete result table', () => expect(validate(fixture())).toEqual([]));
  it('validates column navigation bindings and rejects conflicting column actions', () => {
    const page = fixture();
    const component = page.sections[1].components[0];
    if (component.type !== 'table') throw new Error('fixture');
    const column = component.props.columns[0];
    if (column.kind === 'group') throw new Error('fixture');
    column.navigate = { href: '/customer', query: { id: { source: 'row', field: 'name' } } };
    expect(validate(page)).toEqual([]);
    column.navigate.query!.id = { source: 'row', field: 'missing' };
    expect(validate(page).some(error => error.message.includes('可传参'))).toBe(true);
    column.openDetail = { surface: 'modal', fields: [{ label: '客户', field: 'name' }] };
    expect(validate(page).some(error => error.message.includes('不得冲突'))).toBe(true);
  });
  it.each(['version', 'unknown-view', 'binding', 'recursive', 'visible-filter', 'window'])('rejects unsafe or incomplete view %s', kind => {
    const page = fixture();
    const component = page.sections[1].components[0];
    if (component.type !== 'table') throw new Error('fixture');
    if (kind === 'version') page.schemaVersion = '6.11';
    if (kind === 'unknown-view') page.detailViews![0].id = 'other';
    if (kind === 'binding') component.props.actions = [{ on: 'click', openDetail: { surface: 'drawer', view: 'trend' } }];
    if (kind === 'recursive') page.detailViews![0].components = [component];
    if (kind === 'visible-filter') page.filters![1].visible = true;
    const source = page.dataSources.detail;
    if (kind === 'window' && source.source.type === 'query') source.source.resultScope = undefined;
    expect(validate(page).length).toBeGreaterThan(0);
  });
});
