import { validate } from '@metriccanvas/page';
import { listenForSavedDrafts, DRAFT_SAVED_EVENT, draftIdOf, type SavedDraft } from '../dialogue/port';
import { createAnalysisPageState } from './analysis-page-state';
import type { createAuthoringCoordinator, DraftRef } from './authoring-coordinator';

/** Internal trusted program port, not a Java/Relay wire contract. No document in run results. */
export interface LanguageContext {
  actorId: string; workspaceId: string; runId: string; operationId: string;
  base: DraftRef | null; retainDimensionValues: boolean;
}
export interface LanguageOperation { id: string; status: string }
export type LanguageResult =
  | { status: 'saved'; draftId: string; operations: LanguageOperation[] }
  | { status: 'text' | 'waiting' | 'failed' | 'not-applied'; operations: LanguageOperation[] }
  | { status: 'unknown' | 'pending'; operations: LanguageOperation[] };
export interface LanguagePort {
  /** Provider adapter must persist the original command before sending and authenticate each call. */
  run(context: LanguageContext, prompt: string, signal: AbortSignal): Promise<LanguageResult>;
  lookup(context: LanguageContext, signal: AbortSignal): Promise<LanguageResult>;
  /** Authenticated original integrity check precedes return; binding comes from trusted program output. */
  read(draftId: string, signal: AbortSignal): Promise<{ binding: LanguageContext; draft: SavedDraft }>;
}
export const unavailableLanguagePort: LanguagePort = {
  run: async () => { throw Error('CAPABILITY_UNAVAILABLE：语言创作服务尚未接通。'); },
  lookup: async () => { throw Error('CAPABILITY_UNAVAILABLE：原操作查询尚未接通。'); },
  read: async () => { throw Error('CAPABILITY_UNAVAILABLE：可信草稿关联尚未接通。'); }
};
export interface LanguageSnapshot {
  phase: 'idle' | 'synchronizing' | 'running' | 'reading' | 'saved' | 'text' | 'waiting' | 'failed' | 'unknown' | 'cancelled' | 'recovered';
  message: string; operations: LanguageOperation[]; recovery: SavedDraft['ref'] | null;
}
type Coordinator = ReturnType<typeof createAuthoringCoordinator>;
type Lease = ReturnType<Coordinator['beginLanguage']>;
const sameRef = (a: DraftRef | null, b: DraftRef | null) => a === null || b === null ? a === b :
  a.pageId === b.pageId && a.revisionId === b.revisionId && a.resourceId === b.resourceId;
function sameBinding(a: LanguageContext, b: LanguageContext) {
  return a.actorId === b.actorId && a.workspaceId === b.workspaceId && a.runId === b.runId &&
    a.operationId === b.operationId && a.retainDimensionValues === b.retainDimensionValues && sameRef(a.base, b.base);
}
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export function createAuthoringLanguage(options: {
  coordinator: Coordinator; port: LanguagePort; target: EventTarget;
  identity(): { actorId: string; workspaceId: string }; id?: () => string;
}) {
  let snapshot: LanguageSnapshot = { phase: 'idle', message: '', operations: [], recovery: null };
  let disposed = false;
  let active: { context: LanguageContext; lease: Lease; handle: symbol; cancelled: boolean } | null = null;
  let startController: AbortController | null = null;
  let stopNotifications: (() => void) | null = null;
  let lookupPending = false;
  const pageState = createAnalysisPageState();
  const listeners = new Set<(value: LanguageSnapshot) => void>();
  const emit = (value: Partial<LanguageSnapshot>) => {
    snapshot = { ...snapshot, ...value }; for (const listener of listeners) listener(structuredClone(snapshot));
  };
  function identityMatches(context: LanguageContext) {
    const identity = options.identity();
    return context.actorId === identity.actorId && context.workspaceId === identity.workspaceId;
  }
  function current(turn: NonNullable<typeof active>) {
    return !disposed && active === turn && turn.lease.current() && identityMatches(turn.context);
  }
  function finish(turn: NonNullable<typeof active>) {
    if (active !== turn) return;
    stopNotifications?.(); stopNotifications = null; turn.lease.release(); active = null;
    startController?.abort(); startController = null;
  }
  async function trustedRead(turn: NonNullable<typeof active>, draftId: string, signal: AbortSignal) {
    if (!current(turn)) throw Error('语言操作身份或工作范围已变化。');
    const result = await options.port.read(draftId, signal);
    if (signal.aborted || !current(turn) || !sameBinding(result.binding, turn.context) ||
        result.draft.draftId !== draftId || !Object.values(result.draft.ref).every((value) => draftIdOf({ draftId: value })) ||
        validate(result.draft.document).length > 0 || result.draft.document.id !== result.draft.ref.pageId ||
        (turn.context.base && (result.draft.ref.pageId !== turn.context.base.pageId || result.draft.ref.resourceId !== turn.context.base.resourceId || result.draft.ref.revisionId === turn.context.base.revisionId))) {
      throw Error('RESPONSE_MISMATCH：通知不属于当前可信操作，保留当前页面。');
    }
    return result.draft;
  }
  async function waitForSync(signal: AbortSignal) {
    await new Promise<void>((resolve, reject) => {
      let unsubscribe = () => {};
      const check = () => {
        const state = options.coordinator.snapshot();
        if (signal.aborted || disposed) { unsubscribe(); reject(Error('已取消等待同步。')); return; }
        if (!state.loading && !state.dirty && !state.languageLocked &&
            (!state.sync || (state.sync.protection === 'protected' && state.sync.pending === 0)) &&
            state.save?.status !== 'unknown' && state.save?.status !== 'pending') {
          unsubscribe(); resolve();
        }
      };
      unsubscribe = options.coordinator.subscribe(() => { queueMicrotask(check); });
      signal.addEventListener('abort', check, { once: true });
    });
  }
  async function outcome(turn: NonNullable<typeof active>, result: LanguageResult) {
    if (!current(turn) || turn.cancelled) return;
    emit({ operations: result.operations.map(({ id, status }) => ({ id, status })) });
    if (result.status === 'saved') {
      emit({ phase: 'reading', message: '已保存，正在鉴权读取精确修订。' });
      options.target.dispatchEvent(new CustomEvent(DRAFT_SAVED_EVENT, { detail: { draftId: result.draftId } }));
    } else if (result.status === 'unknown' || result.status === 'pending') {
      emit({ phase: 'unknown', message: '保存结果待确认，请查询原操作；当前页面保留。' });
    } else {
      if (result.status === 'waiting') pageState.waitForConfirmation(turn.handle);
      else pageState.finishWithoutPage(turn.handle, result.status === 'text' ? 'text' : 'failed');
      emit({ phase: result.status === 'not-applied' ? 'failed' : result.status, message: '本轮没有保存新修订，当前页面保留。' });
      finish(turn);
    }
  }
  const api = {
    snapshot: (): LanguageSnapshot => active && !identityMatches(active.context) ? { phase: 'unknown', message: '身份已变化，请重新打开页面。', operations: [], recovery: null } : structuredClone(snapshot),
    subscribe(listener: (value: LanguageSnapshot) => void) { listeners.add(listener); listener(api.snapshot()); return () => { listeners.delete(listener); }; },
    async start(prompt: string) {
      if (disposed || active || startController || !prompt.trim()) return;
      const controller = new AbortController(); startController = controller;
      emit({ phase: 'synchronizing', message: '等待当前工作同步完成。', operations: [], recovery: null });
      try {
        await waitForSync(controller.signal);
        if (controller.signal.aborted || disposed) return;
        const lease = options.coordinator.beginLanguage();
        const id = options.id ?? (() => crypto.randomUUID());
        const context: LanguageContext = { ...lease.identity, base: lease.base, retainDimensionValues: lease.retainDimensionValues, runId: id(), operationId: id() };
        const turn = { context, lease, handle: pageState.begin(), cancelled: false }; active = turn;
        stopNotifications = listenForSavedDrafts({
          target: options.target, captureScope: options.coordinator.scope,
          captureIdentity: () => JSON.stringify(options.identity()),
          read: (draftId, signal) => trustedRead(turn, draftId, signal),
          onpage(draft) {
            if (!current(turn) || turn.cancelled || pageState.acceptVerifiedPage(turn.handle, draft.document) !== 'accepted') return false;
            if (!lease.accept(draft)) return false;
            emit({ phase: 'saved', message: '已保存并读回精确修订。' }); finish(turn); return true;
          },
          onerror(error) { if (current(turn) && !turn.cancelled) emit({ phase: 'unknown', message: error }); }
        });
        emit({ phase: 'running', message: '语言修改处理中，暂不能手工修改当前页面。' });
        await outcome(turn, await options.port.run(structuredClone(context), prompt, controller.signal));
      } catch (error) {
        if (!disposed && !controller.signal.aborted && (!active || current(active))) emit({ phase: active ? 'unknown' : 'failed', message: message(error) });
      } finally { if (startController === controller) startController = null; }
    },
    cancel() {
      startController?.abort(); startController = null;
      if (active) {
        active.cancelled = true; pageState.cancel(active.handle); stopNotifications?.(); stopNotifications = null;
        emit({ phase: 'cancelled', message: '已停止本地接收；已发保存仍需查询实际结果。' });
      } else emit({ phase: 'cancelled', message: '已取消等待，当前页面保留。' });
    },
    async lookup() {
      const turn = active;
      if (!turn || lookupPending) return;
      if (!current(turn)) { emit({ phase: 'unknown', message: '身份或工作范围已变化，请重新打开页面。', operations: [], recovery: null }); return; }
      lookupPending = true;
      try {
        const controller = new AbortController();
        const result = await options.port.lookup(structuredClone(turn.context), controller.signal);
        if (!current(turn)) return;
        if (!turn.cancelled) await outcome(turn, result);
        else if (result.status === 'saved') {
          const draft = await trustedRead(turn, result.draftId, controller.signal);
          if (pageState.snapshot().phase !== 'cancelled') return;
          emit({ phase: 'recovered', recovery: draft.ref, message: '取消后服务已保存；当前页面保留，可查看该精确修订。' });
          // Keep the lease: the service head advanced, so old local content is not a synchronized base.
        } else if (['not-applied', 'failed', 'text', 'waiting'].includes(result.status)) {
          emit({ phase: 'cancelled', message: '已确认本轮未保存，当前页面保留。' }); finish(turn);
        } else emit({ phase: 'unknown', message: '取消后的保存结果仍待确认，请继续查询原操作。' });
      } catch (error) { if (current(turn)) emit({ phase: 'unknown', message: message(error) }); }
      finally { lookupPending = false; }
    },
    dispose() { disposed = true; startController?.abort(); stopNotifications?.(); active?.lease.release(); active = null; pageState.reset(); listeners.clear(); }
  };
  return api;
}
