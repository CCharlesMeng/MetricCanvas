import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parsePage } from '@metriccanvas/page';
import type { TableComponent } from '@metriccanvas/page/internal';
import { encodeTableWorkbook } from '../src/table/export/workbook';
import { prepareTableExport } from '../src/table/export/prepare';

it('exports integer display while retaining raw numeric values', async () => {
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
  for (const [row, value, display] of [
    [2, 1234.4, '1234'], [3, -1234.5, '-1235'], [4, 1234.5, '1235'],
    [5, 9.999, '10'], [6, 0.5, '1'], [7, -0.5, '-1'], [8, 0.4, '0'], [9, -0.4, '0']
  ] as const) {
    expect(sheet.getCell(row, 8).value).toBe(value);
    for (const column of [9, 10]) {
      const cell = sheet.getCell(row, column);
      expect(cell.type).toBe(ExcelJS.ValueType.Number);
      expect(cell.value).toBe(value);
      expect(cell.numFmt).toBe(`"${display}"`);
    }
  }
  expect(sheet.getCell('I15').value).toBeNull();
});
