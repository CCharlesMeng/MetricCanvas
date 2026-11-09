import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parsePage } from '@metriccanvas/page';
import type { TableComponent } from '@metriccanvas/page/internal';
import raw from '../../../../pages/capabilities/table/table-child-keyless.json';
import { createKeylessChildPreview } from '../../../../apps/playground/fixtures/child-keyless';
import { initialFilterValues } from '../../runtime/src/filter-state';
import { prepareHierarchyExport } from '../src/table/export/hierarchy';
import { encodeWorkbookTables } from '../src/table/export/workbook';

it('exports every keyless record, including two different rows for the same office', async () => {
  const parsed = parsePage(raw);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page, table = page.sections[0]!.components.find((component): component is TableComponent => component.type === 'table')!;
  const controller = new AbortController(), gateway = createKeylessChildPreview().dataGateway;
  const tables = await prepareHierarchyExport({ page, component: table, gateway, queries: new Map(), params: new Map(), controller,
    state: { filters: initialFilterValues(page.filters ?? []), currentYear: 2026, tables: {}, headerFilters: {} } });
  const bytes = await encodeWorkbookTables(tables, controller.signal), workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer);
  expect(workbook.worksheets.map(sheet => sheet.rowCount - 1)).toEqual([4, 18]);
  const child = workbook.worksheets[1]!;
  expect([child.getCell('B2').value, child.getCell('B3').value]).toEqual(['上海', '上海']);
  expect([child.getCell('C2').value, child.getCell('C3').value]).toEqual([360, 999]);
  expect([child.getCell('A2').value, child.getCell('A3').value]).toEqual(['华东', '华东']);
});
