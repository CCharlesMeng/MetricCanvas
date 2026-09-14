import type { DraftRef } from './authoring-coordinator';
export interface RevisionHistoryEntry {
  ref: DraftRef;
  base?: DraftRef | null;
  description?: string;
  origin?: 'manual' | 'relay';
  createdAt?: string;
  revisionNumber?: number;
}
/** Proposed lifecycle read port: opaque cursor remains tied to one immutable snapshot. */
export interface RevisionHistoryPage {
  snapshot: DraftRef;
  revisions: RevisionHistoryEntry[];
  nextCursor: string | null;
}
export type ListRevisions = (pageId: string, cursor: string | null, limit: number, signal?: AbortSignal) => Promise<RevisionHistoryPage>;
export function validateHistoryPage(value: RevisionHistoryPage, pageId: string, expected?: DraftRef): RevisionHistoryPage {
  const validRef = (ref: DraftRef | undefined) => ref && ref.pageId === pageId && typeof ref.revisionId === 'string' && !!ref.revisionId && typeof ref.resourceId === 'string' && !!ref.resourceId;
  const matches = (a: DraftRef, b: DraftRef) => a.pageId === b.pageId && a.revisionId === b.revisionId && a.resourceId === b.resourceId;
  if (!value || !validRef(value.snapshot) || (expected && !matches(value.snapshot, expected)) || !Array.isArray(value.revisions) || (value.nextCursor !== null && (typeof value.nextCursor !== 'string' || !value.nextCursor))) throw Error('历史分页回执或固定快照不匹配。');
  const ids = new Set<string>();
  for (const entry of value.revisions) {
    if (!entry || !validRef(entry.ref) || entry.ref.resourceId !== value.snapshot.resourceId || ids.has(entry.ref.revisionId) || (entry.base != null && (!validRef(entry.base) || entry.base.resourceId !== value.snapshot.resourceId)) || (entry.description !== undefined && typeof entry.description !== 'string') || (entry.origin !== undefined && !['manual', 'relay'].includes(entry.origin)) || (entry.createdAt !== undefined && typeof entry.createdAt !== 'string') || (entry.revisionNumber !== undefined && (!Number.isInteger(entry.revisionNumber) || entry.revisionNumber < 1))) throw Error('页面历史条目不匹配。');
    ids.add(entry.ref.revisionId);
  }
  return structuredClone(value);
}
