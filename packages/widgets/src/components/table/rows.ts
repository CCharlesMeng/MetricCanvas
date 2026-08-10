import type { FieldBinding, FieldValue, Row } from '@metriccanvas/page';
import type { NamedDataSlots } from '../../shared/component-data';
import { resolveField } from '../../shared/component-data';

export interface AlignedTableRow {
  main: Row;
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
