import { jsPDF } from 'jspdf';
import { reuseNativePng, prepareNativePng } from './report-pdf-png';
import type { PdfDocumentSpec, PdfWorkerReply, PdfWorkerRequest } from './report-pdf-protocol';

// This entry is bundled into an inline classic Worker for npm and single-file HTML consumers.
const port = globalThis as unknown as {
  onmessage: (event: MessageEvent<PdfWorkerRequest>) => void;
  postMessage(message: PdfWorkerReply, transfer?: Transferable[]): void;
};
let pdf: jsPDF | undefined, spec: PdfDocumentSpec | undefined, completed = 0, currentPage = 1;
let processing = false;
port.onmessage = async ({ data }) => {
  if (processing) { port.postMessage({id:data.id,kind:'error',message:'PDF Worker 收到并行请求'}); return; }
  processing = true;
  try {
    if (data.kind === 'start') {
      if (pdf) throw Error('PDF Worker 已初始化');
      spec = data.spec;
      pdf = new jsPDF({unit:'mm',format:'a4',orientation:spec.landscape?'landscape':'portrait',compress:true});
      reuseNativePng(pdf);
    } else if (data.kind === 'bitmap') {
      try {
        if (!pdf || !spec) throw Error('PDF Worker 未初始化');
        const canvas = new OffscreenCanvas(data.bitmap.width, 1);
        try {
          for (const slice of data.slices) {
            canvas.height = slice.sourceBottom - slice.sourceTop;
            if (canvas.height < 1 || completed >= spec.pageCount || slice.page < currentPage || slice.page > currentPage + 1 || slice.page > spec.pageCount) throw Error('PDF 切片尺寸或顺序无效');
            const context = canvas.getContext('2d',{alpha:false});
            if (!context) throw Error('无法创建后台 PDF 画布');
            context.drawImage(data.bitmap,0,slice.sourceTop,data.bitmap.width,canvas.height,0,0,canvas.width,canvas.height);
            const png = await canvas.convertToBlob({type:'image/png'});
            if (slice.page > currentPage) { pdf.addPage(); currentPage = slice.page; }
            const bytes=new Uint8Array(await png.arrayBuffer());
            await prepareNativePng(bytes);
            pdf.addImage(bytes,'PNG',0,slice.topMm,spec.paperWidth,slice.heightMm,undefined,'FAST');
            if (slice.complete) completed++;
          }
        } finally { canvas.width = 0; canvas.height = 0; }
      } finally { data.bitmap.close(); }
    } else {
      if (!pdf || !spec || completed !== spec.pageCount) throw Error('PDF 页面未全部编码');
      const buffer = pdf.output('arraybuffer');
      pdf = undefined;
      port.postMessage({id:data.id,kind:'file',buffer},[buffer]);
      return;
    }
    port.postMessage({id:data.id,kind:'ready',completed});
  } catch (cause) {
    pdf = undefined;
    port.postMessage({id:data.id,kind:'error',message:cause instanceof Error?cause.message:'后台 PDF 编码失败'});
  } finally { processing = false; }
};
