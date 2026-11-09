import type { SheetData } from 'write-excel-file/universal';
import { projectTableRows } from '../../../../widgets/src/components/table/rows';
import { tableWorkbookSheet, type WorkbookSheet, type WorkbookTable } from './workbook-sheet';

/** Child blocks share a worksheet with their parent and start one physical column later. */
export function hierarchyWorkbookSheet(table: WorkbookTable, signal: AbortSignal): WorkbookSheet {
  const sheet = tableWorkbookSheet(table, signal);
  const children = table.children!;
  if (children.length !== (table.data.main?.snapshot.rows?.length ?? 0)) throw new Error('父子导出实例数量不一致');
  const rows = projectTableRows(table.data, table.component.props);
  const data = sheet.data.slice(0, sheet.stickyRowsCount);
  rows.forEach((row, index) => {
    signal.throwIfAborted();
    data.push(sheet.data[sheet.stickyRowsCount + index]!);
    if (row.kind === 'pinnedTop') return;
    appendChild(data, sheet.columns, children[row.bodyIndex!]!, signal);
  });
  return { ...sheet, data };
}

function appendChild(data: SheetData, columns: WorkbookSheet['columns'], table: WorkbookTable, signal: AbortSignal): void {
  const child = tableWorkbookSheet(table, signal);
  for (const row of child.data) data.push([null, ...row]);
  if (child.data.length === child.stickyRowsCount) {
    data.push([null, { value: '暂无数据', columnSpan: child.columns.length, align: 'center' }]);
  }
  child.columns.forEach((column, index) => {
    const position = index + 1;
    columns[position] = { width: Math.max(columns[position]?.width ?? 0, column.width) };
  });
}
