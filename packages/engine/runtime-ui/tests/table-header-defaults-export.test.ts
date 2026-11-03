import {expect,it} from 'vitest';
import document from '../../../../pages/capabilities/table/table-header-filter-defaults.json';
import {parsePage} from '@metriccanvas/page';
import {initialFilterValues} from '@metriccanvas/data-execution/runtime';
import {createTableController} from '../src/table/controller';
import {prepareTableExport} from '../src/table/export/prepare';

it('freezes applied defaults for export and respects subsequent explicit clearing',async()=>{
  const parsed=parsePage(document);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page,table=page.sections[1].components[0];if(table.type!=='table')throw Error('table');
  const filters=initialFilterValues(page.filters??[]);
  const controller=createTableController(page,()=>null,()=>{},()=>filters);
  const state={filters,tables:{[table.id]:controller.render(table)},headerFilters:{[table.id]:controller.headers(table)},currentYear:2026};
  const input={page,component:table,state,queries:new Map(),controller:new AbortController(),gateway:{async fetchData(){throw Error('inline must not query');}}};
  const pending=prepareTableExport(input);
  controller.header(table,'status',null);controller.header(table,'code',null);
  state.headerFilters[table.id]=controller.headers(table);
  expect((await pending).main?.snapshot.rows.map(row=>row.id)).toEqual(['A001','A003']);
  const cleared=await prepareTableExport({...input,controller:new AbortController()});
  expect(cleared.main?.snapshot.rows).toHaveLength(6);
  expect(controller.headers(table)).toEqual({});
  controller.dispose();
});
