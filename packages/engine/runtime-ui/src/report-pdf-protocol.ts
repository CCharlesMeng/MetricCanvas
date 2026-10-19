export interface PdfDocumentSpec { landscape: boolean; paperWidth: number; paperHeight: number; pageWidth: number; pageCount: number }
export interface PdfSlice { page: number; sourceTop: number; sourceBottom: number; topMm: number; heightMm: number; complete: boolean }
export type PdfWorkerRequest =
  | { id: number; kind: 'start'; spec: PdfDocumentSpec }
  | { id: number; kind: 'bitmap'; bitmap: ImageBitmap; slices: PdfSlice[] }
  | { id: number; kind: 'finish' };
export type PdfWorkerReply =
  | { id: number; kind: 'ready'; completed: number }
  | { id: number; kind: 'file'; buffer: ArrayBuffer }
  | { id: number; kind: 'error'; message: string };
