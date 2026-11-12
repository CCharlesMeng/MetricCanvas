import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import type { TableComponent } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import { encodeTableWorkbook, encodeWorkbookTables } from '../src/table/export/workbook';

function fixture() {
  const component: TableComponent = { id: 'compatible', type: 'table', layout: { span: 12 }, data: { main: 'main' }, props: {
    rowNumber: { title: '行号', width: 140 },
    columns: [
      { kind: 'group', id: 'identity', title: '身份', children: [{ field: 'id', title: '编号' }, { field: 'flag', title: '启用' }] },
      { field: { data: 'main', field: 'amount', format: 'number-2' }, title: '金额', width: 210 },
      { field: { data: 'main', field: 'rate', format: 'percent-1' }, title: '比率' },
      { field: 'day', title: '日期' }, { field: 'at', title: '时间' },
      { field: 'html', title: '富文本' }, { field: 'formula', title: '普通文本' }
    ]
  } };
  const data: NamedDataSlots = { main: { fields: {
    id: { type: 'string', role: 'dimension' }, flag: { type: 'boolean', role: 'dimension' },
    amount: { type: 'number', role: 'measure' }, rate: { type: 'number', role: 'measure' },
    day: { type: 'date', role: 'dimension' }, at: { type: 'datetime', role: 'dimension' },
    html: { type: 'semanticHtml', role: 'detail' }, formula: { type: 'string', role: 'dimension' }
  }, snapshot: { status: 'ready', rows: [
    { id: '0001', flag: false, amount: 1234.5, rate: 25.5, day: '2026-11-05', at: '2026-11-05T13:14:15.000Z', html: '<b>甲&amp;乙</b><br>后续', formula: '=HYPERLINK("https://example.test")' },
    { id: '0002', flag: true, amount: 0, rate: -2, day: 'invalid date', at: null, html: null, formula: '+SUM(A1:A2)' }
  ] } } };
  return { component, data };
}

it('round-trips types, formats, merged headers, frozen rows and styles with an independent reader', async () => {
  const { component, data } = fixture();
  const before = structuredClone(data);
  const bytes = await encodeTableWorkbook(component, data, new AbortController().signal);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes.buffer);
  const sheet = book.worksheets[0]!;
  expect(sheet.getCell('A1').value).toBe('行号');
  expect(sheet.getCell('A2').isMerged).toBe(true);
  expect(sheet.getCell('C1').isMerged).toBe(true);
  expect(sheet.getCell('D2').isMerged).toBe(true);
  expect(sheet.getCell('A1').font.bold).toBe(true);
  expect(sheet.getCell('A1').alignment).toMatchObject({ horizontal: 'center', vertical: 'middle', wrapText: true });
  expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 2 });
  expect(sheet.getColumn(1).width).toBe(20);
  expect(sheet.getColumn(4).width).toBe(30);
  expect(sheet.getCell('B3').value).toBe('0001');
  expect(sheet.getCell('C3').value).toBe(false);
  expect(sheet.getCell('C4').value).toBe(true);
  expect(sheet.getCell('D3').value).toBe(1234.5);
  expect(sheet.getCell('D4').value).toBe(0);
  expect(sheet.getCell('D3').numFmt).toBe('0.##;-0.##;0');
  expect(sheet.getCell('E3').value).toBe(25.5);
  expect(sheet.getCell('E3').numFmt).toBe('0.0"%"');
  expect(sheet.getCell('F3').value).toEqual(new Date('2026-11-05'));
  expect(sheet.getCell('F4').value).toBe('invalid date');
  expect(sheet.getCell('G3').value).toEqual(new Date('2026-11-05T13:14:15.000Z'));
  expect(sheet.getCell('G4').value).toBeNull();
  expect(sheet.getCell('H3').value).toBe('甲&乙\n后续');
  expect(sheet.getCell('I3').value).toBe('=HYPERLINK("https://example.test")');
  expect(sheet.getCell('I3').type).toBe(ExcelJS.ValueType.String);
  expect(sheet.getCell('I4').value).toBe('+SUM(A1:A2)');
  expect(data).toEqual(before);
});

it('keeps worksheet naming, empty results, cancellation and invalid-column behavior', async () => {
  const { component, data } = fixture();
  const table = { component, data, name: 'Summary' };
  await expect(encodeWorkbookTables([table, { ...table, name: 'summary' }], new AbortController().signal)).rejects.toThrow('already exists');
  await expect(encodeWorkbookTables([{ ...table, name: 'invalid/name' }], new AbortController().signal)).rejects.toThrow('Invalid worksheet');
  const empty = { main: { ...data.main!, snapshot: { status: 'ready' as const, rows: [] } } };
  const bytes = await encodeWorkbookTables([{ component, data: empty, name: '长'.repeat(40) }], new AbortController().signal);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes.buffer);
  expect(book.worksheets[0]!.name).toBe('长'.repeat(31));
  expect(book.worksheets[0]!.rowCount).toBe(2);
  const controller = new AbortController(); controller.abort(new Error('cancelled'));
  await expect(encodeTableWorkbook(component, data, controller.signal)).rejects.toThrow('cancelled');
  await expect(encodeTableWorkbook({ ...component, props: { ...component.props, columns: [] } }, data, new AbortController().signal)).rejects.toThrow('无可见列');
});
