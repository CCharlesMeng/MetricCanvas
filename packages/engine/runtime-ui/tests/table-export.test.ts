import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parsePage } from '@metriccanvas/page';
import type { EffectiveQuery, TableComponent } from '@metriccanvas/page/internal';
import { encodeTableWorkbook } from '../src/table-workbook';
import { prepareTableExport } from '../src/table-export';
import { searchTableRows } from '../src/table-search';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';

it('matches case-insensitive literal text across fields before pagination', () => {
  const rows = [{ name: 'first', city: '深圳' }, { name: 'Test%_A', city: '上海' }];
  expect(searchTableRows(rows, ['name', 'city'], 'test%_')).toEqual([rows[1]]);
  expect(searchTableRows(rows, ['name', 'city'], '深圳')).toEqual([rows[0]]);
});
it('exports all matched rows without querying unrelated sources and freezes submitted search', async () => {
  const input = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/table-toolbar-page.json', import.meta.url), 'utf8'));
  input.dataSources.unrelated = structuredClone(input.dataSources.records);
  const parsed = parsePage(input); if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const page = parsed.page; const component = page.sections[0].components[0] as TableComponent;
  const state = { currentYear: 2026, filters: new Map(), tables: { [component.id]: { pageIndex: 2, sort: [{ field: 'value', direction: 'desc' as const }], headerFilters: {}, searchQuery: '客户2' } }, headerFilters: {} };
  const promise = prepareTableExport({ page, component, state, queries: new Map(), controller: new AbortController(), gateway: { async fetchData() { throw new Error('inline sources must not fetch'); } } });
  state.tables[component.id].searchQuery = '客户1';
  const data = await promise;
  expect(data.main?.snapshot.rows.map(row => row.name)).toEqual(['客户25', '客户24', '客户23', '客户22', '客户21', '客户20', '客户2']);
  const bytes = await encodeTableWorkbook(component, data, new AbortController().signal);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes.buffer);
  expect(workbook.worksheets[0].rowCount).toBe(8); expect(workbook.worksheets[0].getCell('B2').value).toBe(25);
});
it('preserves multi-level headers, aligned secondary slots, raw numeric scales and literal formula text', async () => {
  const component: TableComponent = { id: 'complex', type: 'table', layout: { span: 12 }, data: { main: 'main', extra: 'extra' }, props: { rowKey: 'id', columns: [
    { field: 'id', title: '编码' }, { kind: 'group', id: 'group', title: '指标', children: [ { field: { data: 'main', field: 'amount', format: 'compact-wan-1' }, title: '金额' }, { field: { data: 'extra', field: 'score' }, secondaryField: 'note', title: '评分' } ] }
  ] } };
  const data: NamedDataSlots = { main: { fields: { id: { type: 'string', role: 'dimension' }, amount: { type: 'number', role: 'measure' }, note: { type: 'string', role: 'dimension' } }, snapshot: { status: 'ready', rows: [{ id: 'A', amount: 25000, note: '=HYPERLINK("x")' }, { id: 'B', amount: 0, note: 'ok' }] } }, extra: { fields: { score: { type: 'number', role: 'measure' } }, snapshot: { status: 'ready', rows: [{ id: 'B', score: 22 }, { id: 'A', score: 11 }] } } };
  const bytes = await encodeTableWorkbook(component, data, new AbortController().signal);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes.buffer); const sheet = workbook.worksheets[0];
  expect(sheet.getCell('A1').value).toBe('编码'); expect(sheet.getCell('B1').value).toBe('指标');
  expect(sheet.getCell('B4').value).toBe(25000); expect(sheet.getCell('B4').numFmt).toBe('"2.5万"');
  expect(sheet.getCell('C4').value).toBe(11); expect(sheet.getCell('C5').value).toBe(22);
  expect(sheet.getCell('D4').value).toBe('=HYPERLINK("x")');
});
it('completes a paginated table export across all pages and rejects changing totals', async () => {
  const input = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/table-toolbar-page.json', import.meta.url), 'utf8'));
  const rows = input.dataSources.records.source.rows;
  input.dataSources.records.fields.name.queryField = 'name'; input.dataSources.records.fields.value.queryField = 'value';
  input.dataSources.records.source = { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['name'], output_metrics: ['value'], order: { offset: 0, limit: 10 } }] } } };
  input.sections[0].components[0].props.pagination = { mode: 'query' };
  const parsed = parsePage(input); if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors)); const page = parsed.page;
  const component = page.sections[0].components[0] as TableComponent;
  const query: EffectiveQuery = { language: 'dqe', body: { dsl_list: [{}] }, fieldMappings: page.dataSources.records.fields, pagination: { offset: 20, limit: 10 }, filterValues: [] };
  const state = { currentYear: 2026, filters: new Map(), tables: {}, headerFilters: {} };
  const calls: number[] = [];
  const run = (changing = false) => prepareTableExport({ page, component, state, queries: new Map([['records', query]]), controller: new AbortController(), gateway: { async fetchData(query) {
    const offset = query.pagination!.offset; calls.push(offset); return { rows: rows.slice(offset, offset + 10), totalCount: changing && offset ? 24 : 25 };
  } } });
  expect((await run()).main!.snapshot.rows).toHaveLength(25); expect(calls).toEqual([0, 10, 20]);
  await expect(run(true)).rejects.toMatchObject({ code: 'EXPORT_INCOMPLETE_DATA' });
});
it('preserves an upstream page window and executes only the selected table dependency chain', async () => {
  const input = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/query-result-page-window-page.json', import.meta.url), 'utf8'));
  const parsed = parsePage(input); if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors)); const page = parsed.page;
  const component = page.sections.flatMap(section => section.components).find(component => component.id === 'details-high-table') as TableComponent;
  const queries = new Map<string, EffectiveQuery>();
  for (const [id, source] of Object.entries(page.dataSources)) if (source.source.type === 'query') queries.set(id, {
    language: 'dqe', body: source.source.query.body!, fieldMappings: source.fields, filterValues: [],
    ...(id === 'projects' ? { pagination: { offset: 10, limit: 5 } } : {})
  });
  const calls: string[] = [];
  const data = await prepareTableExport({ page, component, queries, controller: new AbortController(),
    state: { currentYear: 2026, filters: new Map(), tables: {}, headerFilters: {} }, gateway: { async fetchData(query, context) {
      const id = context!.dataSourceIds![0]; calls.push(id);
      if (id === 'projects') {
        expect(query.pagination).toEqual({ offset: 10, limit: 5 });
        return { rows: [{ 'project-id': 'A', status: '进行中', enabled: false, amount: 4000000, duration: 1, day: '2026-10-01', at: '2026-10-01T00:00:00Z', 'project-name': 'A' }], totalCount: 40 };
      }
      expect(query.filterValues).toContainEqual({ target: 'dimension', queryField: '项目编号', values: ['A'] });
      return { rows: [{ 'project-id': 'A', score: 1, 'project-name': 'A', amount: 4000000 }], totalCount: 1 };
    } } });
  expect(calls).toEqual(['projects', 'details-high']); expect(data.main!.snapshot.rows[0]['project-id']).toBe('A');
});
it('cancels preparation even when a gateway ignores the abort signal', async () => {
  const input = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/table-toolbar-page.json', import.meta.url), 'utf8'));
  input.dataSources.records.fields.name.queryField = 'name'; input.dataSources.records.fields.value.queryField = 'value';
  input.dataSources.records.source = { type: 'query', resultScope: 'complete', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['name'], output_metrics: ['value'] }] } } };
  const parsed = parsePage(input); if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const controller = new AbortController();
  const promise = prepareTableExport({ page: parsed.page, component: parsed.page.sections[0].components[0] as TableComponent,
    queries: new Map([['records', { language: 'dqe', body: { dsl_list: [{}] }, fieldMappings: parsed.page.dataSources.records.fields, filterValues: [] }]]),
    controller, state: { currentYear: 2026, filters: new Map(), tables: {}, headerFilters: {} }, gateway: { fetchData: () => new Promise(() => {}) } });
  controller.abort(new Error('cancelled'));
  await expect(promise).rejects.toThrow('cancelled');
});

it('exports generated row numbers across all sorted matches with a merged header', async () => {
  const input = JSON.parse(readFileSync(new URL('../../../../pages/table-row-number.json', import.meta.url), 'utf8'));
  const parsed = parsePage(input); if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const page = parsed.page; const component = page.sections[0].components[0] as TableComponent;
  const data = await prepareTableExport({ page, component,
    state: { currentYear:2026, filters:new Map(), tables:{[component.id]:{pageIndex:2,sort:[{field:'value',direction:'desc'}],headerFilters:{},searchQuery:'客户2'}}, headerFilters:{} },
    queries:new Map(), controller:new AbortController(), gateway:{async fetchData(){throw new Error('inline');}} });
  const bytes = await encodeTableWorkbook(component, data, new AbortController().signal);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes.buffer); const sheet = workbook.worksheets[0];
  expect(sheet.getCell('A1').value).toBe('序号'); expect(sheet.getCell('A2').isMerged).toBe(true);
  expect(sheet.getCell('C1').value).toBe('业务指标');
  expect(sheet.getCell('A3').value).toBe(1); expect(sheet.getCell('B3').value).toBe('客户25');
  expect(sheet.getCell('A9').value).toBe(7); expect(sheet.getCell('B9').value).toBe('客户2');
  expect(data.main?.snapshot.rows[0]).not.toHaveProperty('rowNumber');
});
