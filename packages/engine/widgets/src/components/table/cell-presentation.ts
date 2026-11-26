import { debugWarn, runtimeWarningsEnabled } from '@metriccanvas/data-execution/runtime';
import { fieldContractViolations, type FieldBinding, type TableColumn, type FieldValue, type ValueFormat } from '@metriccanvas/page/internal';
import { formatValue, finiteNumber, hasDisplayValue, type ValueFormatContext } from '../../shared/value-format';

import { resolveField, type NamedDataSlots } from '../../shared/component-data';
import { timeInstant } from '../../shared/time-format';
const warned = new WeakMap<object, Set<string>>();
export function compatibleTableFormat(value: FieldValue, format: ValueFormat): boolean {
  if (typeof format === 'object') return timeInstant(value) !== undefined;
  if (format === 'text' || format === 'period') return true;
  if (format === 'date' || format === 'date-month-day') {
    return !fieldContractViolations(value, { type: 'date', role: 'dimension' }).length ||
      !fieldContractViolations(value, { type: 'datetime', role: 'dimension' }).length;
  }
  return finiteNumber(value) !== undefined;
}
/** Format-only mismatch retains the typed value; the current cell displays its original text. */
export function formatTableCell(value: FieldValue | undefined, format?: ValueFormat, missingText?: string, context?: ValueFormatContext): string {
  if (!hasDisplayValue(value) || !format || compatibleTableFormat(value, format)) return formatValue(value, format, missingText, context);
  return String(value);
}

function reportBinding(data: NamedDataSlots, binding: FieldBinding): void {
  const resolved = resolveField(binding, data), slot = data[resolved.data];
  if (!slot || !resolved.format || resolved.definition?.role === 'detail') return;
  const snapshot = slot.diagnostics?.snapshot ?? slot.snapshot;
  if (snapshot.status !== 'ready') return;
  const key = JSON.stringify([resolved.field, resolved.format]);
  const seen = warned.get(snapshot) ?? new Set<string>();
  if (seen.has(key)) return;
  seen.add(key); warned.set(snapshot, seen);
  const count = snapshot.rows.filter(row => {
    const value = row[resolved.field];
    return hasDisplayValue(value) && !compatibleTableFormat(value, resolved.format!);
  }).length;
  if (!count) return;
  debugWarn('[MetricCanvas][TABLE_FORMAT_FALLBACK] 单元格格式与值不兼容；显示原文', {
    componentId: slot.diagnostics?.componentId, dataSourceId: slot.diagnostics?.sourceId ?? resolved.data,
    fieldId: resolved.field, format: resolved.format, count
  });
}
export function reportTableFormats(data: NamedDataSlots, columns: readonly TableColumn[]): void {
  if (!runtimeWarningsEnabled) return;
  for (const column of columns) {
    for (const binding of [column.field, column.secondaryField, column.badgeField]) {
      if (binding) reportBinding(data, binding);
    }
  }
}
