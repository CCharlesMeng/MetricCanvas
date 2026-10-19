import { createPngEncoder } from './report-png-encoder';
import type { PngWorkerReply, PngWorkerRequest } from './report-png-protocol';
const port = globalThis as unknown as {
  onmessage: (event: MessageEvent<PngWorkerRequest>) => void;
  postMessage(message: PngWorkerReply): void;
};
let encoder: ReturnType<typeof createPngEncoder> | undefined;
let width = 0;
port.onmessage = ({ data }) => {
  try {
    if (data.kind === 'start') {
      if (encoder) throw Error('图片任务已初始化');
      width = data.width;
      encoder = createPngEncoder(width, data.height);
    } else if (data.kind === 'bitmap') {
      try {
        if (!encoder || data.top !== encoder.rows || data.bitmap.width !== width) throw Error('图片像素块顺序或宽度无效');
        // Read at most 32 RGBA rows, independent of the report's full height.
        const canvas = new OffscreenCanvas(width, Math.min(32, data.bitmap.height));
        try {
          const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
          if (!context) throw Error('无法创建后台图片画布');
          for (let top = 0; top < data.bitmap.height; top += canvas.height) {
            const count = Math.min(canvas.height, data.bitmap.height - top);
            context.drawImage(data.bitmap, 0, top, width, count, 0, 0, width, count);
            encoder.push(context.getImageData(0, 0, width, count).data, count);
          }
        } finally { canvas.width = 0; canvas.height = 0; }
      } finally { data.bitmap.close(); }
    } else {
      if (!encoder) throw Error('图片任务未初始化');
      const blob = encoder.finish();
      encoder = undefined;
      port.postMessage({ id: data.id, kind: 'file', blob });
      return;
    }
    port.postMessage({ id: data.id, kind: 'ready', completed: encoder?.rows ?? 0 });
  } catch (cause) {
    encoder = undefined;
    port.postMessage({ id: data.id, kind: 'error', message: cause instanceof Error ? cause.message : '后台图片编码失败' });
  }
};
