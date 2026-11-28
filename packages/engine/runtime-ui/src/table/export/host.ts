import type { FieldBinding, TableColumn, TableComponent, ValueFormat } from '@metriccanvas/page/internal';
import {
  alignedCellArrow,
  alignedCellText,
  alignedFieldValue,
  buildTableColumnLayout,
  parseSemanticHtml,
  projectTableRows,
  resolveField,
  semanticDataPresentation,
  semanticHtmlFieldPresentation,
  tableDataWarnings,
  tableRowColumn,
  type AlignedTableRow,
  type NamedDataSlots,
  type SemanticHtmlNode
} from '../../../../widgets/src/internal';
import { abortable } from './prepare';
import { downloadTableWorkbook, tableExportFilename } from './workbook';
import { EXCEL_SHEET_ROWS } from './workbook-pages';
import { exportColumns, headerRows } from './workbook-sheet';

export interface McExportSheet {
  name: string;
  header: string[][];
  rows: Array<Array<string | number | null>>;
}

export interface McExportRequest {
  fileName: string;
  format: 'xlsx';
  sheets: [McExportSheet];
  meta: { componentId: string; pageId: string; rowCount: number };
  signal: AbortSignal;
}

export type McExportResult =
  | { status: 'submitted'; taskId?: string }
  | { status: 'split'; fileCount?: number }
  | { status: 'cancelled' };

export type TableExportHandler = (request: McExportRequest) => Promise<McExportResult>;
export const TABLE_EXPORT_HANDLER = Symbol('metriccanvas.tableExportHandler');

function inlineText(nodes: SemanticHtmlNode[], format?: ValueFormat): string {
  return nodes.map((node, index) => {
    if (node.type === 'text') return node.value;
    if (node.type === 'data') return semanticDataPresentation(node, format).text;
    if (node.tag === 'br') return '\n';
    const previous = nodes[index - 1];
    const paragraphGap = node.tag === 'p' && previous?.type === 'element' && previous.tag === 'p';
    return (paragraphGap ? ' ' : '') + inlineText(node.children, format);
  }).join('');
}

function displayCell(bodyColumn: TableColumn, row: AlignedTableRow, data: NamedDataSlots): string {
  const column = tableRowColumn(bodyColumn, row, data);
  const field = column.field;
  const semantic = semanticHtmlFieldPresentation(resolveField(field, data), alignedFieldValue(field, data, row));
  if (semantic) {
    const parsed = parseSemanticHtml(semantic.source);
    return parsed.ok ? inlineText(parsed.document.nodes, semantic.format) : '内容格式不受支持';
  }
  const text = alignedCellText(field, data, row, column.enumValues, column.unit, column.absoluteDisplayLimit);
  const arrow = alignedCellArrow(column, data, row);
  if (!arrow) return text;
  return column.arrowRule?.position === 'after' ? text + ' ' + arrow : arrow + ' ' + text;
}

// Screen labels use the declared title; units and scaling already appear in the display text.
function displayTitle(binding: FieldBinding, data: NamedDataSlots, given?: string): string {
  const field = resolveField(binding, data);
  return given ?? field.definition?.label ?? field.field;
}

function singleDisplaySheet(component: TableComponent, data: NamedDataSlots, signal: AbortSignal): McExportSheet | undefined {
  if (tableDataWarnings(data).length) return;
  const layout = buildTableColumnLayout(exportColumns(component.props.columns, data, displayTitle));
  const capacity = EXCEL_SHEET_ROWS - layout.headerRows.length;
  if ((data.main?.snapshot.rows.length ?? 0) > capacity) return;
  const projected = projectTableRows(data, component.props);
  if (projected.length > capacity) return; // Includes a possible pinned summary.
  const header = headerRows(layout, component).map(row => row.map(cell =>
    cell ? String(cell.value) : ''));
  const rows = projected.map((row, index) => {
    signal.throwIfAborted();
    const cells: McExportSheet['rows'][number] = layout.leaves.map(column => displayCell(column, row, data));
    if (component.props.rowNumber) cells.unshift(row.kind === 'pinnedTop' ? null : (row.bodyIndex ?? index) + 1);
    return cells;
  });
  return { name: '表格数据', header, rows };
}

export async function deliverTableExport(component: TableComponent, data: NamedDataSlots, signal: AbortSignal, pageId: string, handler?: TableExportHandler): Promise<void> {
  signal.throwIfAborted();
  const sheet = handler && singleDisplaySheet(component, data, signal);
  if (!handler || !sheet) return downloadTableWorkbook(component, data, signal);
  const request: McExportRequest = {
    fileName: tableExportFilename(component).slice(0, -5),
    format: 'xlsx', sheets: [sheet],
    meta: { pageId, componentId: component.id, rowCount: sheet.rows.length }, signal
  };
  await abortable(handler(request), signal);
}
