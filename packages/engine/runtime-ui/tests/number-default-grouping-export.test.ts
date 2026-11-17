import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import type { TableComponent, ValueFormatPreset } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import { encodeTableWorkbook } from '../src/table/export/workbook';

it('keeps full precision, tiny numbers, ungrouped defaults and original numeric values in XLSX', async () => {
  const formats: Array<ValueFormatPreset | undefined> = [undefined, 'number', 'number-ungrouped', 'number-5-ungrouped', 'number-2-ungrouped-signed', 'number-grouped'];
  const fields = Object.fromEntries(formats.map((format, index) => [`n${index}`, { type: 'number' as const, role: 'measure' as const, defaultFormat: format }]));
  const rows = [12345.6789012345, 1e-25, -1e-25, 1.234567890123456e-19, 0.000001234567890123456].map(value => Object.fromEntries(formats.map((_format, index) => [`n${index}`, value])));
  const data: NamedDataSlots = { main: { fields, snapshot: { status: 'ready', rows } } };
  const original = structuredClone(data);
  const component: TableComponent = { id: 'numbers', type: 'table', layout: { span: 12 }, data: { main: 'sample' }, props: {
    columns: formats.map((_format, index) => ({ field: `n${index}` }))
  } };
  const bytes = await encodeTableWorkbook(component, data, new AbortController().signal);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes.buffer);
  const sheet = book.worksheets[0]!;
  for (let column = 1; column <= formats.length; column++) {
    expect(sheet.getCell(2, column).value).toBe(12345.6789012345);
    expect(sheet.getCell(3, column).value).toBe(1e-25);
    expect(sheet.getCell(4, column).value).toBe(-1e-25);
    expect(sheet.getCell(5, column).value).toBe(1.234567890123456e-19);
    expect(sheet.getCell(6, column).value).toBe(0.000001234567890123456);
    expect(sheet.getCell(2, column).type).toBe(ExcelJS.ValueType.Number);
  }
  expect(sheet.getCell('A2').numFmt).toBe('#,##0.##############################;-#,##0.##############################;0');
  expect(sheet.getCell('B3').numFmt).toBe('0.################E+00;-0.################E+00;0');
  expect(sheet.getCell('B5').numFmt).toBe('0.################E+00;-0.################E+00;0');
  expect(sheet.getCell('C2').numFmt).toBe('General');
  expect(sheet.getCell('C3').numFmt).toBe('General');
  expect(sheet.getCell('D2').numFmt).toBe('0.#####;-0.#####;0');
  expect(sheet.getCell('E2').numFmt).toBe('+0.##;-0.##;0');
  expect(sheet.getCell('F2').numFmt).toBe('#,##0.###;-#,##0.###;0');
  expect(data).toEqual(original);
});
