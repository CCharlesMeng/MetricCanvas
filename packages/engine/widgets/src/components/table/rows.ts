import { tableLeafColumns, restoreCellFallbacks, rowCellFallback, pinnedSnapshotError, type TableProps, type TableColumn, type FieldBinding, type FieldValue, type Row } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../shared/component-data';
import { resolveField } from '../../shared/component-data';
import { reportTableFormats, formatTableCell } from './cell-presentation';

export interface AlignedTableRow {
  main: Row;
  kind?: 'pinnedTop';
  bodyIndex?: number;
  bySlot: Readonly<Record<string, Row | undefined>>;
}

/**
 * 主数据槽决定表格行顺序；其他数据槽按稳定 rowKey 对齐。
 * 未声明 rowKey 时保持单数据槽表格的按行号行为。
 */
export function alignTableRows(
  data: NamedDataSlots,
  rowKey?: string
): AlignedTableRow[] {
  for (const slot of Object.values(data)) if (slot) restoreCellFallbacks(slot.snapshot.rows, slot.snapshot.cellFallbacks);
  const mainRows = data.main?.snapshot.rows ?? [];
  const slotEntries = Object.entries(data);
  if (!rowKey) {
    return mainRows.map((main, index) => ({
      main,
      bySlot: Object.fromEntries(
        slotEntries.map(([slot, value]) => [slot, value?.snapshot.rows[index]])
      )
    }));
  }

  const indexes = new Map<string, Map<FieldValue, Row>>();
  for (const [slot, value] of slotEntries) {
    if (slot === 'main' || !value) continue;
    const rows = new Map<FieldValue, Row>();
    for (const row of value.snapshot.rows) {
      const key = row[rowKey];
      if (key != null && !rows.has(key)) rows.set(key, row);
    }
    indexes.set(slot, rows);
  }

  return mainRows.map((main) => {
    const key = main[rowKey];
    return {
      main,
      bySlot: Object.fromEntries(
        slotEntries.map(([slot]) => [
          slot,
          slot === 'main' ? main : key == null ? undefined : indexes.get(slot)?.get(key)
        ])
      )
    };
  });
}

export function alignedFieldValue(
  binding: FieldBinding,
  data: NamedDataSlots,
  row: AlignedTableRow
): FieldValue | undefined {
  const resolved = resolveField(binding, data);
  return row.bySlot[resolved.data]?.[resolved.field];
}

/** Body alignment remains unchanged; pinned data is never joined into its row domain. */
export function projectTableRows(data: NamedDataSlots, props: TableProps): AlignedTableRow[] {
  const columns = tableLeafColumns(props.columns);
  reportTableFormats(data, columns);
  const slot = props.pinnedTop?.data;
  const alignedData = Object.fromEntries(Object.entries(data).filter(([name]) => name !== slot));
  const body = alignTableRows(alignedData, props.rowKey).map((row, bodyIndex) => ({ ...row, bodyIndex }));
  const snapshot = slot ? data[slot]?.snapshot : undefined;
  if (!slot || !snapshot || pinnedSnapshotError(snapshot) || snapshot.rows.length !== 1) return body;
  restoreCellFallbacks(snapshot.rows, snapshot.cellFallbacks);
  const pinned: AlignedTableRow = { main: snapshot.rows[0], bySlot: { [slot]: snapshot.rows[0] }, kind: 'pinnedTop' };
  reportTableFormats(data, columns.map(column => tableRowColumn(column, pinned, data)));
  return [pinned, ...body];
}
function pinnedBinding(binding: FieldBinding | undefined, inherited: FieldBinding | undefined, data: NamedDataSlots): FieldBinding | undefined {
  if (!binding) return undefined;
  const resolved = resolveField(binding, data);
  const original = inherited ? resolveField(inherited, data) : undefined;
  const explicit = typeof binding === 'object' && 'data' in binding ? binding : undefined;
  return { data: resolved.data, field: resolved.field, format: explicit?.format ?? original?.format ?? resolved.format, missingText: explicit?.missingText ?? original?.missingText };
}
export function tableRowColumn(column: TableColumn, row: AlignedTableRow, data: NamedDataSlots): TableColumn {
  if (row.kind !== 'pinnedTop') return column;
  const pinned = column.pinnedTop;
  return { ...column, field: pinnedBinding(pinned?.field, column.field, data) ?? { data: '__unbound', field: '__unbound' },
    secondaryField: pinnedBinding(pinned?.secondaryField, column.secondaryField, data), badgeField: pinnedBinding(pinned?.badgeField, column.badgeField, data),
    selection: undefined, link: false, openDetail: undefined, navigate: undefined };
}
export function alignedFallback(binding: FieldBinding, data: NamedDataSlots, row: AlignedTableRow) {
  const resolved = resolveField(binding, data);
  return rowCellFallback(row.bySlot[resolved.data], resolved.field);
}
export function alignedCellText(binding: FieldBinding, data: NamedDataSlots, row: AlignedTableRow): string {
  const resolved = resolveField(binding, data);
  if (row.kind === 'pinnedTop' && resolved.data === '__unbound') return '';
  const fallback = alignedFallback(binding, data, row);
  if (fallback) return String(fallback.raw);
  return formatTableCell(alignedFieldValue(binding, data, row), resolved.format, resolved.missingText);
}
