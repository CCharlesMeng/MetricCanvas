import type { WorkbookSheet } from './workbook-sheet';

const EXCEL_SHEET_ROWS = 1_048_576;

// A hierarchy may contain multi-row child headers among the data rows.
function pageEnd(sheet: WorkbookSheet, start: number, capacity: number): number {
  const limit = start + capacity;
  if (limit >= sheet.data.length) return sheet.data.length;
  let mergedUntil = start, boundary = start;
  for (let row = start; row < limit; row++) {
    for (const cell of sheet.data[row]!) {
      if (cell && typeof cell === 'object' && 'rowSpan' in cell && cell.rowSpan) {
        mergedUntil = Math.max(mergedUntil, row + cell.rowSpan);
      }
    }
    if (row + 1 >= mergedUntil) boundary = row + 1;
  }
  if (boundary === start) throw new Error('合并表头超出 Excel 单工作表行数');
  return boundary;
}

export function paginateWorkbookSheets(sheets: WorkbookSheet[]): WorkbookSheet[] {
  const names = new Set(sheets.map(sheet => sheet.sheet.toLowerCase()));
  return sheets.flatMap(sheet => {
    if (sheet.data.length <= EXCEL_SHEET_ROWS) return [sheet];
    const headers = sheet.data.slice(0, sheet.stickyRowsCount);
    const capacity = EXCEL_SHEET_ROWS - headers.length;
    const pages: WorkbookSheet[] = [];
    let name = sheet.sheet, nextPart = 2;
    for (let start = headers.length; start < sheet.data.length;) {
      const end = pageEnd(sheet, start, capacity);
      pages.push({ ...sheet, sheet: name, data: headers.concat(sheet.data.slice(start, end)) });
      start = end;
      if (start === sheet.data.length) break;
      do {
        const suffix = ` (${nextPart++})`;
        name = sheet.sheet.slice(0, 31 - suffix.length) + suffix;
      } while (names.has(name.toLowerCase()));
      names.add(name.toLowerCase());
    }
    return pages;
  });
}
