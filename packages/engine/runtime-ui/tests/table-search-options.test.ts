import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import type { TableComponent } from '@metriccanvas/page/internal';
import { createTableController } from '../src/table/controller';
import { prepareTableExport } from '../src/table/export/prepare';
import { orchestrate, type PageDataSnapshots } from '../../runtime/src/orchestrator';

function fixture() {
  const result = parsePage(JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/table-search-options-demo.json', import.meta.url), 'utf8')));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.page;
}
it('uses the first static option when no explicit default is configured', () => {
  const page = fixture(), table = page.sections[0].components[0] as TableComponent;
  const search = table.props.toolbar!.search!;
  if (!('options' in search)) throw new Error('Expected options');
  delete search.defaultValue;
  const controller = createTableController(page, () => null, () => {});
  expect(controller.searchOption(table)).toBe('code');
  controller.search(table, '00123');
  expect(controller.view(table).search).toEqual({ fields: ['code'], query: '00123', match: 'equals' });
  controller.dispose();
});
it('blocks option changes and search submission through a disabled toolbar binding', () => {
  const page = fixture(), table = page.sections[0].components[0] as TableComponent;
  const controller = createTableController(page, () => null, () => {});
  const binding = controller.binding(table, { filterOptions: {}, oncellselect() {}, toolbarEnabled: { search: false, export: true } });
  binding.onsearchoption?.('code');
  binding.onsearchdraft?.('00123');
  binding.onsearch?.('00123');
  expect(controller.searchOption(table)).toBe('name');
  expect(controller.searchDraft(table)).toBe('');
  expect(controller.view(table).search).toBeUndefined();
  controller.dispose();
});
it('switches using the current draft, keeps instance state isolated and clears without resetting the option', async () => {
  const page = fixture(), table = page.sections[0].components[0] as TableComponent;
  const controller = createTableController(page, () => null, () => {});
  expect(controller.searchOption(table)).toBe('name');
  controller.page(table, 2);
  controller.sort(table, [{ field: 'amount', direction: 'desc' }]);
  controller.header(table, 'owner', { mode: 'select', values: ['张三'] });
  controller.setSearchDraft(table, '00123');
  controller.selectSearchOption(table, 'code');
  expect(controller.view(table)).toMatchObject({ pageIndex: 0, sort: [{ field: 'amount', direction: 'desc' }],
    predicates: [{ field: 'owner', op: 'in', values: ['张三'] }], search: { fields: ['code'], query: '00123', match: 'equals' } });
  const source = page.dataSources.records;
  if (source.source.type !== 'inline') throw new Error('Expected inline fixture');
  expect(controller.present(table, source.source.rows, true).rows.map(row => row.code)).toEqual(['00123']);
  const before = controller.view(table);
  controller.setSearchDraft(table, 'not-submitted');
  const data = await prepareTableExport({ page, component: table, queries: new Map(), controller: new AbortController(),
    state: { currentYear: 2026, filters: new Map(), tables: { [table.id]: controller.render(table) },
      headerFilters: { [table.id]: controller.headers(table) } },
    gateway: { async fetchData() { throw new Error('Inline export must not fetch'); } } });
  expect(data.main?.snapshot.rows.map(row => row.code)).toEqual(['00123']);
  controller.selectSearchOption(table, 'missing');
  expect(controller.view(table)).toEqual(before);
  const other = { ...table, id: 'another' };
  expect(controller.searchOption(other)).toBe('name');
  expect(controller.searchDraft(other)).toBe('');
  controller.search(table, '');
  expect(controller.searchOption(table)).toBe('code');
  expect(controller.present(table, source.source.rows, true).rows.every(row => row.owner === '张三')).toBe(true);
  controller.dispose();
});

it.each([true, false])('keeps the newest selected field after a late response (pagination=%s)', async paginated => {
  const page = fixture(), table = page.sections[0].components[1] as TableComponent;
  if (!paginated) {
    delete table.props.pagination;
    const source = page.dataSources.queried;
    if (source.source.type === 'query' && source.source.query.body) delete source.source.query.body.dsl_list[0].order;
  }
  let snapshots: PageDataSnapshots = new Map();
  let completeOld: ((value: { rows: Array<{ code: string; name: string; owner: string; amount: number }>; totalCount: number }) => void) | undefined;
  const row = { code: '00123', name: '星河项目', owner: '张三', amount: 100 };
  const calls: string[] = [];
  const stream = orchestrate(page, { async fetchData(query) {
    const field = query.search?.queryFields[0] ?? 'initial'; calls.push(field);
    if (field === 'search_demo_name') return new Promise(resolve => { completeOld = resolve; });
    return { rows: [row], totalCount: 1 };
  } });
  const dispose = stream.subscribe(next => { snapshots = next; });
  const controller = createTableController(page, () => stream, () => {});
  await vi.waitFor(() => expect(snapshots.get('queried')?.status).toBe('ready'));
  controller.search(table, '星河项目');
  await vi.waitFor(() => expect(completeOld).toBeDefined());
  controller.setSearchDraft(table, '00123');
  controller.selectSearchOption(table, 'code');
  await vi.waitFor(() => expect(stream.captureQueries().get('queried')?.search).toEqual({ queryFields: ['search_demo_code'], query: '00123', match: 'equals' }));
  completeOld!({ rows: [{ ...row, code: 'stale' }], totalCount: 1 });
  await vi.waitFor(() => expect(snapshots.get('queried')).toMatchObject({ status: 'ready', rows: [row] }));
  expect(calls).toContain('search_demo_code');
  controller.dispose(); dispose();
});
