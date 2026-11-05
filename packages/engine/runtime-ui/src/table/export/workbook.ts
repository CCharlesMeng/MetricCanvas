import type { TableComponent } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../../../widgets/src/shared/component-data';
import { tableWorkbookSheet, warningWorkbookSheet, type WorkbookTable } from './workbook-sheet';

export function tableExportFilename(component: TableComponent): string {
  const name = component.props.toolbar?.export?.filename || component.props.title || '表格数据';
  return `${name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\.xlsx$/i, '').slice(0, 120) || '表格数据'}.xlsx`;
}

export async function encodeTableWorkbook(component: TableComponent, data: NamedDataSlots, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  return encodeWorkbookTables([{ component, data, name: '表格数据' }], signal);
}

function worksheetName(name: string): string {
  if (name === 'History' || /[*?:/\\[\]]/.test(name) || /(^')|('$)/.test(name)) {
    throw new Error(`Invalid worksheet name: ${name}`);
  }
  return name.slice(0, 31);
}

function workbookSheets(tables: readonly WorkbookTable[], signal: AbortSignal) {
  const names = new Set<string>();
  return tables.map(table => {
    const name = worksheetName(table.name);
    const key = name.toLowerCase();
    if (names.has(key)) throw new Error(`Worksheet name already exists: ${name}`);
    names.add(key);
    return tableWorkbookSheet({ ...table, name }, signal);
  });
}

export async function encodeWorkbookTables(tables: readonly WorkbookTable[], signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  signal.throwIfAborted();
  const { default: writeExcelFile } = await import('write-excel-file/universal');
  const sheets = workbookSheets(tables, signal);
  const warnings = warningWorkbookSheet(tables, sheets);
  if (warnings) sheets.push(warnings);
  const blob = await writeExcelFile(sheets, { fontFamily: 'Calibri', fontSize: 11 }).toBlob();
  const buffer = await blob.arrayBuffer();
  signal.throwIfAborted();
  return new Uint8Array(buffer);
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
