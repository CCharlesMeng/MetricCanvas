import { expect, it } from 'vitest';
import { alignedCellArrow, tableRowColumn } from '../src/components/table/rows';
import type { AlignedTableRow } from '../src/components/table/rows';
import type { NamedDataSlots } from '../src/shared/component-data';
import type { FieldValue, Row, TableColumn } from '@metriccanvas/page/internal';
import { setRowCellFallbacks } from '@metriccanvas/page/internal';

const data: NamedDataSlots = { main: { fields: { value: { type: 'number', role: 'measure', defaultFormat: 'number-1-signed' } }, snapshot: { status: 'ready', rows: [] } } };
function row(value: FieldValue | undefined): AlignedTableRow {
  const main: Row = value === undefined ? {} : { value };
  return { main, bySlot: { main } };
}
const column: TableColumn = { field: 'value', arrowRule: { mode: 'sign', positive: 'up', negative: 'down' }, unit: '天', colorRule: { mode: 'sign', positive: 'red', negative: 'green' } };
it.each([[2.5, '↑'], [-1.2, '↓'], [0, ''], [-0, ''], [null, ''], [undefined, ''], [NaN, ''], [Infinity, ''], ['异常文本', ''], [0.04, ''], [-0.04, ''], [0.05, '↑'], [-0.05, '↓']] as const)('numeric direction %j → %s', (value, expected) => {
  expect(alignedCellArrow(column, data, row(value))).toBe(expected);
});
it('arrows stay independent of colors, hide for enums and honor explicit format and opt-out', () => {
  expect(alignedCellArrow({ ...column, colorRule: { mode: 'fixed', color: 'green' } }, data, row(-1))).toBe('↓');
  expect(alignedCellArrow({ ...column, colorRule: undefined }, data, row(1))).toBe('↑');
  expect(alignedCellArrow({ ...column, enumValues: [{ value: 1, label: '正常' }] }, data, row(1))).toBe('');
  expect(alignedCellArrow({ ...column, field: { data: 'main', field: 'value', format: 'number' } }, data, row(0.04))).toBe('↑');
  expect(alignedCellArrow({ ...column, arrowRule: { mode: 'fixed', arrow: 'none' } }, data, row(1))).toBe('');
  expect(alignedCellArrow({ field: 'value' }, data, row(1))).toBe('');
});
it('pinned cells inherit the column switch and their own format; unbound text remains undecorated', () => {
  const slots: NamedDataSlots = { ...data, summary: data.main };
  const pinned: AlignedTableRow = { main: { value: 0.04 }, bySlot: { summary: { value: 0.04 } }, kind: 'pinnedTop' };
  const projected = tableRowColumn({ ...column, pinnedTop: { field: { data: 'summary', field: 'value', format: 'number' } } }, pinned, slots);
  expect(alignedCellArrow(projected, slots, pinned)).toBe('↑');
  expect(alignedCellArrow(tableRowColumn({ ...column, pinnedTop: { text: '合计' } }, pinned, slots), slots, pinned)).toBe('');
});
it('preserves numeric fallback evidence as undecorated original text', () => {
  const fallback = row(123);
  setRowCellFallbacks(fallback.main, { value: { raw: 123, reason: 'TYPE_MISMATCH' } });
  expect(alignedCellArrow(column, data, fallback)).toBe('');
});

it('uses authored inverse and one-sided sign mappings independently of the numeric sign and color', () => {
  const inverse: TableColumn = { ...column, arrowRule: { mode: 'sign', positive: 'down', negative: 'up' } };
  expect(alignedCellArrow(inverse, data, row(2.5))).toBe('↓');
  expect(alignedCellArrow(inverse, data, row(-1.2))).toBe('↑');
  expect(alignedCellArrow(inverse, data, row(0))).toBe('');
  expect(alignedCellArrow(inverse, data, row(0.04))).toBe('');
  const oneSided: TableColumn = { ...column, arrowRule: { mode: 'sign', positive: 'none', negative: 'down' } };
  expect(alignedCellArrow(oneSided, data, row(1))).toBe('');
  expect(alignedCellArrow(oneSided, data, row(-1))).toBe('↓');
});

it.each(['up', 'down', 'none'] as const)('uses fixed %s for all valid numbers, including zero, while preserving missing cells', arrow => {
  const fixed: TableColumn = { ...column, arrowRule: { mode: 'fixed', arrow } };
  const expected = { up: '↑', down: '↓', none: '' }[arrow];
  for (const value of [1, -1, 0, -0, 0.04]) expect(alignedCellArrow(fixed, data, row(value))).toBe(expected);
  for (const value of [null, undefined, NaN, Infinity, '异常文本']) expect(alignedCellArrow(fixed, data, row(value))).toBe('');
});
