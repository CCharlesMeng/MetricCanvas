import { reportPdfWorkerSource } from './report-pdf-worker-source';
import type { PdfWorkerReply, PdfWorkerRequest } from './report-pdf-protocol';
import { createReportWorker } from './report-worker';

export function createPdfWorker(signal: AbortSignal) {
  return createReportWorker<PdfWorkerRequest, PdfWorkerReply>(signal, reportPdfWorkerSource, 'PDF');
}
