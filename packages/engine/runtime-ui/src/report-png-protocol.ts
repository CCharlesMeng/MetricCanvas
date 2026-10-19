export type PngWorkerRequest =
  | { id: number; kind: 'start'; width: number; height: number }
  | { id: number; kind: 'bitmap'; bitmap: ImageBitmap; top: number }
  | { id: number; kind: 'finish' };
export type PngWorkerReply =
  | { id: number; kind: 'ready'; completed: number }
  | { id: number; kind: 'file'; blob: Blob }
  | { id: number; kind: 'error'; message: string };
