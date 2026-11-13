import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parsePage, type TableComponent } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import { encodeTableWorkbook } from '../src/table/export/workbook';
function fixture() {
  const result = parsePage(JSON.parse(readFileSync('pages/capabilities/table/table-absolute-display-limit.json', 'utf8')));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const page = result.page;
  const component = page.sections[0].components[0] as TableComponent;
  const data: NamedDataSlots = {};
  for (const [slot, sourceId] of Object.entries(component.data)) {
    const source = page.dataSources[sourceId];
    if (source.source.type !== 'inline') throw new Error('Requires inline data');
    data[slot] = { fields: source.fields, snapshot: { status: 'ready', rows: source.source.rows } };
  }
  return { component, data };
}
it('exports the actual demonstration with raw numeric values, threshold text, arrows and colors', async () => {
  const { component, data } = fixture(), before = structuredClone(data);
  const bytes = await encodeTableWorkbook(component, data, new AbortController().signal);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes.buffer);
  const sheet = workbook.worksheets[0];
  expect(sheet.getCell('C3').value).toBe(650);
  expect(sheet.getCell('C3').numFmt).toBe('"↑ > 500"');
  expect(sheet.getCell('C3').font.color?.argb).toBe('FF52C41A');
  expect(sheet.getCell('C4').value).toBe(-650);
  expect(sheet.getCell('C4').numFmt).toBe('"↓ > 500"');
  expect(sheet.getCell('C4').font.color?.argb).toBe('FFF5222D');
  expect(sheet.getCell('C5').value).toBe(500);
  expect(sheet.getCell('C5').numFmt).not.toContain('> 500');
  expect(sheet.getCell('C6').value).toBe(-500);
  expect(sheet.getCell('C6').numFmt).not.toContain('> 500');
  expect(sheet.getCell('C7').value).toBe(500.0001);
  expect(sheet.getCell('C7').numFmt).toBe('"↑ > 500"');
  expect(sheet.getCell('C9').numFmt).not.toContain('> 500');
  expect(sheet.getCell('C11').value).toBe(0);
  expect(sheet.getCell('C11').numFmt).not.toMatch(/[↑↓>]/);
  expect(sheet.getCell('C12').value).toBeNull();
  expect(data).toEqual(before);
});
