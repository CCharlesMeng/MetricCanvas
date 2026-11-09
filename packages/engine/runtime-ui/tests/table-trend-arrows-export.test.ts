import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import type { TableComponent } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import { encodeTableWorkbook } from '../src/table/export/workbook';

it('exports arrows in numeric formats without changing values, precision, zero or missing cells', async () => {
  const component: TableComponent = { id: 'arrows', type: 'table', layout: { span: 12 }, data: { main: 'sample' }, props: { columns: [
    { field: { data: 'main', field: 'change', format: 'number-1-signed' }, unit: '天', arrowRule: { mode: 'sign', positive: 'down', negative: 'up' } },
    { field: 'plain', arrowRule: { mode: 'fixed', arrow: 'down', position: 'after' } },
    { field: 'off', arrowRule: { mode: 'fixed', arrow: 'none' } }
  ] } };
  const data: NamedDataSlots = { main: { fields: { change: { type: 'number', role: 'measure' }, plain: { type: 'number', role: 'measure' }, off: { type: 'number', role: 'measure' } }, snapshot: { status: 'ready', rows: [
    { change: 2.5, plain: 2.5, off: 2.5 }, { change: -1.2, plain: -1.2, off: -1.2 }, { change: 0.04, plain: 0, off: 0 }, { change: null, plain: null, off: null }
  ] } } };
  const before = structuredClone(data);
  const bytes = await encodeTableWorkbook(component, data, new AbortController().signal);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes.buffer);
  const sheet = workbook.worksheets[0];
  expect(sheet.getCell('A2').value).toBe(2.5);
  expect(sheet.getCell('A2').numFmt).toBe('"↓ ""+2.5 天"');
  expect(sheet.getCell('A3').value).toBe(-1.2);
  expect(sheet.getCell('A3').numFmt).toBe('"↑ ""-1.2 天"');
  expect(sheet.getCell('A4').value).toBe(0.04);
  expect(sheet.getCell('A4').numFmt).toBe('"0 天"');
  expect(sheet.getCell('B2').numFmt).toBe('General" ↓"');
  expect(sheet.getCell('B3').numFmt).toBe('General" ↓"');
  expect(sheet.getCell('B4').value).toBe(0);
  expect(sheet.getCell('B4').numFmt).toBe('General" ↓"');
  expect(sheet.getCell('C2').numFmt).not.toMatch(/[↑↓]/);
  expect(sheet.getCell('A5').value).toBeNull();
  expect(data).toEqual(before);
});
