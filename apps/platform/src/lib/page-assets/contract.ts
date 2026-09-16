import type { PageDocument } from '@metriccanvas/page';

export interface PageRevision {
  isDraft?: boolean | null;
  resourceId?: string;
  pageId: string;
  revisionId: string;
  revisionNumber: number;
  document: PageDocument;
  baseRevisionId?: string | null;
  contentHash?: string;
  dataContextVersion?: string | null;
  createdBy?: string;
  createdAt?: string;
}

export interface PageListItem {
  pageId: string;
  latestRevision: { revisionId: string } | null;
  publishedRevision: { revisionId: string } | null;
  visibility: 'visible' | 'hidden';
}

export interface SavePageRevision {
  /** Ordinary saves create/update drafts; publication must be explicit. */
  isDraft?: boolean;
  comment?: string;
  resourceId?: string;
  baseRevisionId: string | null;
  document: PageDocument | Record<string, unknown>;
  idempotencyKey: string;
  pageIdConfirmed?: boolean;
  dataContextVersion?: string | null;
}

export class PageAssetsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly validationErrors: unknown[] = []
  ) {
    super(message);
    this.name = 'PageAssetsError';
  }
}


export interface AssetRef { resourceId: string; pageId: string }
export type AssetState = 'draft' | 'published' | 'unknown';
export interface AssetSummary extends AssetRef {
  revisionId: string; revisionNumber: number; state: AssetState;
  description: string; updatedAt: string;
}
export interface DraftHistoryEntry {
  historyId: string; draftVersion: number; createdBy: string; createdAt: string; comment: string; description: string;
}
export type MutationOutcome<T> = { status: 'confirmed'; value: T }
  | { status: 'rejected'; code: string; message: string }
  | { status: 'unknown'; message: string };
export type SaveAsset = {
  target: { kind: 'new'; pageId: string } | { kind: 'existing'; asset: AssetRef; revisionId: string };
  document: PageDocument; intent: 'saveDraft' | 'publish'; comment?: string;
};
export interface PageAssets {
  list(input: { state?: 'draft' | 'published'; page: number; pageSize: number }, signal?: AbortSignal): Promise<{ items: AssetSummary[]; total: number }>;
  read(asset: AssetRef, signal?: AbortSignal): Promise<PageRevision>;
  resolve(pageId: string, signal?: AbortSignal): Promise<AssetRef>;
  save(command: SaveAsset): Promise<MutationOutcome<PageRevision>>;
  history(asset: AssetRef, signal?: AbortSignal): Promise<DraftHistoryEntry[]>;
  restore(command: { asset: AssetRef; draftVersion: number }): Promise<MutationOutcome<PageRevision>>;
  remove(asset: AssetRef): Promise<MutationOutcome<void>>;
}
