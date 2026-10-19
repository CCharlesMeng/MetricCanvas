import { planPdfPages } from './report-pdf-pagination';
import { reportScheduler } from './report-scheduler';
import { createPdfWorker } from './report-pdf-worker';
import { prepareReportCapture } from './report-pdf-capture';

import { abortable, copyPdfView, freezeGradientText, pdfStyles } from './report-capture-view';

/** Browser-only image PDF. All pages must succeed before initiating a download. */
export async function downloadReportPdf(target: HTMLElement, signal: AbortSignal, filename = '经营分析报告.pdf', progress: (completed:number,total:number) => void = () => {}, scale: 2 | 3 | 4 = 2): Promise<{ pageCount: number }> {
  signal.throwIfAborted();
  const controller=new AbortController();
  const abort=()=>controller.abort(signal.reason);
  signal.addEventListener('abort',abort,{once:true});
  let timer:ReturnType<typeof setTimeout>;
  const touch=()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>controller.abort(Error('报告生成超过60秒未取得进展')),60_000);
  };
  let worker:ReturnType<typeof createPdfWorker>|undefined;
  try {
    touch();
    worker=createPdfWorker(controller.signal);
    return await encodeReport(target,controller.signal,filename,(done,total)=>{touch();progress(done,total);},reportScheduler(controller.signal),worker,scale);
  } finally {
    clearTimeout(timer!);signal.removeEventListener('abort',abort);worker?.dispose();
  }
}

async function encodeReport(target:HTMLElement,signal:AbortSignal,filename:string,progress:(completed:number,total:number)=>void,pause:()=>Promise<void>|undefined,worker:ReturnType<typeof createPdfWorker>,scale:2|3|4):Promise<{pageCount:number}> {
  signal.throwIfAborted();
  const pageWidth = target.getBoundingClientRect().width;
  const landscape = !!target.querySelector('[data-export-orientation="landscape"]');
  const paperWidth = landscape ? 297 : 210;
  const paperHeight = landscape ? 210 : 297;
  const pageHeight = Math.floor(pageWidth * paperHeight / paperWidth);
  if (!Number.isFinite(pageWidth) || pageWidth <= 0) throw new Error('报告尺寸无效，无法生成 PDF');
  signal.throwIfAborted();
  const owner = target.ownerDocument;
  const document = owner.implementation.createHTMLDocument('报告 PDF 编码视图');
  document.documentElement.lang = owner.documentElement.lang || 'zh-CN';
  const charset = document.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const style = document.createElement('style');
  style.textContent = pdfStyles;
  const base = document.createElement('base');
  base.href = owner.baseURI;
  document.head.prepend(charset, base);
  document.head.append(style);
  document.body.append(await copyPdfView(target,pause));

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
    await freezeGradientText(view, signal,pause,scale);
    signal.throwIfAborted();
    const origin = view.getBoundingClientRect();
    const height = Math.ceil(origin.height);
    // Preserve the prepared layout exactly. Paper boundaries never move DOM blocks or add rows.
    const pages = planPdfPages(height, pageHeight);
    await worker.request({kind:'start',spec:{landscape,paperWidth,paperHeight,pageWidth,pageCount:pages.length}});
    progress(0,pages.length);
    if (Math.ceil(pageWidth * scale) > 8192) throw Error('PDF 清晰度超出截图宽度支持范围，请降低 scale');
    // Render several pages together when safe: html2canvas reparses the entire DOM per call.
    // Bound both dimensions and area so long reports never allocate a report-sized canvas.
    const maxCaptureHeight = Math.floor(Math.min(8192 / scale, 16_777_216 / (Math.ceil(pageWidth * scale) * scale)));
    const capture = await abortable(prepareReportCapture(view,{scale,width:pageWidth,windowHeight:pageHeight},pause),signal);
    let encoding: Promise<import('./report-pdf-protocol').PdfWorkerReply> | undefined;
    try {
      for (let top = 0; top < height; top += maxCaptureHeight) {
        signal.throwIfAborted();
        const bottom = Math.min(top + maxCaptureHeight, height);
        const canvas = await abortable(capture.render(top, bottom - top),signal);
        try {
          // One bitmap may be encoding while the main thread prepares the following block.
          if (encoding) await encoding;
          signal.throwIfAborted();
          const bitmap = await createImageBitmap(canvas);
          const slices = pages.flatMap((page, index) => {
            const start = Math.max(page.top, top), end = Math.min(page.bottom, bottom);
            return end <= start ? [] : [{
              page: index + 1,
              sourceTop: (start - top) * scale,
              sourceBottom: (end - top) * scale,
              topMm: (start - page.top) * paperWidth / pageWidth,
              heightMm: (end - start) * paperWidth / pageWidth,
              complete: end === page.bottom
            }];
          });
          try {
            encoding = worker.request({kind:'bitmap',bitmap,slices},[bitmap]).then(reply => {
              if (reply.kind === 'ready') progress(reply.completed,pages.length);
              return reply;
            });
            // A failure while the next block renders must not become an unhandled rejection.
            void encoding.catch(() => {});
          } catch (cause) { bitmap.close(); throw cause; }
        } finally {canvas.width=0;canvas.height=0;}
        const pending = pause(); if (pending) await pending;
      }
      if (encoding) await encoding;
    } finally { capture.dispose(); }
    signal.throwIfAborted();
    const file = await worker.request({kind:'finish'});
    if (file.kind !== 'file') throw Error('后台 PDF 未返回文件');
    const url = URL.createObjectURL(new Blob([file.buffer],{type:'application/pdf'}));
    try {
      const downloadOwner = owner.defaultView?.frameElement?.ownerDocument ?? owner;
      const link = downloadOwner.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      downloadOwner.body.append(link);
      try { link.click(); } finally { link.remove(); }
    } finally {
      // Keep the Blob alive long enough for the browser to begin reading the download.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
    return { pageCount: pages.length };
  } finally {
    for(const image of frame.contentDocument?.querySelectorAll<HTMLImageElement>('[data-pdf-gradient-text]')??[])URL.revokeObjectURL(image.src);
    frame.remove();
  }
}
