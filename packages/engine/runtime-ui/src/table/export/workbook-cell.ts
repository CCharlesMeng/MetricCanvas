import { appendDisplayUnit } from '../../../../widgets/src/shared/display-unit';
import type { FieldDefinition, TableColumn, ValueFormat } from '@metriccanvas/page/internal';
import type { Cell, CellObject } from 'write-excel-file/universal';
import type { NamedDataSlots } from '../../../../widgets/src/shared/component-data';
import { resolveField } from '../../../../widgets/src/shared/component-data';
import { alignedFallback, alignedFieldValue, alignedCellArrow, tableRowColumn, type AlignedTableRow } from '../../../../widgets/src/components/table/rows';
import { compatibleTableFormat, formatTableCell } from '../../../../widgets/src/components/table/cell-presentation';
import { tableEnumLabel } from '../../../../widgets/src/components/table/enum-values';
import { resolvedUnit } from '../../../../widgets/src/shared/field-presentation';
import { formatValue, hasDisplayValue } from '../../../../widgets/src/shared/value-format';

/** Numbers retain raw values; scale formats display the frozen presentation. */
function numberFormat(value: number, format?: ValueFormat, unit?: string, displayUnit?: string): string {
  if (displayUnit) return `"${appendDisplayUnit(formatValue(value, format, undefined, { unit }), value, displayUnit, format).replaceAll('"', '""')}"`;
  if (typeof format === 'object') return `"${formatValue(value, format)}"`;
  if (!format || format === 'number') return 'General';
  if (format === 'number-grouped') return '#,##0.###############';
  if (format === 'number-1') return '0.0';
  if (format === 'number-2') return '0.00';
  if (/^percent-[012]$/.test(format)) {
    const precision = Number(format.slice(-1));
    return `0${precision ? `.${'0'.repeat(precision)}` : ''}"%"`;
  }
  return `"${formatValue(value, format, undefined, { unit }).replaceAll('"', '""')}"`;
}

function plainText(html: string): string {
  if (typeof DOMParser !== 'undefined') return new DOMParser().parseFromString(html.replace(/<br\s*\/?\s*>/gi, '\n'), 'text/html').body.textContent ?? '';
  return html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
}

function dateCell(value: unknown, type: 'date' | 'datetime'): CellObject {
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return { value: String(value), type: String };
  return { value: date, type: Date, format: type === 'date' ? 'yyyy-mm-dd' : 'yyyy-mm-dd hh:mm:ss' };
}

function valueCell(value: unknown, type: FieldDefinition['type'] | undefined, format: ValueFormat | undefined, unit?: string, displayUnit?: string): CellObject {
  if (typeof value === 'number') return { value, type: Number, format: numberFormat(value, format, unit, displayUnit) };
  if (typeof value === 'boolean') return { value, type: Boolean };
  if (type === 'semanticHtml') return { value: plainText(String(value)), type: String };
  if (type === 'date' || type === 'datetime') return dateCell(value, type);
  return { value: typeof value === 'string' ? value : JSON.stringify(value), type: String };
}

export function tableWorkbookCell(bodyColumn: TableColumn, row: AlignedTableRow, data: NamedDataSlots, missingText: string | null): Cell {
  const column = tableRowColumn(bodyColumn, row, data);
  const resolved = resolveField(column.field, data);
  const value = alignedFieldValue(column.field, data, row);
  const fallback = alignedFallback(column.field, data, row);
  if (fallback) return { value: typeof resolved.format === 'object' ? formatTableCell(fallback.raw, resolved.format) : String(fallback.raw), type: String };
  if (!hasDisplayValue(value)) return resolved.missingText === undefined ? missingText : formatValue(value, resolved.format, resolved.missingText);
  const label = tableEnumLabel(value, column.enumValues);
  if (label !== undefined) return { value: label, type: String };
  if (typeof resolved.format === 'object') return { value: formatTableCell(value, resolved.format), type: String };
  if (resolved.format && !compatibleTableFormat(value, resolved.format)) {
    return { value: formatTableCell(value, resolved.format), type: String };
  }
  const cell = valueCell(value, resolved.definition?.type, resolved.format, resolvedUnit(resolved), column.unit);
  const arrow = alignedCellArrow(column, data, row);
  const format = cell.format ?? 'General';
  const arrowFormat = column.arrowRule?.position === 'after' ? `${format}" ${arrow}"` : `"${arrow} "${format}`;
  return typeof value === 'number' && arrow ? { ...cell, format: arrowFormat } : cell;
}
