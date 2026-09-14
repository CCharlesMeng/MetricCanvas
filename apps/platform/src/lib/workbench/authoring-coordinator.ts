import { normalizePageDocument } from '@metriccanvas/page';
import { createAuthoringSync, type DurableAuthoringState, type StableSavePort, type SyncSnapshot } from './authoring-sync';
import { validateHistoryPage, type ListRevisions } from './authoring-history';
import { validateAuthoringRecord } from './authoring-recovery';
import type { AuthoringStorage, StoredRecord } from './authoring-storage';
import { PageAssetsError, type PageRevision, type SavePageRevision } from '../page-assets-client';
import { createCanvasAuthoringDraft, type CanvasAuthoringDraft } from './document-edit';
import { type SavedDraft, type ReadSavedDraft, unavailableDraftReader } from '../dialogue/port';

/** Internal authoring-coordinator/1. Not a provider HTTP DTO or T04 strong Saved receipt. */
export interface DraftRef { pageId: string; revisionId: string; resourceId: string }
export interface OperationContext { operationId: string; actorId: string; workspaceId: string; origin: { kind: 'manual' } }
export type SaveOutcome =
  | { status: 'saved'; context: OperationContext; ref: DraftRef; revision: PageRevision; assurance: 'provider-response' }
  | { status: 'pending' | 'unknown'; context: OperationContext; message: string }
  | { status: 'rejected'; context: OperationContext; code: string; message: string };
export interface AuthoringCapabilities {
  currentRead: boolean; exactRead: boolean; exactDraftRead: boolean; history: boolean;
  stableSave: boolean; operationLookup: boolean; candidate: boolean; execute: boolean;
}
export interface AuthoringPort {
  capabilities: AuthoringCapabilities;
  getLatest(pageId: string, signal?: AbortSignal): Promise<PageRevision>;
  getRevision(pageId: string, revisionId: string, signal?: AbortSignal): Promise<PageRevision>;
  saveRevision(pageId: string, command: SavePageRevision): Promise<PageRevision>;
  readSavedDraft?: ReadSavedDraft;
  listRevisions?: ListRevisions;
}
export const confirmedPageAssetCapabilities: AuthoringCapabilities = {
  currentRead: true, exactRead: false, exactDraftRead: false, history: false,
  stableSave: false, operationLookup: false, candidate: false, execute: false
};
export interface AuthoringSnapshot {
  draft: CanvasAuthoringDraft | null;
  ref: DraftRef | null;
  loading: boolean;
  languageLocked: boolean;
  dirty: boolean;
  save: SaveOutcome | null;
  error: string;
  sync: SyncSnapshot | null;
}
function refOf(revision: PageRevision): DraftRef {
  if (!revision.pageId || !revision.revisionId || !revision.resourceId) throw new Error('RESPONSE_MISMATCH：页面、修订或资源 ID 缺失。');
  return { pageId: revision.pageId, revisionId: revision.revisionId, resourceId: revision.resourceId };
}
function messageOf(error: unknown) { return error instanceof Error ? error.message : String(error); }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function createAuthoringCoordinator(options: {
  port: AuthoringPort;
  identity(): { actorId: string; workspaceId: string };
  operationId?: () => string;
}) {
  let state: AuthoringSnapshot = { draft: null, ref: null, loading: false, languageLocked: false, dirty: false, save: null, error: '', sync: null };
  let epoch = 0;
  let languageLease: symbol | null = null;
  let owner: string | null = null;
  let syncConfig: { storage: AuthoringStorage<DurableAuthoringState>; port: StableSavePort } | null = null;
  let sync: ReturnType<typeof createAuthoringSync> | null = null;
  let retainDimensionValues = true;
  let online = true;
  let disposed = false;
  let read: AbortController | null = null;
  const listeners = new Set<(state: AuthoringSnapshot) => void>();
  const snapshot = () => structuredClone(state);
  const emit = () => { for (const listener of listeners) listener(snapshot()); };
  const identityKey = () => { const value = options.identity(); return JSON.stringify([value.actorId, value.workspaceId]); };
  const scope = () => `${epoch}:${identityKey()}`;
  const unresolved = () => state.loading || state.sync?.protection === 'failed' || state.save?.status === 'pending' || state.save?.status === 'unknown' || (state.sync?.pending ?? 0) > 0;
  const languageBlocked = () => disposed || unresolved() || (owner !== null && owner !== identityKey()) ||
    (!!syncConfig && !!state.draft && state.sync?.protection !== 'protected');
  function change(draft: CanvasAuthoringDraft) { epoch++; read?.abort(); state = { ...state, draft: structuredClone(draft), loading: false, error: '' }; }

  async function attachSync(prepared?: StoredRecord<DurableAuthoringState> | null, incoming = false) {
    if (!syncConfig || !state.draft) return;
    sync?.dispose(); sync = null;
    const identity = options.identity();
    const expected = scope();
    const storageScope = { ...identity, pageId: String(state.draft.pageDocument.id) };
    state = { ...state, loading: true, sync: null }; emit();
    try {
      if (!identity.actorId || !identity.workspaceId) throw new Error('身份失效，原记录已保留，请重新登录后打开页面。');
      const raw = prepared === undefined ? await syncConfig.storage.read(storageScope) : prepared;
      let stored = raw === null ? null : validateAuthoringRecord(raw, storageScope);
      if (disposed || scope() !== expected) return;
      if (incoming && stored && stored.value.queue.length === 0) {
        const value: DurableAuthoringState = { format: 1, scope: storageScope, base: state.ref, draft: state.draft!, queue: [] };
        const version = await syncConfig.storage.write(storageScope, stored.version, structuredClone(value));
        if (disposed || scope() !== expected) return;
        stored = { version, value };
      }
      if (stored) state = { ...state, draft: stored.value.draft, ref: stored.value.base, dirty: stored.value.queue.length > 0 };
      const active = createAuthoringSync({
        initial: stored?.value ?? { format: 1, scope: storageScope, base: state.ref, draft: state.draft!, queue: [] },
        ...syncConfig, identity: options.identity, restoredVersion: stored?.version, online
      });
      sync = active;
      active.subscribe((value) => {
        if (disposed || sync !== active) return;
        if (owner !== identityKey()) {
          state = { ...state, error: '身份已变化，原队列已停写停发，请重新打开页面。' }; emit(); return;
        }
        state = { ...state, sync: value, ref: value.base, dirty: value.pending > 0 }; emit();
      });
      state = { ...state, loading: false }; emit();
      active.start();
    } catch (error) {
      if (!disposed && scope() === expected) {
        state = { ...state, loading: false, sync: { pending: 0, protection: 'failed', phase: 'storage-failed', message: messageOf(error), base: state.ref, lastSaved: null } }; emit();
      }
    }
  }

  const coordinator = {
    snapshot, scope,
    enableAutoSync(config: { storage: AuthoringStorage<DurableAuthoringState>; port: StableSavePort }) {
      syncConfig = config; if (state.draft) void attachSync();
    },
    setOnline(value: boolean) { online = value; sync?.setOnline(value); },
    setRetainDimensionValues(value: boolean) { retainDimensionValues = value; },
    async retrySync() { await sync?.retry(); },
    /** Shared gate for consumers that require fully synchronized content (including publication). */
    requireSynchronizedRef(): DraftRef {
      if (languageLease || !state.ref || languageBlocked() || state.dirty || owner !== identityKey()) throw new Error('工作尚未完成同步，暂不能进入语言修改或发布。');
      return structuredClone(state.ref);
    },
    /** Local lease; trusted Relay association is separately verified by authoring-language. */
    beginLanguage() {
      if (languageLease || languageBlocked() || state.dirty) throw Error('等待当前工作同步后再进行语言修改。');
      const identity = options.identity();
      if (!identity.actorId || !identity.workspaceId) throw Error('身份失效。');
      const token = Symbol('language'), expected = scope();
      languageLease = token;
      state = { ...state, languageLocked: true }; emit();
      return {
        identity: { ...identity }, base: state.ref ? structuredClone(state.ref) : null,
        retainDimensionValues,
        current: () => !disposed && languageLease === token && scope() === expected,
        accept(draft: SavedDraft) {
          if (disposed || languageLease !== token || scope() !== expected) return false;
          return coordinator.acceptSavedDraft(draft, token);
        },
        release() {
          if (languageLease !== token) return;
          languageLease = null; state = { ...state, languageLocked: false }; emit();
        }
      };
    },
    capabilities: options.port.capabilities,
    subscribe(listener: (state: AuthoringSnapshot) => void) { listeners.add(listener); listener(snapshot()); return () => { listeners.delete(listener); }; },
    replaceDraft(draft: CanvasAuthoringDraft, description = '手工页面修改', forceOperation = false): boolean {
      if (languageLease || disposed || (syncConfig && state.loading) || state.save?.status === 'pending') return false;
      if (owner && owner !== identityKey()) { state = { ...state, error: '身份已变化，请重新打开页面后编辑。' }; emit(); return false; }
      if (state.ref && draft.pageDocument.id !== state.ref.pageId) {
        state = { ...state, error: 'RESPONSE_MISMATCH：编辑不能改变页面身份。' }; emit(); return false;
      }
      owner ??= identityKey();
      const changed = stable(state.draft?.pageDocument) !== stable(draft.pageDocument);
      change(draft);
      if (changed || forceOperation) state = { ...state, dirty: true };
      if (state.save?.status === 'saved') state = { ...state, save: null };
      emit();
      if (sync) void sync.enqueue(draft, description, retainDimensionValues, forceOperation).catch((error: unknown) => { state = { ...state, error: messageOf(error) }; emit(); });
      return true;
    },
    async load(pageId: string): Promise<void> {
      if (languageLease || disposed || unresolved()) return;
      epoch++; read?.abort(); read = new AbortController();
      const signal = read.signal, expected = scope();
      state = { ...state, loading: true, error: '' }; emit();
      try {
        let stored: StoredRecord<DurableAuthoringState> | null = null;
        if (syncConfig) {
          const storageScope = { ...options.identity(), pageId };
          if (!storageScope.actorId || !storageScope.workspaceId) throw new Error('身份失效，请重新登录后打开页面。');
          const raw = await syncConfig.storage.read(storageScope);
          if (disposed || signal.aborted || scope() !== expected) return;
          stored = raw === null ? null : validateAuthoringRecord(raw, storageScope);
          if (stored) {
            owner = identityKey();
            change(stored.value.draft); state = { ...state, ref: stored.value.base, dirty: stored.value.queue.length > 0, save: null };
            await attachSync(stored); return;
          }
        }
        const revision = await options.port.getLatest(pageId, signal);
        if (disposed || signal.aborted || scope() !== expected) return;
        if (revision.pageId !== pageId || revision.document.id !== pageId) throw new Error('RESPONSE_MISMATCH：页面身份不匹配。');
        const ref = refOf(revision);
        const parsed = createCanvasAuthoringDraft({ ...revision.document });
        if (!parsed.ok) throw new Error(parsed.message);
        owner = identityKey();
        change(parsed.draft); state = { ...state, ref, dirty: false, save: null }; await attachSync(null); emit();
      } catch (cause) {
        if (!disposed && !signal.aborted && scope() === expected) { state = { ...state, error: String(cause) }; }
      } finally {
        if (!disposed && read?.signal === signal) { state = { ...state, loading: false }; emit(); }
      }
    },
    readSavedDraft: (async (draftId, signal) => {
      if (languageLease || languageBlocked()) throw new Error('保存结果未确定或身份已变化，暂不能接收新的草稿。');
      if (state.dirty) throw new Error('工作副本有未保存修改，保留当前页面，请先保存后重试草稿通知。');
      if (!options.port.capabilities.exactDraftRead || !options.port.readSavedDraft) return unavailableDraftReader(draftId, signal);
      const expected = scope();
      const result = await options.port.readSavedDraft(draftId, signal);
      if (signal.aborted || scope() !== expected || languageBlocked() || state.dirty) throw new Error('草稿读取期间工作范围已变化，保留当前工作副本。');
      return result;
    }) as ReadSavedDraft,
    acceptSavedDraft(draft: SavedDraft, lease?: symbol): boolean {
      if ((languageLease && languageLease !== lease) || languageBlocked()) return false;
      if (draft.document.id !== draft.ref.pageId || state.dirty || (state.draft && state.draft.pageDocument.id !== draft.ref.pageId)) {
        state = { ...state, error: '草稿通知与当前工作副本不兼容，保留当前页面。' }; emit(); return false;
      }
      const parsed = createCanvasAuthoringDraft({ ...draft.document });
      if (!parsed.ok) { state = { ...state, error: parsed.message }; emit(); return false; }
      owner = identityKey();
      change(parsed.draft); state = { ...state, ref: structuredClone(draft.ref), dirty: false, save: null }; void attachSync(undefined, true); emit(); return true;
    },
    async undo(): Promise<void> {
      if (languageLease || disposed || !sync || state.loading || owner !== identityKey()) throw Error('当前工作副本不能撤销。');
      const expected = scope();
      const draft = await sync.undo(retainDimensionValues);
      if (disposed || scope() !== expected) return;
      if (draft) { change(draft); emit(); }
    },
    async listHistory(cursor: string | null = null, expectedSnapshot?: DraftRef, signal?: AbortSignal) {
      if (disposed || !state.ref || owner !== identityKey()) throw Error('当前工作副本不能读取历史。');
      if (!options.port.capabilities.history || !options.port.listRevisions) throw Error('当前生命周期端口尚未开放页面历史，不能用对话历史代替。');
      if (cursor !== null && !expectedSnapshot) throw Error('历史后续分页必须携带原快照。');
      const pageId = state.ref.pageId, expected = scope();
      const result = await options.port.listRevisions(pageId, cursor, 20, signal);
      if (disposed || signal?.aborted || scope() !== expected) throw Error('历史读取范围已变化。');
      const valid = validateHistoryPage(result, pageId, expectedSnapshot);
      if (valid.snapshot.resourceId !== state.ref?.resourceId) throw Error('历史快照资源不属于当前页面。');
      return valid;
    },
    async restoreRevision(ref: DraftRef, signal?: AbortSignal): Promise<void> {
      if (!options.port.capabilities.exactRead) throw Error('当前生命周期端口尚未开放历史精确读取。');
      if (languageLease || disposed || !sync || owner !== identityKey()) throw Error('当前工作副本不能恢复历史。');
      const before = scope();
      if ((state.sync?.pending ?? 0) > 0) await sync.retry();
      if (disposed || scope() !== before) throw Error('历史恢复范围已变化。');
      const current = coordinator.requireSynchronizedRef();
      if (current.pageId !== ref.pageId || current.resourceId !== ref.resourceId) throw Error('历史修订引用不属于当前页面资源。');
      const revision = await coordinator.preview(ref, signal);
      if (disposed || signal?.aborted || scope() !== before) throw Error('历史恢复期间工作副本已变化。');
      coordinator.requireSynchronizedRef();
      const parsed = createCanvasAuthoringDraft({ ...revision.document });
      if (!parsed.ok) throw Error(parsed.message);
      if (!coordinator.replaceDraft(parsed.draft, `恢复历史修订 ${ref.revisionId}`, true)) throw Error('当前工作副本不能恢复历史。');
    },
    /** Current-match preview remains available; false exactRead explicitly forbids claiming historical availability. */
    async preview(ref: DraftRef, signal?: AbortSignal): Promise<PageRevision> {
      const revision = await options.port.getRevision(ref.pageId, ref.revisionId, signal);
      if (stable(refOf(revision)) !== stable(ref) || revision.document.id !== ref.pageId) throw new Error('RESPONSE_MISMATCH：预览引用不匹配。');
      const parsed = normalizePageDocument(revision.document);
      if (!parsed.ok) throw new Error('预览页面校验失败。');
      return { ...revision, document: parsed.document };
    },
    async save(): Promise<SaveOutcome | null> {
      if (languageLease || disposed || !state.draft) return null;
      if (sync) { await sync.retry(); return null; }
      if (unresolved() || (state.save?.status === 'rejected' && state.save.code === 'REVISION_CONFLICT')) return state.save;
      const identity = options.identity();
      const context: OperationContext = { ...identity, origin: { kind: 'manual' }, operationId: options.operationId?.() ?? crypto.randomUUID() };
      if (owner !== identityKey()) {
        const outcome: SaveOutcome = { status: 'rejected', context, code: 'IDENTITY_CHANGED', message: '身份已变化，请重新打开页面后保存。' };
        state = { ...state, save: outcome }; emit(); return outcome;
      }
      const document = structuredClone(state.draft.pageDocument);
      const pageId = String(document.id);
      const base = state.ref ? structuredClone(state.ref) : null;
      epoch++; read?.abort(); const expected = scope();
      state = { ...state, loading: false, error: '', save: { status: 'pending', context, message: '保存中…' } }; emit();
      let outcome: SaveOutcome;
      try {
        const revision = await options.port.saveRevision(pageId, {
          document, baseRevisionId: base?.revisionId ?? null,
          resourceId: base?.resourceId, idempotencyKey: context.operationId, pageIdConfirmed: true
        });
        const ref = refOf(revision);
        const parsed = normalizePageDocument(revision.document);
        if (ref.pageId !== pageId || (base && ref.resourceId !== base.resourceId) || !parsed.ok || stable(parsed.document) !== stable(document)) {
          throw new Error('RESPONSE_MISMATCH：保存回执与提交内容不匹配，结果未确定。');
        }
        outcome = { status: 'saved', context, ref, revision, assurance: 'provider-response' };
      } catch (cause) {
        const error = cause as { code?: string; message?: string };
        const knownRejected = (cause instanceof PageAssetsError && cause.code !== 'PAGE_ASSETS_RESPONSE_ERROR' && cause.status < 500) ||
          ['DQE_CONFIG_ERROR', 'DQE_AUTH_REQUIRED'].includes(error.code ?? '');
        outcome = knownRejected
          ? { status: 'rejected', context, code: error.code ?? 'REJECTED', message: error.message ?? String(cause) }
          : { status: 'unknown', context, message: error.message ?? String(cause) };
      }
      if (!disposed) {
        if (scope() !== expected) outcome = { status: 'unknown', context, message: '身份或工作副本已变化，保存结果需核实。' };
        state = { ...state, save: outcome, ...(outcome.status === 'saved' ? { ref: outcome.ref, dirty: false } : {}) };
        emit();
      }
      return outcome;
    },
    dispose() { disposed = true; epoch++; read?.abort(); sync?.dispose(); listeners.clear(); }
  };
  return coordinator;
}
