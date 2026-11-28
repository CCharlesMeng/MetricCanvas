import type { FieldValue, Row, TableColumn, TableProps as TableComponentProps } from '@metriccanvas/page/internal';
import { columnBindingKey } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../shared/component-data';
import { finiteNumber } from '../../shared/value-format';
import { alignedFieldValue, type AlignedTableRow } from './rows';
import type { TableSortRule } from './view-state';

export const FALLBACK_FIXED_WIDTH = 120;

export function computeValidExpansionKeys(
  rows: readonly Row[],
  keyOf?: (row: Row) => string | undefined
): Set<string> {
  if (!keyOf) return new Set();
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const unique = new Set<string>();
  for (const [key, count] of counts) {
    if (count === 1) unique.add(key);
  }
  return unique;
}

export function computeColumnWidthTotal(
  leaves: readonly TableColumn[],
  rowNumberWidth: number,
  expandable: boolean
): number {
  return leaves.reduce(
    (total, column) => total + (column.width ?? FALLBACK_FIXED_WIDTH),
    rowNumberWidth + (expandable ? 40 : 0)
  );
}

/**
 * Preserve proportional columns, with room for a short number plus cell padding.
 * Below this width the table owns horizontal scrolling rather than crushing text.
 */
export function computeFitMinWidth(
  leaves: readonly TableColumn[],
  columnWidthTotal: number,
  rowNumberWidth: number,
  hasRowNumber: boolean
): number {
  if (!leaves.length) return 0;
  const widths = leaves.map((column) => column.width ?? FALLBACK_FIXED_WIDTH);
  if (hasRowNumber) widths.push(rowNumberWidth);
  return (columnWidthTotal * 52) / Math.min(...widths);
}

/**
 * 固定列的 sticky 偏移:左固定列累计其前方左固定列宽度,右固定列累计其后方右固定列宽度。
 * 无显式宽度的固定列按 120px 参与累计(与 colgroup 缺省一致,保证偏移与实际渲染吻合)。
 */
export function computeStickyOffsets(
  leaves: readonly TableColumn[],
  expandable: boolean,
  rowNumberFixed: boolean,
  rowNumberWidth: number
): Map<string, number> {
  const offsets = new Map<string, number>();
  let left = (expandable ? 40 : 0) + (rowNumberFixed ? rowNumberWidth : 0);
  for (const column of leaves) {
    if (column.fixed !== 'left') continue;
    offsets.set(columnBindingKey(column.field), left);
    left += column.width ?? FALLBACK_FIXED_WIDTH;
  }
  let right = 0;
  for (let index = leaves.length - 1; index >= 0; index -= 1) {
    const column = leaves[index]!;
    if (column.fixed !== 'right') continue;
    offsets.set(columnBindingKey(column.field), right);
    right += column.width ?? FALLBACK_FIXED_WIDTH;
  }
  return offsets;
}

export function formatStickyCellStyle(column: TableColumn, stickyOffsets: ReadonlyMap<string, number>): string {
  if (!column.fixed) return '';
  const offset = stickyOffsets.get(columnBindingKey(column.field)) ?? 0;
  return `position: sticky; ${column.fixed}: ${offset}px;`;
}

export function formatColumnWidthStyle(
  column: TableColumn,
  fit: TableComponentProps['fit'],
  columnWidthTotal: number
): string {
  if (fit === 'container') {
    const percentage = ((column.width ?? FALLBACK_FIXED_WIDTH) / Math.max(columnWidthTotal, 1)) * 100;
    return `width: ${percentage}%;`;
  }
  return column.width ? `width: ${column.width}px; min-width: ${column.width}px;` : '';
}

/**
 * 点击列头:该列 无排序→asc→desc→清除 循环;普通点击替换为单列排序,
 * Shift+点击保留其余列(先点先高,多列优先级映射 @order priority)。
 */
export function computeNextTableSort(
  currentSort: readonly TableSortRule[],
  field: string,
  shiftKey: boolean,
  hasSortReset: boolean
): TableSortRule[] {
  const current = currentSort.find((rule) => rule.field === field);
  const next: TableSortRule | null = !current
    ? { field, direction: 'asc' }
    : current.direction === 'asc'
      ? { field, direction: 'desc' }
      : hasSortReset && !shiftKey
        ? { field, direction: 'asc' }
        : null;
  if (shiftKey) {
    const kept = currentSort.filter((rule) => rule.field !== field);
    return next ? [...kept, next] : kept;
  }
  return next ? [next] : [];
}

export function computePageWindow(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 6, '…', total];
  if (current >= total - 3) {
    return [1, '…', total - 5, total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '…', current - 2, current - 1, current, current + 1, current + 2, '…', total];
}

export function computeRateBarMaxima(
  leaves: readonly TableColumn[],
  rows: readonly AlignedTableRow[],
  data: NamedDataSlots
): Map<string, number> {
  const maxima = new Map<string, number>();
  for (const column of leaves) {
    if (column.visual !== 'rateBar') continue;
    let maximum = 0;
    for (const row of rows) {
      const numeric = finiteNumber(alignedFieldValue(column.field, data, row));
      if (numeric !== undefined) maximum = Math.max(maximum, Math.abs(numeric));
    }
    maxima.set(columnBindingKey(column.field), maximum);
  }
  return maxima;
}

export function computeRateBarWidth(
  column: TableColumn,
  value: FieldValue | undefined,
  rateBarMaxima: ReadonlyMap<string, number>
): number {
  const numeric = finiteNumber(value);
  const maximum = rateBarMaxima.get(columnBindingKey(column.field)) ?? 0;
  if (numeric === undefined || maximum === 0) return 0;
  return Math.min(100, (Math.abs(numeric) / maximum) * 100);
}
