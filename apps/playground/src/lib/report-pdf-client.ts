import { planPdfPages } from './report-pdf-pagination';

const pageWidth = 718; // 190 mm at approximately 96 CSS pixels per inch.
const pageHeight = Math.floor(pageWidth * 277 / 190);

/** Preserve the prepared view's appearance when moving out of engine/shadow-root styles. */
function copyPdfView(target: HTMLElement): HTMLElement {
  const copy = target.cloneNode(true) as HTMLElement;
  const originals = [target, ...target.querySelectorAll<HTMLElement>('*')];
  const copies = [copy, ...copy.querySelectorAll<HTMLElement>('*')];
  const properties = ['display', 'box-sizing', 'width', 'max-width', 'min-width', 'overflow',
    'position', 'top', 'right', 'bottom', 'left', 'z-index', 'isolation', 'transform', 'object-fit',
    'color', 'background-color', 'background-image', 'background-size', 'background-position', 'background-clip',
    '-webkit-background-clip', '-webkit-text-fill-color', '-webkit-text-stroke-width',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
    'text-align', 'text-decoration', 'white-space', 'word-break', 'overflow-wrap', 'vertical-align',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'border-collapse', 'border-spacing',
    'grid-template-columns', 'grid-column', 'grid-row', 'gap', 'align-items', 'justify-content',
    'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'opacity'];
  originals.forEach((element, index) => {
    const computed = getComputedStyle(element);
    const clone = copies[index];
    clone.removeAttribute('style');
    clone.style.cssText = properties.map(name => `${name}:${computed.getPropertyValue(name)}`).join(';');
    // html2canvas does not model CSS isolation; make existing positioned isolated layers explicit.
    if (computed.isolation === 'isolate' && computed.position !== 'static' && computed.zIndex === 'auto') clone.style.zIndex = '0';
    if (element.matches('.report-header, .report-cover')) clone.style.minHeight = computed.minHeight;
    // Frozen ECharts images remain absolutely positioned; their containing block must keep its height.
    if (element.matches('[data-export-chart]')) {
      const rect = element.getBoundingClientRect();
      // Absolute images provide no intrinsic flex size in the copied document.
      const height = Math.max(rect.height, ...Array.from(element.querySelectorAll('img')).map(image => image.getBoundingClientRect().bottom - rect.top));
      clone.style.height = `${height}px`;
      clone.style.minHeight = `${height}px`;
      clone.style.flex = 'none';
    }
    // Static charts need their measured dimensions; other blocks must fragment naturally.
    if (element.tagName === 'IMG') {
      clone.style.width = `${element.getBoundingClientRect().width}px`;
      clone.style.height = `${element.getBoundingClientRect().height}px`;
    }
    for (const attribute of Array.from(clone.attributes)) {
      if (attribute.name.startsWith('on')) clone.removeAttribute(attribute.name);
    }
  });
  copy.style.width = `${pageWidth}px`;
  copy.style.padding = '0';
  return copy;
}

const pdfStyles = `
  html,body { margin:0; padding:0; background:white; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  * { animation:none!important; transition:none!important; }
  table { height:auto!important; } thead { display:table-header-group!important; }
  .report-cover { margin:0!important; width:100%!important; }
  .short-bar h1,.short-bar .as-of.inline { color:#2e3295!important; background:none!important;
    -webkit-text-fill-color:#2e3295!important; -webkit-text-stroke-width:0!important; }
  .section-grid,.cell { display:block!important; width:100%!important; }
  .page-section { margin-bottom:6mm!important; }
`;

/** Browser-only image PDF. All pages must succeed before initiating a download. */
export async function downloadReportPdf(target: HTMLElement, signal: AbortSignal, filename = '经营分析报告.pdf'): Promise<{ pageCount: number }> {
  signal.throwIfAborted();
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  signal.throwIfAborted();
  const owner = target.ownerDocument;
  const document = owner.implementation.createHTMLDocument('报告 PDF 编码视图');
  document.documentElement.lang = owner.documentElement.lang || 'zh-CN';
  const charset = document.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const style = document.createElement('style');
  style.textContent = pdfStyles;
  document.head.prepend(charset);
  document.head.append(style);
  document.body.append(copyPdfView(target));

  const frame = owner.createElement('iframe');
  frame.dataset.reportPdfFrame = '';
  frame.title = '报告 PDF 编码视图';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.style.cssText = `position:fixed;left:-100000px;top:0;width:${pageWidth}px;height:${pageHeight}px;border:0;`;

  try {
    const loaded = new Promise<void>(resolve => frame.addEventListener('load', () => resolve(), { once: true }));
    frame.srcdoc = '<!doctype html>' + document.documentElement.outerHTML;
    owner.body.append(frame);
    await abortable(loaded, signal);
    const view = frame.contentDocument?.querySelector<HTMLElement>('[data-export-view]');
    if (!view) throw new Error('无法创建报告 PDF 编码视图');
    await abortable(view.ownerDocument.fonts.ready, signal);
    await abortable(Promise.all(Array.from(view.querySelectorAll('img')).map(image => image.decode())), signal);
    signal.throwIfAborted();
    const origin = view.getBoundingClientRect();
    const height = Math.ceil(origin.height);
    const blocks = Array.from(view.querySelectorAll<HTMLElement>('tr,p,li,h1,h2,h3,.report-cover,[data-export-chart]')).map(element => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top - origin.top, bottom: Math.min(height, rect.bottom - origin.top + (element.matches('h1,h2,h3') ? 48 : 0)) };
    }).filter(block => block.bottom > block.top);
    const headers = Array.from(view.querySelectorAll<HTMLTableSectionElement>('thead'));
    const tables = headers.map(header => {
      const rect = header.getBoundingClientRect();
      const table = header.closest('table')!.getBoundingClientRect();
      return { top: table.top - origin.top, bottom: table.bottom - origin.top, headerEnd: rect.bottom - origin.top, headerHeight: rect.height };
    });
    const breaks = Array.from(view.querySelectorAll<HTMLElement>('.page-section')).filter(section => section.querySelector('[data-export-chart]'))
      .map(section => section.getBoundingClientRect().top - origin.top);
    const pages = planPdfPages(height, pageHeight, blocks, tables, breaks);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const headerImages = new Map<number, string>();
    const options = { scale: 2, backgroundColor: '#ffffff', logging: false, scrollX: 0, scrollY: 0, windowWidth: pageWidth, windowHeight: pageHeight };
    for (const [index, page] of pages.entries()) {
      signal.throwIfAborted();
      if (index) pdf.addPage();
      if (page.headerIndex !== undefined) {
        const header = headers[page.headerIndex];
        let image = headerImages.get(page.headerIndex);
        if (!image) {
          const canvas = await html2canvas(header, options);
          try { signal.throwIfAborted(); image = canvas.toDataURL('image/png'); }
          finally { canvas.width = 0; canvas.height = 0; }
          headerImages.set(page.headerIndex, image);
        }
        const rect = header.getBoundingClientRect();
        pdf.addImage(image, 'PNG', 10 + (rect.left - origin.left) * 190 / pageWidth, 10, rect.width * 190 / pageWidth, rect.height * 190 / pageWidth);
      }
      // html2canvas has no AbortSignal API: let the current render finish before removing its DOM.
      // Only the current A4 slice gets a canvas; the full report never becomes a giant bitmap.
      const canvas = await html2canvas(view, { ...options, y: page.top, width: pageWidth, height: page.bottom - page.top });
      try {
        signal.throwIfAborted();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10 + page.headerHeight * 190 / pageWidth, 190, (page.bottom - page.top) * 190 / pageWidth);
      } finally { canvas.width = 0; canvas.height = 0; }
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(`${index + 1} / ${pages.length}`, 105, 292, { align: 'center' });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    signal.throwIfAborted();
    const url = URL.createObjectURL(pdf.output('blob'));
    try {
      const link = owner.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
    } finally {
      // Keep the Blob alive long enough for the browser to begin reading the download.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
    return { pageCount: pages.length };
  } finally { frame.remove(); }
}

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('PDF 导出已取消', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
