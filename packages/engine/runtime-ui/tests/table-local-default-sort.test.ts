import { expect, it } from 'vitest';
import document from '../../../../pages/capabilities/table/table-default-sort.json';
import { parsePage } from '@metriccanvas/page';
import { initialFilterValues } from '@metriccanvas/data-execution/runtime';
import { createTableController } from '../src/table/controller';
import { prepareTableExport } from '../src/table/export/prepare';

it('exports the committed default ordering across all pages and preserves explicit clearing', async () => {
  const result = parsePage(document);
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  const page = result.page;
  const table = page.sections[0].components[1];
  if (table.type !== 'table') throw Error('missing table');
  const filters = initialFilterValues(page.filters ?? []);
  const controller = createTableController(page, () => null, () => {}, () => filters);
  const state = {filters,tables:{[table.id]:controller.render(table)},headerFilters:{[table.id]:controller.headers(table)},currentYear:2026};
  const input = {page,component:table,state,queries:new Map(),controller:new AbortController(),gateway:{async fetchData(){throw Error('inline must not query');}}};
  try {
    const snapshot = (await prepareTableExport(input)).main?.snapshot;
    expect(snapshot?.rows.map(row => row['total-score'])).toEqual([13,12,11,10,9,8,7,6,5,4,3,2]);
    controller.sort(table, []);
    state.tables[table.id] = controller.render(table);
    const cleared = await prepareTableExport({...input,controller:new AbortController()});
    expect(cleared.main?.snapshot.rows[0]['total-score']).toBe(9);
    controller.page(table,1);
    expect(controller.render(table).sort).toEqual([]);
  } finally {controller.dispose();}
});
