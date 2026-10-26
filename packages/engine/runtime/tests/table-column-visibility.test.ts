import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import type { TableComponent, TableQueryView } from '@metriccanvas/page/internal';
import { tableColumnPresentation } from '../src/table/column-presentation';
import type { FilterValues } from '../src/filter-state';
import { createTableSession } from '../src/table/session';
import { createTableController } from '../../runtime-ui/src/table/controller';
function fixture(): {
    page: Page;
    table: TableComponent;
} {
    const result = parsePage(JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/table-column-visibility.json', import.meta.url), 'utf8')));
    if (!result.ok)
        throw Error(JSON.stringify(result.errors));
    const table = result.page.sections[0].components[0];
    if (table.type !== 'table')
        throw Error('expected fixture table');
    return { page: result.page, table };
}
const filters = (value: string): FilterValues => new Map([['columns', { type: 'dimension', dimension: 'column-mode', values: [value] }]]);
const initial = (): TableQueryView => ({ pageIndex: 1, pageSize: 2, sort: [], predicates: [] });
it('projects recursive headers and compound search fields without mutating declarations', () => {
    const { page, table } = fixture(), before = structuredClone(page);
    const model = tableColumnPresentation(page, table, { declarations: page.filters!, filters: filters('summary') });
    expect(model.component.props.columns).toHaveLength(1);
    expect(model.search).toMatchObject({ fields: ['name', 'owner'] });
    expect(page).toEqual(before);
    const empty = tableColumnPresentation(page, table, { declarations: page.filters!, filters: filters('none') });
    expect(empty.component.props.columns).toEqual([]);
    expect(empty.component.props.toolbar).toBeUndefined();
});
it('atomically removes hidden user constraints, retains defaults and is idempotent', () => {
    const { page, table } = fixture();
    const changes: TableQueryView[] = [];
    const session = createTableSession({ ...initial(), sort: [{ field: 'amount', direction: 'desc' }] }, view => changes.push(view));
    const model = tableColumnPresentation(page, table, { declarations: page.filters!, filters: filters('summary') });
    session.reconcileColumns(model);
    expect(session.snapshot().sort).toEqual([{ field: 'amount', direction: 'desc' }]);
    expect(session.snapshot().pageIndex).toBe(1);
    session.setSort([{ field: 'project', direction: 'asc' }]);
    session.setHeaders({ amount: { mode: 'numberRange', from: 200 } });
    session.setSearch({ fields: ['name', 'project', 'owner'], query: '华南' });
    const count = changes.length;
    expect(session.reconcileColumns(model)).toBe(true);
    expect(changes).toHaveLength(count + 1);
    expect(session.snapshot()).toMatchObject({ pageIndex: 0, sort: [{ field: 'amount', direction: 'desc' }], predicates: [], search: { fields: ['name', 'owner'], query: '华南' } });
    expect(session.reconcileColumns(model)).toBe(false);
});
it('expands a surviving keyword when columns return but never resurrects a cleared search', () => {
    const { page, table } = fixture();
    let values = filters('full');
    const controller = createTableController(page, () => null, () => { }, () => values);
    controller.search(table, '华南');
    values = filters('summary');
    controller.syncColumns(table);
    expect(controller.view(table).search?.fields).toEqual(['name', 'owner']);
    values = filters('full');
    controller.syncColumns(table);
    expect(controller.view(table).search?.fields).toEqual(['name', 'project', 'owner']);
    values = filters('none');
    controller.syncColumns(table);
    expect(controller.view(table).search).toBeUndefined();
    values = filters('full');
    controller.syncColumns(table);
    expect(controller.view(table).search).toBeUndefined();
    controller.dispose();
});
it('clears invalid option and draft without submitting the old keyword against the fallback', () => {
    const { page } = fixture();
    const table = page.sections[1].components[0];
    if (table.type !== 'table')
        throw Error();
    let values = filters('full');
    const controller = createTableController(page, () => null, () => { }, () => values);
    controller.setSearchDraft(table, '华南项目');
    controller.search(table, '华南项目');
    expect(controller.view(table).search?.fields).toEqual(['project']);
    values = filters('summary');
    controller.syncColumns(table);
    expect(controller.searchOption(table)).toBe('name');
    expect(controller.searchDraft(table)).toBe('');
    expect(controller.view(table).search).toBeUndefined();
    values = filters('full');
    controller.syncColumns(table);
    expect(controller.searchOption(table)).toBe('name');
    controller.dispose();
});
it('keeps the page and request generation when an empty search only loses column metadata', () => {
    const { page, table } = fixture(), session = createTableSession(initial());
    session.setSearch({ fields: ['name', 'project'], query: '' });
    session.setPage(1);
    const generation = session.generation;
    const model = tableColumnPresentation(page, table, { declarations: page.filters!, filters: filters('summary') });
    expect(session.reconcileColumns(model)).toBe(false);
    expect(session.snapshot().pageIndex).toBe(1);
    expect(session.snapshot().search).toBeUndefined();
    expect(session.generation).toBe(generation);
});
