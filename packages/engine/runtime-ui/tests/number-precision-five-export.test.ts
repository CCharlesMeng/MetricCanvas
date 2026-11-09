import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parsePage } from '@metriccanvas/page';
import type { TableComponent } from '@metriccanvas/page/internal';
import { encodeTableWorkbook } from '../src/table/export/workbook';
import { prepareTableExport } from '../src/table/export/prepare';

it('exports the precision scene with raw numeric cells and the same frozen display', async () => {
  const raw = JSON.parse(readFileSync('pages/capabilities/data/number-precision-five.json', 'utf8'));
  const parsed = parsePage(raw);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page;
  const component = page.sections[0]!.components[0] as TableComponent;
  const data = await prepareTableExport({ page, component,
    state: { currentYear: 2026, filters: new Map(), tables: {}, headerFilters: {} },
    queries: new Map(), controller: new AbortController(),
    gateway: { async fetchData() { throw Error('Inline data must not fetch'); } }
  });
  const bytes = await encodeTableWorkbook(component, data, new AbortController().signal);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes.buffer);
  const sheet = book.worksheets[0]!;
  expect(sheet.rowCount).toBe(15);
  for (const [index, display] of ['1234.123', '+1234.123', '1234.1235', '+1234.1235', '1234.12346', '+1234.12346'].entries()) {
    const cell = sheet.getCell(2, index + 2);
    expect(cell.value).toBe(1234.12345678);
    expect(cell.numFmt).toBe(`"${display}"`);
  }
  expect(sheet.getCell('G12').numFmt).toBe('"0"');
  expect(sheet.getCell('G15').value).toBeNull();
});
