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
  onpage(draft: SavedDraft): void;
  onerror(message: string): void;
  captureScope?(): unknown;
}) {
  const state = createAnalysisPageState();
  const seen = new Set<string>();
  let pending: AbortController | null = null;
  let disposed = false;
  const listener = (event: Event) => {
    const id = draftIdOf((event as CustomEvent<unknown>).detail);
    if (!id) { options.onerror('草稿通知无效：只接受非空的精确草稿 ID。'); return; }
    if (seen.has(id)) return;
    seen.add(id);
    // Bound memory; ordering of unseen IDs is the provider's responsibility.
    if (seen.size > 256) seen.delete(seen.values().next().value!);
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    const handle = state.begin();
    const scope = options.captureScope?.();
    void options.read(id, controller.signal).then((draft) => {
      if (disposed || controller.signal.aborted || scope !== options.captureScope?.()) return;
      if (draft.draftId !== id || !draft.ref ||
          ![draft.ref.pageId, draft.ref.revisionId, draft.ref.resourceId].every((value) => draftIdOf({ draftId: value })) ||
          draft.document.id !== draft.ref.pageId) {
        options.onerror('RESPONSE_MISMATCH：精确草稿引用不匹配，保留当前页面。');
        return;
      }
      const outcome = state.acceptVerifiedPage(handle, draft.document);
      if (outcome === 'accepted') options.onpage(draft);
      else if (outcome === 'invalid') options.onerror('草稿页面校验失败，保留当前页面。');
    }).catch((cause: unknown) => {
      if (disposed || controller.signal.aborted || scope !== options.captureScope?.()) return;
      state.finishWithoutPage(handle, 'failed');
      options.onerror(cause instanceof Error ? cause.message : String(cause));
    });
  };
  options.target.addEventListener(DRAFT_SAVED_EVENT, listener);
  return () => {
    disposed = true;
    pending?.abort();
    state.reset();
    options.target.removeEventListener(DRAFT_SAVED_EVENT, listener);
  };
}
