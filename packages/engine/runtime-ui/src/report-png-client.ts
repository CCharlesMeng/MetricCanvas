import { abortable, freezeGradientText } from './report-capture-view';
import { prepareReportCapture } from './report-pdf-capture';
import { validatePngSize } from './report-png-encoder';
import type { PngWorkerReply, PngWorkerRequest } from './report-png-protocol';
import { reportPngWorkerSource } from './report-png-worker-source';
import { reportScheduler } from './report-scheduler';
import { createReportWorker } from './report-worker';

export interface ReportImageFile { blob: Blob; width: number; height: number }

/** Bounded screenshots feed one persistent PNG encoder, never a report-sized canvas. */
export async function generateReportPng(target: HTMLElement, signal: AbortSignal, scale: 3 | 4,
  progress: (completed: number, total: number) => void): Promise<ReportImageFile> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.throwIfAborted();
  signal.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout>;
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(Error('图片生成超过60秒未取得进展')), 60_000);
  };
  let worker: ReturnType<typeof createReportWorker<PngWorkerRequest, PngWorkerReply>> | undefined;
  let capture: Awaited<ReturnType<typeof prepareReportCapture>> | undefined;
  const pause = reportScheduler(controller.signal);
  try {
    touch();
    worker = createReportWorker<PngWorkerRequest, PngWorkerReply>(controller.signal, reportPngWorkerSource, '图片');
    const bounds = target.getBoundingClientRect();
    const width = Math.ceil(bounds.width * scale), height = Math.ceil(bounds.height * scale);
    validatePngSize(width, height);
    await abortable(freezeGradientText(target, controller.signal, pause, scale), controller.signal);
    await worker.request({ kind: 'start', width, height });
    progress(0, height);
    capture = await abortable(prepareReportCapture(target, { width: width / scale, windowHeight: 1000, scale }, pause), controller.signal);
    const blockRows = Math.min(8192, Math.floor(16_777_216 / width));
    for (let top = 0; top < height; top += blockRows) {
      controller.signal.throwIfAborted();
      const count = Math.min(blockRows, height - top);
      // The renderer floors scaled dimensions. A subpixel epsilon prevents floating-point
      // division/multiplication from losing the last pixel of a block.
      const canvas = await abortable(capture.render(top / scale, (count + 0.001) / scale), controller.signal);
      try {
        if (canvas.width !== width || canvas.height !== count) throw Error('图片截图块尺寸与整图计划不一致');
        const bitmap = await createImageBitmap(canvas);
        try { await worker.request({ kind: 'bitmap', bitmap, top }, [bitmap]); }
        catch (cause) { bitmap.close(); throw cause; }
      } finally { canvas.width = 0; canvas.height = 0; }
      touch(); progress(top + count, height);
      const pending = pause(); if (pending) await pending;
    }
    const result = await worker.request({ kind: 'finish' });
    if (result.kind !== 'file' || result.blob.type !== 'image/png') throw Error('后台图片任务未返回完整PNG');
    controller.signal.throwIfAborted();
    return { blob: result.blob, width, height };
  } finally {
    clearTimeout(timer!);
    signal.removeEventListener('abort', abort);
    worker?.dispose(); capture?.dispose();
    for (const image of target.querySelectorAll<HTMLImageElement>('[data-pdf-gradient-text]')) URL.revokeObjectURL(image.src);
  }
}
