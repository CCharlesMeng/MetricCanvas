import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import type { WorkbookTable } from '../src/table/export/workbook-sheet';
import { encodeWorkbookTables } from '../src/table/export/workbook';

function data(rows: Array<{ label: string; amount: number }>): NamedDataSlots {
  return { main: { fields: { label: { type: 'string', role: 'dimension' }, amount: { type: 'number', role: 'measure' } }, snapshot: { status: 'ready', rows } } };
}
function fixture(): WorkbookTable {
  const children: WorkbookTable[] = [[{ label: '=同名代表处', amount: 0 }, { label: '=同名代表处', amount: 2.5 }], []].map(rows => ({
    name: '子表明细', data: data(rows), component: { id: 'child', type: 'table', layout: { span: 12 }, data: { main: 'child' }, props: {
      rowNumber: { title: '子序号' }, columns: [{ kind: 'group', id: 'metrics', title: '代表处明细', children: [
        { field: 'label', title: '代表处', width: 210 }, { field: { data: 'main', field: 'amount', format: 'number-1' }, title: '金额', width: 140 }
      ] }]
    } }
  }));
  return { name: '父子表格', data: data([{ label: '华东', amount: 1200 }, { label: '华南', amount: 900 }]), children,
    component: { id: 'parent', type: 'table', layout: { span: 12 }, data: { main: 'regions' }, props: {
      rowNumber: { title: '父序号' }, columns: [{ field: 'label', title: '地区部', width: 200 }, { field: 'amount', title: '整体金额' }]
    } } };
}
async function workbook(table: WorkbookTable) {
  const bytes = await encodeWorkbookTables([table], new AbortController().signal), book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes.buffer);
  return book;
}
it('interleaves each child below its parent, shifting the complete merged header and typed cells by one column', async () => {
  const input = fixture(), original = structuredClone(input), book = await workbook(input), sheet = book.worksheets[0]!;
  expect(book.worksheets.map(value => value.name)).toEqual(['父子表格']);
  expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  expect(sheet.rowCount).toBe(10);
  expect([sheet.getCell('A2').value, sheet.getCell('B2').value, sheet.getCell('C2').value]).toEqual([1, '华东', 1200]);
  expect(sheet.getCell('B3').value).toBe('子序号');
  expect(sheet.getCell('B3').master.address).toBe(sheet.getCell('B4').master.address);
  expect(sheet.getCell('C3').value).toBe('代表处明细');
  expect(sheet.getCell('D3').master.address).toBe('C3');
  expect([sheet.getCell('C4').value, sheet.getCell('D4').value]).toEqual(['代表处', '金额']);
  expect(sheet.getCell('C3').font.bold).toBe(true);
  expect([sheet.getCell('B5').value, sheet.getCell('B6').value]).toEqual([1, 2]);
  expect([sheet.getCell('C5').value, sheet.getCell('C6').value]).toEqual(['=同名代表处', '=同名代表处']);
  expect(sheet.getCell('C5').type).toBe(ExcelJS.ValueType.String);
  expect([sheet.getCell('D5').value, sheet.getCell('D6').value]).toEqual([0, 2.5]);
  expect(sheet.getCell('D5').numFmt).toBe('0.0');
  expect([sheet.getCell('A7').value, sheet.getCell('B7').value]).toEqual([2, '华南']);
  expect(sheet.getCell('B10').value).toBe('暂无数据');
  expect(sheet.getCell('D10').master.address).toBe('B10');
  expect([3, 4, 5, 6, 8, 9, 10].map(row => sheet.getCell(row, 1).value)).toEqual(Array(7).fill(null));
  expect(sheet.getColumn(3).width).toBe(30);
  expect(input).toEqual(original);
});
it('keeps pinned parent summaries outside the parent-child association and collects child warnings', async () => {
  const input = fixture();
  input.component.props.pinnedTop = { data: 'summary' };
  input.data.summary = data([{ label: '合计', amount: 2100 }]).main;
  input.children![0]!.data.main!.snapshot.warnings = [{ code: 'TABLE_RESULT_RECOVERED', sourceId: 'detail', message: '合成子表诊断', count: 1 }];
  const book = await workbook(input), sheet = book.worksheets[0]!;
  expect([sheet.getCell('A2').value, sheet.getCell('A3').value, sheet.getCell('B3').value]).toEqual([null, 1, '华东']);
  expect(sheet.getCell('B4').value).toBe('子序号');
  expect(sheet.getCell('B8').value).toBe('华南');
  expect(book.worksheets.map(value => value.name)).toEqual(['父子表格', '数据异常说明']);
  expect(book.worksheets[1]!.getCell('C3').value).toBe('合成子表诊断');
});
it('rejects inconsistent parent-child blocks and exports an empty parent as headers only', async () => {
  const input = fixture();
  input.children = [];
  await expect(workbook(input)).rejects.toThrow('父子导出实例数量不一致');
  input.data = data([]);
  const book = await workbook(input);
  expect(book.worksheets).toHaveLength(1);
  expect(book.worksheets[0]!.rowCount).toBe(1);
});
