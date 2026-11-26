import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { strFromU8, unzipSync } from 'fflate';
import type { TableComponent } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import { encodeTableWorkbook, encodeWorkbookTables } from '../src/table/export/workbook';

function distinctFormats(bytes: Uint8Array): number {
  const styles = strFromU8(unzipSync(bytes)['xl/styles.xml']!);
  return Number(styles.match(/<numFmts count="(\d+)"/)?.[1] ?? 0);
}

it('shares formats across distinct amounts and ratios while keeping dashes, blanks and zero separate', async () => {
  const component: TableComponent = { id: 'mixed', type: 'table', layout: { span: 12 }, data: { main: 'sample' }, props: {
    columns: [
      { field: 'amount', unit: '元' }, { field: 'adaptive' },
      { field: { field: 'ratio', format: 'percent-2' } },
      { field: { field: 'ratio', format: 'percent-adaptive-signed', missingText: '--' } },
      { field: { field: 'ratio', format: 'points-1-signed' } }, { field: 'note' }
    ]
  } };
  const rows = Array.from({ length: 600 }, (_, index) => ({
    amount: index * 10.01 - 2000, adaptive: index < 300 ? index + 0.1 : index * 1000010.01,
    ratio: (index - 300) / 7, note: index % 2 ? '—' : '-'
  }));
  const data: NamedDataSlots = { main: { fields: {
    amount: { type: 'number', role: 'measure', defaultFormat: 'number-2' },
    adaptive: { type: 'money', role: 'measure', currency: 'CNY', unit: '万元' }, ratio: { type: 'number', role: 'measure' },
    note: { type: 'string', role: 'dimension' }
  }, snapshot: { status: 'ready', rows: [...rows, { amount: null, adaptive: null, ratio: null, note: '–' }, { ratio: 0 }, { ratio: '—' }] } } };
  const signal = new AbortController().signal;
  const bytes = await encodeTableWorkbook(component, data, signal);
  expect(distinctFormats(bytes)).toBeLessThan(35);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes.buffer);
  const sheet = book.worksheets[0]!;
  expect(sheet.getCell('B1').value).toBe('adaptive（元）');
  rows.forEach((row, index) => {
    const actual = sheet.getRow(index + 2);
    expect(actual.values).toEqual([, row.amount, row.adaptive, row.ratio, row.ratio, row.ratio, row.note]);
    expect(actual.getCell(3).numFmt).toContain('"%"');
  });
  expect(sheet.getRow(602).values).toEqual([, , , , '—', , '–']);
  expect(sheet.getCell('C602').value).toBeNull();
  expect(sheet.getCell('C603').value).toBe(0);
  expect(sheet.getCell('C604').value).toBe('—');
});

it('bounds the combined format list for all sheets and preserves dates and ratio formats when the budget is full', async () => {
  const component: TableComponent = { id: 'many-units', type: 'table', layout: { span: 12 }, data: { main: 'sample' }, props: {
    columns: []
  } };
  const data: NamedDataSlots = { main: { fields: {
    n: { type: 'number', role: 'measure', defaultFormat: 'number-2' }, date: { type: 'date', role: 'dimension' }
  }, snapshot: { status: 'ready', rows: [{ n: 12.3, date: '2026-11-26' }] } } };
  const tables = Array.from({ length: 3 }, (_, sheet) => ({ name: `Sheet ${sheet}`, data, component: { ...component, props: {
    columns: [...Array.from({ length: 90 }, (_, index) => ({ field: 'n', unit: `单位${sheet}-${index}` })), { field: 'date' }, { field: { field: 'n', format: 'percent-2' as const }, unit: `比例单位${sheet}` }]
  } } }));
  const bytes = await encodeWorkbookTables(tables, new AbortController().signal);
  expect(distinctFormats(bytes)).toBeLessThanOrEqual(200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes.buffer);
  for (const sheet of book.worksheets) {
    expect(Array.from({ length: 90 }, (_, index) => sheet.getCell(2, index + 1).value)).toEqual(Array(90).fill(12.3));
    expect(sheet.getCell(2, 91).value).toEqual(new Date('2026-11-26'));
    expect(sheet.getCell(2, 92).value).toBe(12.3);
    expect(sheet.getCell(2, 92).numFmt).toContain('%');
  }
  expect(book.worksheets[2]!.getCell(2, 92).numFmt).toBe('0.00"%"');
});
