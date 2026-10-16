export interface PdfDocumentSpec { landscape: boolean; paperWidth: number; paperHeight: number; pageWidth: number; pageCount: number }
export interface PdfSlice { sourceTop: number; sourceBottom: number; heightMm: number }
export type PdfWorkerRequest =
  | { id: number; kind: 'start'; spec: PdfDocumentSpec }
  | { id: number; kind: 'bitmap'; bitmap: ImageBitmap; slices: PdfSlice[] }
  | { id: number; kind: 'finish' };
export type PdfWorkerReply =
  | { id: number; kind: 'ready'; completed: number }
  | { id: number; kind: 'file'; buffer: ArrayBuffer }
  | { id: number; kind: 'error'; message: string };
