import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import type { TableComponent } from '@metriccanvas/page/internal';
import { createTableController } from '../src/table/controller';
import { orchestrate } from '../../runtime/src/orchestrator';

function fixture() {
  const parsed = parsePage(JSON.parse(readFileSync('pages/capabilities/table/query-sort-baseline.json', 'utf8')));
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  return { page: parsed.page, table: parsed.page.sections[0].components[0] as TableComponent };
}

it('shows the declared DQE direction on first render using the page field ID', () => {
  const { page, table } = fixture();
  const before = structuredClone(page);
  const controller = createTableController(page, () => null, () => {});
  try {
    expect(controller.render(table).sort).toEqual([{ field: 'sdt-avg-duration', direction: 'desc' }]);
    expect(controller.view(table).sort).toEqual([]);
    expect(page).toEqual(before);
    controller.sort(table, [{ field: 'rep-office', direction: 'asc' }]);
    expect(controller.render(table).sort).toEqual([{ field: 'rep-office', direction: 'asc' }]);
    controller.sort(table, []);
    expect(controller.render(table).sort).toEqual([]);
  } finally { controller.dispose(); }
});

it('preserves query initial reuse and keeps execution view unchanged for remote tables', () => {
  const { page, table } = fixture();
  page.sections[0].components = [table];
  const source = page.dataSources[table.data.main].source;
  if (source.type !== 'query') throw Error('query');
  delete source.resultScope;
  table.props.pagination = { mode: 'query' };
  const fetchData = vi.fn(async () => ({ rows: [], totalCount: 0 }));
  const stream = orchestrate(page, { fetchData });
  const stop = stream.subscribe(() => {});
  const controller = createTableController(page, () => stream, () => {});
  try {
    expect(controller.render(table).sort).toEqual([{ field: 'sdt-avg-duration', direction: 'desc' }]);
    expect(stream.getQueryView(table.data.main)?.sort).toEqual([]);
    expect(fetchData).not.toHaveBeenCalled();
  } finally { controller.dispose(); stop(); }
});

it('does not invent a table field for an unmapped query ordering', () => {
  const { page, table } = fixture();
  const source = page.dataSources[table.data.main].source;
  if (source.type !== 'query' || !source.query.body) throw Error('query');
  source.query.body.dsl_list[0].order = { order_by_field: '隐藏业务排序', type: 'desc' };
  const controller = createTableController(page, () => null, () => {});
  try { expect(controller.render(table).sort).toEqual([]); }
  finally { controller.dispose(); }
});

it.each(['asc', 'DESC'])('reflects a saved %s direction and isolates tables sharing a source', direction => {
  const { page, table } = fixture();
  const source = page.dataSources[table.data.main].source;
  if (source.type !== 'query' || !source.query.body) throw Error('query');
  source.query.body.dsl_list[0].order = { order_by_field: '商审SDT平均决策时长', type: direction };
  const other = { ...table, id: 'other' };
  const controller = createTableController(page, () => null, () => {});
  try {
    expect(controller.render(table).sort).toEqual([{ field: 'sdt-avg-duration', direction: direction.toLowerCase() }]);
    controller.sort(table, []);
    expect(controller.render(table).sort).toEqual([]);
    expect(controller.render(other).sort).toEqual([{ field: 'sdt-avg-duration', direction: direction.toLowerCase() }]);
  } finally { controller.dispose(); }
});

it('reflects the active query mode response mapping, and leaves an invalid selection unmarked', () => {
  const { page, table } = fixture();
  const source = page.dataSources[table.data.main].source;
  if (source.type !== 'query' || !source.query.body) throw Error('query');
  const body = structuredClone(source.query.body);
  body.dsl_list[0].order = { order_by_field: '另一个模式时长', type: 'asc' };
  source.query = { language: 'dqe', queryModes: { filterId: 'mode', cases: {
    alternate: { body, filterBindings: {}, fieldMappings: { 'rep-office': '代表处', 'sdt-avg-duration': '另一个模式时长' } }
  } } };
  const conditions = new Map([['mode', { type: 'dimension' as const, dimension: 'mode', values: ['alternate'] }]]);
  const controller = createTableController(page, () => null, () => {}, () => conditions);
  try {
    expect(controller.render(table).sort).toEqual([{ field: 'sdt-avg-duration', direction: 'asc' }]);
    conditions.clear();
    expect(controller.render(table).sort).toEqual([]);
  } finally { controller.dispose(); }
});
