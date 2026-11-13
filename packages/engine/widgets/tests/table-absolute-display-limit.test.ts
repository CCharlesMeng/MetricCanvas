import { expect, it } from 'vitest';
import type { FieldValue, Row, TableColumn } from '@metriccanvas/page/internal';
import { setRowCellFallbacks } from '@metriccanvas/page/internal';
import { alignedCellArrow, alignedCellText, tableRowColumn, type AlignedTableRow } from '../src/components/table/rows';
import type { NamedDataSlots } from '../src/shared/component-data';
import { tableValueColor } from '../src/shared/value-color';
const data: NamedDataSlots = { main: { fields: { value: { type: 'number', role: 'measure', defaultFormat: 'number-1-signed' } }, snapshot: { status: 'ready', rows: [] } } };
const column: TableColumn = { field: 'value', absoluteDisplayLimit: 500, colorRule: { mode: 'sign', positive: 'green', negative: 'red' }, arrowRule: { mode: 'sign', positive: 'up', negative: 'down' } };
function row(value: FieldValue | undefined): AlignedTableRow {
  const main: Row = value === undefined ? {} : { value };
  return { main, bySlot: { main } };
}
function text(value: FieldValue | undefined, target = column): string {
  return alignedCellText(target.field, data, row(value), target.enumValues, target.unit, target.absoluteDisplayLimit);
}
it.each([
  [650, '> 500', '↑', 'green'], [-650, '> 500', '↓', 'red'],
  [500, '+500', '↑', 'green'], [-500, '-500', '↓', 'red'],
  [500.0001, '> 500', '↑', 'green'], [-500.0001, '> 500', '↓', 'red'],
  [499.9999, '+500', '↑', 'green'], [-499.9999, '-500', '↓', 'red'],
  [0, '0', '', undefined], [-0, '0', '', undefined], [null, '--', '', undefined],
  [undefined, '--', '', undefined], [Infinity, '--', '', undefined], [NaN, '--', '', undefined]
] as const)('raw magnitude %j controls text and preserves direction', (value, expected, arrow, color) => {
  expect(text(value)).toBe(expected);
  expect(alignedCellArrow(column, data, row(value))).toBe(arrow);
  expect(tableValueColor(value, column, 'number-1-signed')).toBe(color);
});
it('preserves enum labels, malformed text, missing text, units and optional omission', () => {
  expect(text(650, { ...column, enumValues: [{ value: 650, label: '已确认' }] })).toBe('已确认');
  expect(text('650')).toBe('+650'); // existing formatting remains; text is never thresholded
  expect(text('异常')).toBe('异常');
  expect(text(650, { ...column, absoluteDisplayLimit: undefined })).toBe('+650');
  expect(text(650, { ...column, unit: '天' })).toBe('> 500 天');
  expect(text(null, { ...column, field: { data: 'main', field: 'value', missingText: '无数据' } })).toBe('无数据');
  expect(text(650, { ...column, arrowRule: undefined })).toBe('> 500');
});
it('uses raw polarity for a small exceeded limit even when the regular format rounds to zero', () => {
  const tiny = { ...column, absoluteDisplayLimit: 0.001 };
  expect(text(-0.004, tiny)).toBe('> 0.001');
  expect(alignedCellArrow(tiny, data, row(-0.004))).toBe('↓');
  expect(tableValueColor(-0.004, tiny, 'number-1-signed')).toBe('red');
});
it('does not threshold fallback evidence or inherit limits into supplementary fields', () => {
  const target = row(null); setRowCellFallbacks(target.main, { value: { raw: 650, reason: 'TYPE_MISMATCH' } });
  expect(alignedCellText(column.field, data, target, undefined, undefined, 500)).toBe('650');
  expect(alignedCellArrow(column, data, target)).toBe('');
  expect(alignedCellText('value', data, row(650))).toBe('+650');
});
it('inherits the limit for numeric pinned values and leaves pinned labels untouched', () => {
  const slots = { ...data, summary: data.main }, pinned: AlignedTableRow = { ...row(900), bySlot: { summary: { value: 900 } }, kind: 'pinnedTop' };
  const target = tableRowColumn({ ...column, pinnedTop: { field: { data: 'summary', field: 'value' } } }, pinned, slots);
  expect(alignedCellText(target.field, slots, pinned, target.enumValues, target.unit, target.absoluteDisplayLimit)).toBe('> 500');
  const label = tableRowColumn({ ...column, pinnedTop: { text: '合计' } }, pinned, slots);
  expect(alignedCellText(label.field, slots, pinned, undefined, undefined, label.absoluteDisplayLimit)).toBe('合计');
});
