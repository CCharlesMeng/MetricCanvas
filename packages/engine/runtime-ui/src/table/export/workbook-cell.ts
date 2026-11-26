import { absoluteDisplayText } from '../../../../widgets/src/shared/absolute-display-limit';
import { tableValueColor } from '../../../../widgets/src/shared/value-color';
import type { FieldDefinition, FieldValue, TableColumn, TimeValueFormat } from '@metriccanvas/page/internal';
import type { Cell, CellObject } from 'write-excel-file/universal';
import type { NamedDataSlots } from '../../../../widgets/src/shared/component-data';
import { resolveField } from '../../../../widgets/src/shared/component-data';
import { alignedFallback, alignedFieldValue, alignedCellText, alignedCellArrow, tableRowColumn, type AlignedTableRow } from '../../../../widgets/src/components/table/rows';
import { compatibleTableFormat, formatTableCell } from '../../../../widgets/src/components/table/cell-presentation';
import { tableEnumLabel } from '../../../../widgets/src/components/table/enum-values';
import { formatValue, hasDisplayValue } from '../../../../widgets/src/shared/value-format';
import { literalWorkbookFormat, numericWorkbookCell } from './workbook-numeric-cell';

function plainText(html: string): string {
  if (typeof DOMParser !== 'undefined') return new DOMParser().parseFromString(html.replace(/<br\s*\/?\s*>/gi, '\n'), 'text/html').body.textContent ?? '';
  return html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
}

function dateCell(value: unknown, type: 'date' | 'datetime'): CellObject {
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return { value: String(value), type: String };
  return { value: date, type: Date, format: type === 'date' ? 'yyyy-mm-dd' : 'yyyy-mm-dd hh:mm:ss' };
}

function valueCell(value: unknown, type: FieldDefinition['type'] | undefined): CellObject {
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
  if (typeof value === 'number' && absoluteDisplayText(value, column.absoluteDisplayLimit) !== undefined) return limitedNumberCell(column, row, data, value);
  if (typeof resolved.format === 'object') return timeCell(value, resolved.format, alignedCellArrow(column, data, row), column.arrowRule?.position === 'after');
  if (resolved.format && !compatibleTableFormat(value, resolved.format)) {
    return { value: formatTableCell(value, resolved.format), type: String };
  }
  if (typeof value === 'number') return numericWorkbookCell(value, resolved, column.unit, alignedCellArrow(column, data, row), column.arrowRule?.position === 'after', column.absoluteDisplayLimit);
  return valueCell(value, resolved.definition?.type);
}

/** Time exports are text, so authored arrows join the same text instead of a numeric format. */
function timeCell(value: FieldValue, format: TimeValueFormat, arrow: string, after: boolean): CellObject {
  const text = formatTableCell(value, format);
  return { value: !arrow ? text : after ? `${text} ${arrow}` : `${arrow} ${text}`, type: String };
}

/** Like adaptive formats, freeze the displayed text in a number format and retain the raw value. */
function limitedNumberCell(column: TableColumn, row: AlignedTableRow, data: NamedDataSlots, value: number): CellObject {
  const text = alignedCellText(column.field, data, row, column.enumValues, column.unit, column.absoluteDisplayLimit);
  const arrow = alignedCellArrow(column, data, row);
  const display = !arrow ? text : column.arrowRule?.position === 'after' ? `${text} ${arrow}` : `${arrow} ${text}`;
  const color = tableValueColor(value, column);
  return { value, type: Number, format: literalWorkbookFormat(display), textColor: color === 'green' ? '#52C41A' : color === 'red' ? '#F5222D' : undefined };
}
