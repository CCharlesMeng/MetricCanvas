import { reportPdfWorkerSource } from './report-pdf-worker-source';
import type { PdfWorkerReply, PdfWorkerRequest } from './report-pdf-protocol';

type Request = PdfWorkerRequest extends infer T ? T extends {id: number} ? Omit<T, 'id'> : never : never;
/** One task owns one worker. Only an acknowledged bitmap may be followed by another. */
export function createPdfWorker(signal: AbortSignal) {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw Error('当前浏览器不支持后台 PDF 导出，请使用支持 Worker 和 OffscreenCanvas 的浏览器');
  }
  signal.throwIfAborted();
  const url = URL.createObjectURL(new Blob([reportPdfWorkerSource],{type:'text/javascript'}));
  let worker: Worker;
  try { worker = new Worker(url); } catch (cause) { URL.revokeObjectURL(url); throw cause; }
  let nextId = 0, disposed = false;
  let pending: {id:number;resolve:(reply:PdfWorkerReply)=>void;reject:(cause:unknown)=>void;timer:ReturnType<typeof setTimeout>} | undefined;
  const reject = (cause: unknown) => { if (pending) {clearTimeout(pending.timer);pending.reject(cause);pending=undefined;} };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', aborted);
    reject(signal.reason ?? Error('后台 PDF 任务已释放'));
    worker.terminate(); URL.revokeObjectURL(url);
  };
  const aborted = () => dispose();
  signal.addEventListener('abort',aborted,{once:true});
  worker.onerror = event => { event.preventDefault(); reject(Error(`后台 PDF Worker 无法运行，请检查浏览器 worker-src 策略：${event.message || 'Worker 启动失败'}`)); dispose(); };
  worker.onmessageerror = () => {reject(Error('后台 PDF 消息无法解码'));dispose();};
  worker.onmessage = ({data}:MessageEvent<PdfWorkerReply>) => {
    if (!pending || data.id !== pending.id) return;
    const current = pending; pending = undefined; clearTimeout(current.timer);
    if (data.kind === 'error') current.reject(Error(data.message)); else current.resolve(data);
  };
  return {
    request(message:Request,transfer:Transferable[]=[]):Promise<PdfWorkerReply> {
      signal.throwIfAborted();
      if (disposed) throw Error('后台 PDF Worker 已释放');
      if (pending) throw Error('后台 PDF 正在处理上一块图片');
      const id = ++nextId;
      return new Promise((resolve,rejectRequest) => {
        const timer = setTimeout(() => {reject(Error('后台 PDF 编码超过 60 秒未响应'));dispose();},60_000);
        pending = {id,resolve,reject:rejectRequest,timer};
        try {worker.postMessage({...message,id},transfer);} catch (cause) {reject(cause);dispose();}
      });
    },
    dispose
  };
}
