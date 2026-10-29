import type { FieldBinding, TableComponent, TableColumnNode, ValueFormatPreset } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../../../widgets/src/shared/component-data';
import { resolveField } from '../../../../widgets/src/shared/component-data';
import { projectTableRows, tableRowColumn, alignedFallback, alignedFieldValue } from '../../../../widgets/src/components/table/rows';
import { buildTableColumnLayout } from '../../../../widgets/src/components/table/columns';
import { compatibleTableFormat, formatTableCell } from '../../../../widgets/src/components/table/cell-presentation';
import { formatValue, hasDisplayValue } from '../../../../widgets/src/shared/value-format';
import { tableDataWarnings } from '../../../../widgets/src/components/table/warnings';

export function tableExportFilename(component: TableComponent): string {
  const name = component.props.toolbar?.export?.filename || component.props.title || '表格数据';
  return `${name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\.xlsx$/i, '').slice(0, 120) || '表格数据'}.xlsx`;
}

/** Numbers retain raw values; scale formats display the frozen presentation without changing them. */
function numberFormat(value: number, format?: ValueFormatPreset): string {
  if (!format || format === 'number') return 'General';
  if (format === 'number-grouped') return '#,##0.###############';
  if (format === 'number-1') return '0.0';
  if (format === 'number-2') return '0.00';
  if (format.startsWith('percent-') && !format.endsWith('signed')) {
    const precision = Number(format.slice(-1));
    return `0${precision ? `.${'0'.repeat(precision)}` : ''}"%"`;
  }
  return `"${formatValue(value, format).replaceAll('"', '""')}"`;
}

function plainText(html: string): string {
  // Parsed in an inert document; no HTML or formula is written to the workbook.
  if (typeof DOMParser !== 'undefined') return new DOMParser().parseFromString(html.replace(/<br\s*\/?\s*>/gi, '\n'), 'text/html').body.textContent ?? '';
  return html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
}

/** One column tree controls multi-level headers, aligned slot values and compound fields. */
export async function encodeTableWorkbook(component: TableComponent, data: NamedDataSlots, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  return encodeWorkbookTables([{component,data,name:'表格数据'}],signal);
}
export async function encodeWorkbookTables(tables:readonly {component:TableComponent;data:NamedDataSlots;name:string}[],signal:AbortSignal):Promise<Uint8Array<ArrayBuffer>>{
  signal.throwIfAborted();
  const ExcelJS=(await import('exceljs')).default;
  const workbook=new ExcelJS.Workbook();
  for(const table of tables)writeTableSheet(workbook.addWorksheet(table.name),table.component,table.data,signal);
  writeWarningSheet(workbook, tables);
  const buffer=await workbook.xlsx.writeBuffer();signal.throwIfAborted();return new Uint8Array(buffer);
}
function writeTableSheet(sheet:import('exceljs').Worksheet,component:TableComponent,data:NamedDataSlots,signal:AbortSignal):void{
  signal.throwIfAborted();
  if(!component.props.columns.length)throw new Error('当前条件下无可见列');

  let groupIndex = 0;
  const title = (binding: FieldBinding, given?: string) => {
    const definition = resolveField(binding, data).definition;
    const text = given ?? definition?.label ?? resolveField(binding, data).field;
    return definition && 'unit' in definition && definition.unit && !text.includes(definition.unit) ? `${text}（${definition.unit}）` : text;
  };
  const project = (nodes: TableColumnNode[]): TableColumnNode[] => nodes.map(node => {
    if (node.kind === 'group') return { ...node, children: project(node.children) };
    const label = title(node.field, node.title);
    const extras = (['secondaryField', 'badgeField'] as const).flatMap(key => node[key] ? [{ field: node[key], pinned: node.pinnedTop?.[key] }] : []);
    if (!extras.length) return { ...node, title: label };
    return { kind: 'group', id: `export-${groupIndex++}`, title: label,
      children: [{ ...node, title: title(node.field) }, ...extras.map(({field,pinned}) => ({ field, title: title(field), ...(pinned ? { pinnedTop: {field:pinned} } : {}) }))] };
  });
  const layout = buildTableColumnLayout(project(component.props.columns));
  const leadingColumns = component.props.rowNumber ? 1 : 0;
  layout.headerRows.forEach((cells, rowIndex) => {
    let columnIndex = 1 + leadingColumns;
    for (const cell of cells) {
      while (sheet.getCell(rowIndex + 1, columnIndex).isMerged) columnIndex++;
      const target = sheet.getCell(rowIndex + 1, columnIndex);
      target.value = cell.title;
      target.font = { bold: true };
      target.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      if (cell.rowspan > 1 || cell.colspan > 1) sheet.mergeCells(rowIndex + 1, columnIndex, rowIndex + cell.rowspan, columnIndex + cell.colspan - 1);
      columnIndex += cell.colspan;
    }
  });
  const headerCount = layout.headerRows.length;
  if (component.props.rowNumber) {
    const cell = sheet.getCell(1, 1);
    cell.value = component.props.rowNumber.title ?? '序号';
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    if (headerCount > 1) sheet.mergeCells(1, 1, headerCount, 1);
  }
  const rows = projectTableRows(data, component.props);
  const recoveredMissingText = tableDataWarnings(data).length ? '—' : null;
  rows.forEach((row, index) => {
    signal.throwIfAborted();
    if (leadingColumns) sheet.getCell(headerCount + index + 1, 1).value = row.kind === 'pinnedTop' ? null : (row.bodyIndex ?? index) + 1;
    layout.leaves.forEach((bodyColumn, columnIndex) => {
      const column = tableRowColumn(bodyColumn, row, data);
      const resolved = resolveField(column.field, data);
      const value = alignedFieldValue(column.field, data, row);
      const cell = sheet.getCell(headerCount + index + 1, columnIndex + 1 + leadingColumns);
      const fallback = alignedFallback(column.field, data, row);
      if (fallback) { cell.value = String(fallback.raw); return; }
      if (!hasDisplayValue(value)) { cell.value = resolved.missingText ?? recoveredMissingText; return; }
      if (resolved.format && !compatibleTableFormat(value, resolved.format)) { cell.value = formatTableCell(value, resolved.format); return; }
      if (typeof value === 'number') {
        cell.value = value; cell.numFmt = numberFormat(value, resolved.format);
      } else if (typeof value === 'boolean') cell.value = value;
      else if (resolved.definition?.type === 'semanticHtml') cell.value = plainText(String(value));
      else if (resolved.definition?.type === 'date' || resolved.definition?.type === 'datetime') {
        const date = new Date(String(value));
        if (Number.isFinite(date.getTime())) { cell.value = date; cell.numFmt = resolved.definition.type === 'date' ? 'yyyy-mm-dd' : 'yyyy-mm-dd hh:mm:ss'; }
        else cell.value = String(value);
      } else cell.value = typeof value === 'string' ? value : JSON.stringify(value);
    });
  });
  sheet.columns.forEach((column, index) => { column.width = Math.min(60, Math.max(14, (index < leadingColumns ? component.props.rowNumber?.width ?? 64 : layout.leaves[index - leadingColumns]?.width ?? 150) / 7)); });
  sheet.views = [{ state: 'frozen', ySplit: headerCount }];

}

function writeWarningSheet(workbook: import('exceljs').Workbook, tables: readonly {data: NamedDataSlots; name: string}[]): void {
  const warnings = tables.flatMap(table => tableDataWarnings(table.data).map(warning => [table.name, warning.sourceId, warning.message, warning.count]));
  if (!warnings.length) return;
  let name = '数据异常说明', suffix = 1;
  while (workbook.getWorksheet(name)) name = `数据异常说明${suffix++}`;
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(['本文件包含经过容错整理的可用数据，可能存在缺项；空值显示为 —。']);
  sheet.addRow(['数据表', '数据源', '异常及处理方式', '次数']);
  sheet.addRows(warnings);
  sheet.columns = [{width:24}, {width:30}, {width:68}, {width:12}];
  sheet.getRow(1).font = {bold:true,color:{argb:'FF8A5700'}};
  sheet.getRow(2).font = {bold:true};
  sheet.views = [{state:'frozen',ySplit:2}];
}

export async function downloadTableWorkbook(component: TableComponent, data: NamedDataSlots, signal: AbortSignal): Promise<void> {
  const bytes = await encodeTableWorkbook(component, data, signal);
  await downloadWorkbookBytes(component,bytes,signal);
}
export async function downloadWorkbookBytes(component:TableComponent,bytes:Uint8Array<ArrayBuffer>,signal:AbortSignal):Promise<void>{
  signal.throwIfAborted();
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url; link.download = tableExportFilename(component); link.hidden = true;
  document.body.appendChild(link);
  try { signal.throwIfAborted(); link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
