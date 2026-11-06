import type { FieldBinding, TableComponent, TableColumnNode } from '@metriccanvas/page/internal';
import type { CellObject, SheetData } from 'write-excel-file/universal';
import type { NamedDataSlots } from '../../../../widgets/src/shared/component-data';
import { resolveField } from '../../../../widgets/src/shared/component-data';
import { buildTableColumnLayout, type TableColumnLayout } from '../../../../widgets/src/components/table/columns';
import { projectTableRows } from '../../../../widgets/src/components/table/rows';
import { tableDataWarnings } from '../../../../widgets/src/components/table/warnings';
import { tableWorkbookCell } from './workbook-cell';

export interface WorkbookTable { component: TableComponent; data: NamedDataSlots; name: string }
export interface WorkbookSheet {
  sheet: string;
  data: SheetData;
  columns: Array<{ width: number }>;
  stickyRowsCount: number;
}

function columnTitle(binding: FieldBinding, data: NamedDataSlots, given?: string, explicitUnit?: string): string {
  const resolved = resolveField(binding, data);
  const definition = resolved.definition;
  const text = given ?? definition?.label ?? resolved.field;
  const unit = explicitUnit ?? (definition && 'unit' in definition ? definition.unit : undefined);
  return unit && !text.includes(unit) ? `${text}（${unit}）` : text;
}

function exportColumns(nodes: TableColumnNode[], data: NamedDataSlots): TableColumnNode[] {
  let groupIndex = 0;
  return nodes.map(node => {
    if (node.kind === 'group') return { ...node, children: exportColumns(node.children, data) };
    const title = columnTitle(node.field, data, node.title, node.unit);
    const extras = (['secondaryField', 'badgeField'] as const)
      .flatMap(key => node[key] ? [{ field: node[key], pinned: node.pinnedTop?.[key] }] : []);
    if (!extras.length) return { ...node, title };
    return { kind: 'group', id: `export-${groupIndex++}`, title,
      children: [{ ...node, title: columnTitle(node.field, data, undefined, node.unit) }, ...extras.map(({ field, pinned }) => ({
        field, title: columnTitle(field, data), ...(pinned ? { pinnedTop: { field: pinned } } : {})
      }))] };
  });
}

function placeHeader(rows: SheetData, row: number, column: number, cell: CellObject, rowspan: number, colspan: number): void {
  for (let y = row; y < row + rowspan; y++) {
    for (let x = column; x < column + colspan; x++) rows[y]![x] = null;
  }
  rows[row]![column] = { ...cell, rowSpan: rowspan, columnSpan: colspan, fontWeight: 'bold', align: 'center', alignVertical: 'center', wrap: true };
}

function headerRows(layout: TableColumnLayout, component: TableComponent): SheetData {
  const leading = component.props.rowNumber ? 1 : 0;
  const rows: SheetData = Array.from({ length: layout.headerRows.length }, () => Array(layout.leaves.length + leading));
  if (component.props.rowNumber) placeHeader(rows, 0, 0, { value: component.props.rowNumber.title ?? '序号' }, rows.length, 1);
  layout.headerRows.forEach((cells, row) => {
    let column = leading;
    for (const cell of cells) {
      while (rows[row]![column] === null) column++;
      placeHeader(rows, row, column, { value: cell.title }, cell.rowspan, cell.colspan);
      column += cell.colspan;
    }
  });
  return rows;
}

export function tableWorkbookSheet(table: WorkbookTable, signal: AbortSignal): WorkbookSheet {
  signal.throwIfAborted();
  const { component, data, name } = table;
  if (!component.props.columns.length) throw new Error('当前条件下无可见列');
  const layout = buildTableColumnLayout(exportColumns(component.props.columns, data));
  const rows = headerRows(layout, component);
  const stickyRowsCount = rows.length;
  const missingText = tableDataWarnings(data).length ? '—' : null;
  projectTableRows(data, component.props).forEach((row, index) => {
    signal.throwIfAborted();
    const cells = layout.leaves.map(column => tableWorkbookCell(column, row, data, missingText));
    if (component.props.rowNumber) cells.unshift(row.kind === 'pinnedTop' ? null : (row.bodyIndex ?? index) + 1);
    rows.push(cells);
  });
  const widths = layout.leaves.map(column => column.width ?? 150);
  if (component.props.rowNumber) widths.unshift(component.props.rowNumber.width ?? 64);
  return { sheet: name, data: rows, stickyRowsCount,
    columns: widths.map(width => ({ width: Math.min(60, Math.max(14, width / 7)) })) };
}

export function warningWorkbookSheet(tables: readonly WorkbookTable[], sheets: readonly WorkbookSheet[]): WorkbookSheet | undefined {
  const warnings = tables.flatMap(table => tableDataWarnings(table.data).map(warning => [table.name, warning.sourceId, warning.message, warning.count]));
  if (!warnings.length) return undefined;
  const names = new Set(sheets.map(sheet => sheet.sheet));
  let name = '数据异常说明', suffix = 1;
  while (names.has(name)) name = `数据异常说明${suffix++}`;
  return { sheet: name, stickyRowsCount: 2, columns: [24, 30, 68, 12].map(width => ({ width })), data: [
    [{ value: '本文件包含经过容错整理的可用数据，可能存在缺项；空值显示为 —。', fontWeight: 'bold', textColor: '#8A5700' }],
    ['数据表', '数据源', '异常及处理方式', '次数'].map(value => ({ value, fontWeight: 'bold' })),
    ...warnings
  ] };
}
