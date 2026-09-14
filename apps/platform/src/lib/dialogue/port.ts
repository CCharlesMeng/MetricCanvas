import type { PageDocument } from '@metriccanvas/page';
import { createAnalysisPageState } from '../workbench/analysis-page-state';

/** Internal event v1. draftId must address an immutable saved revision, never latest. */
export const DRAFT_SAVED_EVENT = 'metriccanvas:draft-saved';
export interface DraftSavedDetail { draftId: string }
export interface SavedDraft {
  draftId: string;
  ref: { pageId: string; revisionId: string; resourceId: string };
  document: PageDocument;
}
export type ReadSavedDraft = (draftId: string, signal: AbortSignal) => Promise<SavedDraft>;
export const unavailableDraftReader: ReadSavedDraft = async () => {
  throw new Error('CAPABILITY_UNAVAILABLE：当前页面资产接口尚未确认按精确草稿 ID 读取，保留当前页面。');
};
export interface DialogueAdapter {
  mount(element: HTMLElement): Promise<() => void>;
}

export function draftIdOf(detail: unknown): string | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null;
  const value = detail as Record<string, unknown>;
  if (Object.keys(value).length !== 1 || typeof value.draftId !== 'string') return null;
  const id = value.draftId;
  return id.length > 0 && id.length <= 512 && id.trim() === id && !/[\x00-\x1f\x7f]/.test(id) ? id : null;
}

/** Read adapter authenticates, verifies exact identity/hash BEFORE returning the raw document.
 * This listener reuses #108 acceptance and never saves, publishes or interprets message text.
 */
export function listenForSavedDrafts(options: {
  target: EventTarget;
  read: ReadSavedDraft;
  /** false means consumer rejected delivery; void preserves existing consumers. */
  onpage(draft: SavedDraft): boolean | void;
  onerror(message: string): void;
  captureScope?(): unknown;
  captureIdentity?(): unknown;
}) {
  const state = createAnalysisPageState();
  const seen = new Map<string, { scope: unknown; status: 'pending' | 'accepted' }>();
  let pending: AbortController | null = null;
  let releasePending: (() => void) | null = null;
  let disposed = false;
  const listener = (event: Event) => {
    const id = draftIdOf((event as CustomEvent<unknown>).detail);
    if (!id) { options.onerror('草稿通知无效：只接受非空的精确草稿 ID。'); return; }
    const scope = options.captureScope?.();
    const identity = options.captureIdentity ? options.captureIdentity() : scope;
    const key = JSON.stringify([identity, id]);
    const existing = seen.get(key);
    if (existing?.status === 'accepted' || (existing && existing.scope === scope)) return;
    const entry = { scope, status: 'pending' as 'pending' | 'accepted' };
    seen.set(key, entry);
    const forget = () => { if (seen.get(key) === entry) seen.delete(key); };
    if (seen.size > 256) seen.delete(seen.keys().next().value!);
    releasePending?.();
    pending?.abort();
    releasePending = () => { if (entry.status === 'pending') forget(); };
    const controller = new AbortController();
    pending = controller;
    const handle = state.begin();
    void options.read(id, controller.signal).then((draft) => {
      if (disposed || controller.signal.aborted || scope !== options.captureScope?.()) { forget(); return; }
      if (draft.draftId !== id || !draft.ref ||
          ![draft.ref.pageId, draft.ref.revisionId, draft.ref.resourceId].every((value) => draftIdOf({ draftId: value })) ||
          draft.document.id !== draft.ref.pageId) {
        forget();
        options.onerror('RESPONSE_MISMATCH：精确草稿引用不匹配，保留当前页面。');
        return;
      }
      const outcome = state.acceptVerifiedPage(handle, draft.document);
      if (outcome === 'accepted') {
        if (options.onpage(draft) === false) forget();
        else entry.status = 'accepted';
      } else {
        forget();
        if (outcome === 'invalid') options.onerror('草稿页面校验失败，保留当前页面。');
      }
    }).catch((cause: unknown) => {
      if (disposed || controller.signal.aborted || scope !== options.captureScope?.()) { forget(); return; }
      forget();
      state.finishWithoutPage(handle, 'failed');
      options.onerror(cause instanceof Error ? cause.message : String(cause));
    });
  };
  options.target.addEventListener(DRAFT_SAVED_EVENT, listener);
  return () => {
    disposed = true;
    releasePending?.();
    pending?.abort();
    state.reset();
    options.target.removeEventListener(DRAFT_SAVED_EVENT, listener);
  };
}
