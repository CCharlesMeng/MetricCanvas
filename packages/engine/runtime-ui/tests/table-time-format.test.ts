import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import document from '../../../../pages/capabilities/table/table-time-format.json';
import { parsePage } from '@metriccanvas/page';
import { setRowCellFallbacks } from '@metriccanvas/page/internal';
import { alignedCellArrow, alignedCellText, projectTableRows } from '../../widgets/src/components/table/rows';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import { encodeTableWorkbook } from '../src/table/export/workbook';

it('shares table presentation with Excel, including query scalar fallback evidence', async () => {
  const parsed = parsePage(document);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const table = parsed.page.sections[0].components[0];
  const source = parsed.page.dataSources.records;
  if (table.type !== 'table' || source.source.type !== 'inline') throw Error('fixture');
  const rows = structuredClone(source.source.rows);
  const data: NamedDataSlots = { main: { fields: source.fields, snapshot: { status: 'ready', rows } } };
  // Query normalization can preserve non-ISO backend datetimes as display evidence.
  rows.push({ ...rows[9]!, id: 'fallback' });
  setRowCellFallbacks(rows[10]!, { createdAt: { raw: '2026/11/09 18:30:00', reason: 'TYPE_MISMATCH' } });
  const before = structuredClone(rows);
  const column = table.props.columns[1];
  if (column.kind === 'group') throw Error('column');
  const expected = [
    ...Array<string>(7).fill('2026-11-10 02:30:00'),
    '2027-01-01 02:30:00', '2026-02-30T18:30:00Z', '--', '2026-11-10 02:30:00'
  ];
  expect(projectTableRows(data, table.props).map(row => alignedCellText(column.field, data, row))).toEqual(expected);
  const bytes = await encodeTableWorkbook(table, data, new AbortController().signal);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer);
  expect(expected.map((_, i) => workbook.worksheets[0].getCell(i + 2, 2).value)).toEqual(expected.map(value => value === '--' ? null : value));
  expect(workbook.worksheets[0].getCell(2, 2).type).toBe(ExcelJS.ValueType.String);
  for (const [index, expected] of [[3, '2026-11-10'], [4, '2026-11-10 02:30'], [5, '02:30:00'], [6, '2026年11月10日']] as const) {
    const column = table.props.columns[index];
    if (column.kind === 'group') throw Error('column');
    expect(alignedCellText(column.field, data, projectTableRows(data, table.props)[0]!)).toBe(expected);
    expect(workbook.worksheets[0].getCell(2, index + 1).value).toBe(expected);
  }
  expect(rows).toEqual(before);
});

it('preserves authored arrows on numeric timestamps in text exports', async () => {
  const parsed = parsePage(document);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const table = parsed.page.sections[0].components[0];
  if (table.type !== 'table') throw Error('fixture');
  const time = table.props.columns[1];
  if (time.kind === 'group') throw Error('column');
  const data: NamedDataSlots = { main: {
    fields: { id: { type: 'string', role: 'dimension' }, createdAt: { type: 'number', role: 'dimension' } },
    snapshot: { status: 'ready', rows: [{ id: 'n', createdAt: 1794249000000 }] }
  } };
  for (const position of ['before', 'after'] as const) {
    const column = { ...time, arrowRule: { mode: 'fixed', arrow: 'up', position } } as const;
    const props = { ...table.props, columns: [column] };
    const row = projectTableRows(data, props)[0]!;
    expect(alignedCellText(column.field, data, row)).toBe('2026-11-10 02:30:00');
    expect(alignedCellArrow(column, data, row)).toBe('↑');
    const workbook = new ExcelJS.Workbook();
    const bytes = await encodeTableWorkbook({ ...table, props }, data, new AbortController().signal);
    await workbook.xlsx.load(bytes.buffer);
    expect(workbook.worksheets[0].getCell(2, 1).value).toBe(position === 'after' ? '2026-11-10 02:30:00 ↑' : '↑ 2026-11-10 02:30:00');
  }
});
