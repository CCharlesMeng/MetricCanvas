export interface PdfBlock { top: number; bottom: number }
export interface PdfPage extends PdfBlock { headerHeight: number }

/** Contiguous paper slices of the original layout; no content-aware reflow or inserted space. */
export function planPdfPages(height: number, pageHeight: number): PdfPage[] {
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(pageHeight) || pageHeight < 1) {
    throw new Error('报告尺寸无效，无法生成 PDF');
  }
  const pages: PdfPage[] = [];
  const sliceHeight = Math.floor(pageHeight);
  for (let top = 0; top < height; top += sliceHeight) {
    pages.push({ top, bottom: Math.min(height, top + sliceHeight), headerHeight: 0 });
  }
  return pages;
}
