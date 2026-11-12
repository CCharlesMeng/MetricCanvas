import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { strFromU8, unzipSync } from 'fflate';
import type { TableComponent, ValueFormatPreset } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import { encodeTableWorkbook } from '../src/table/export/workbook';
import { formatValue } from '../../widgets/src/shared/value-format';

it('exports all basic precisions as editable numeric cells and shares integer/zero rules across rows', async () => {
  const formats: ValueFormatPreset[] = ['number-0', 'number-1', 'number-2', 'number-3', 'number-4', 'number-5', 'number-3-signed', 'number-grouped', 'number-grouped-signed', 'number-signed'];
  const component: TableComponent = { id: 'numbers', type: 'table', layout: { span: 12 }, data: { main: 'sample' }, props: {
    columns: formats.map(format => ({ field: { data: 'main', field: 'n', format }, title: format }))
  } };
  const data: NamedDataSlots = { main: { fields: { n: { type: 'number', role: 'measure' } }, snapshot: {
    status: 'ready', rows: [{ n: 12.3 }, { n: 50 }, { n: -0.0000001 }, { n: null }, { n: -12.34567 }]
  } } };
  const bytes = await encodeTableWorkbook(component, data, new AbortController().signal);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes.buffer);
  const sheet = book.worksheets[0]!;
  const expected = ['0', '0.#;-0.#;0', '0.##;-0.##;0', '0.###;-0.###;0', '0.####;-0.####;0', '0.#####;-0.#####;0', '+0.###;-0.###;0', '#,##0.###;-#,##0.###;0', '+#,##0.###;-#,##0.###;0', '+General;General;0'];
  for (const [index, format] of expected.entries()) {
    expect(sheet.getCell(2, index + 1).value).toBe(12.3);
    expect(sheet.getCell(2, index + 1).numFmt).toBe(format);
    expect(sheet.getCell(4, index + 1).value).toBe(-0.0000001);
    expect(sheet.getCell(5, index + 1).value).toBeNull();
    sheet.getCell(2, index + 1).value = 125.6789;
    expect(sheet.getCell(2, index + 1).numFmt).toBe(format);
  }
  const files = unzipSync(bytes);
  const xml = strFromU8(files['xl/worksheets/sheet1.xml']!);
  const styles = strFromU8(files['xl/styles.xml']!);
  expect(xml.match(/<conditionalFormatting /g)).toHaveLength(8);
  expect(xml).toContain('sqref="B2:B4 B6"');
  expect(xml).toContain('<formula>ROUND(B2,1)=0</formula>');
  expect(xml).toContain('<formula>MOD(ROUND(B2,1),1)=0</formula>');
  expect(xml).toContain('<formula>ROUND(G2,3)=0</formula>');
  expect(styles).toContain('formatCode="+0;-0;0"');
  expect(styles).toContain('formatCode="0;0;0"');
});

it.each(['number-0', 'number-1', 'number-2', 'number-3', 'number-4', 'number-5', 'number-grouped', 'number-3-signed'] as const)('normalizes rounded negative zero in %s', format => {
  expect(formatValue(-0.0000001, format)).toBe('0');
});
