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
  expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['父子表格']);
  const sheet = workbook.worksheets[0]!;
  expect(sheet.rowCount).toBe(27);
  expect(sheet.getCell('A2').value).toBe('华东');
  expect([sheet.getCell('B4').value, sheet.getCell('B5').value]).toEqual(['上海', '上海']);
  expect([sheet.getCell('C4').value, sheet.getCell('C5').value]).toEqual([360, 999]);
  expect([sheet.getCell('A3').value, sheet.getCell('A4').value, sheet.getCell('A5').value]).toEqual([null, null, null]);
  expect(sheet.getCell('A10').value).toBe('中国区');
  expect(tables[0]!.children!.flatMap(child => child.data.main!.snapshot.rows)).toHaveLength(18);
});
