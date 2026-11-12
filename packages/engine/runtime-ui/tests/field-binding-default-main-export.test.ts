import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parsePage } from '@metriccanvas/page';
import { encodeTableWorkbook } from '../src/table/export/workbook';
import { prepareTableExport } from '../src/table/export/prepare';

it('exports omitted main and explicit supplemental slots with original numbers and matching formats', async () => {
  const raw = JSON.parse(readFileSync('pages/capabilities/data/number-precision-five.json', 'utf8'));
  const parsed = parsePage(raw);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const page = parsed.page;
  const component = page.sections.at(-1)!.components[1];
  if (component.type !== 'table') throw Error('The scene must keep its multi-source table');
  const data = await prepareTableExport({ page, component,
    state: { currentYear: 2026, filters: new Map(), tables: {}, headerFilters: {} },
    queries: new Map(), controller: new AbortController(),
    gateway: { async fetchData() { throw Error('Inline data must not fetch'); } }
  });
  const bytes = await encodeTableWorkbook(component, data, new AbortController().signal);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes.buffer);
  const sheet = book.worksheets[0]!;
  expect(sheet.getCell('B2').value).toBe(1.234);
  expect(sheet.getCell('C2').value).toBe(50);
  expect(sheet.getCell('B2').numFmt).toBe('+0.##;-0.##;0');
  expect(sheet.getCell('C2').numFmt).toBe('+0.##;-0.##;0');
  expect(sheet.getCell('B3').value).toBe(-1.234);
  expect(sheet.getCell('B4').value).toBe(-0.004);
  expect(sheet.getCell('B5').value).toBeNull();
});
