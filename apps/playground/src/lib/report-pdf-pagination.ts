export interface PdfBlock { top: number; bottom: number }
export interface PdfTable extends PdfBlock { headerEnd: number; headerHeight: number }
export interface PdfPage extends PdfBlock { headerIndex?: number; headerHeight: number }

/** Plan bounded screenshots, keeping rows/charts intact and reserving repeated table headers. */
export function planPdfPages(height: number, pageHeight: number, blocks: PdfBlock[], tables: PdfTable[], breaks: number[]): PdfPage[] {
  const pages: PdfPage[] = [];
  const epsilon = 0.5;
  let top = 0;
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(pageHeight) || pageHeight <= 0) {
    throw new Error('报告尺寸无效，无法生成 PDF');
  }
  while (top < height - epsilon) {
    const headerIndex = tables.findIndex(table => top >= table.headerEnd - epsilon && top < table.bottom - epsilon);
    const headerHeight = headerIndex < 0 ? 0 : tables[headerIndex].headerHeight;
    let bottom = Math.min(height, top + pageHeight - headerHeight);
    for (const point of breaks) if (point > top + epsilon && point < bottom) bottom = point;
    // Moving a break before a row can also put it inside a heading's keep-with-next range.
    let changed = true;
    while (changed) {
      changed = false;
      for (const block of blocks) {
        if (block.top < bottom - epsilon && block.bottom > bottom + epsilon) {
          if (block.top <= top + epsilon) throw new Error('单个表格行、图表或正文块超过 A4 页高，请调整后导出');
          bottom = block.top;
          changed = true;
        }
      }
    }
    if (bottom <= top + epsilon) throw new Error('报告内容无法按 A4 分页');
    pages.push({ top, bottom, headerHeight, ...(headerIndex < 0 ? {} : { headerIndex }) });
    top = bottom;
  }
  return pages;
}
