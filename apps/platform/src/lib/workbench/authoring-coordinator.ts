import { pageParamDeclarations } from '@metriccanvas/page/internal';
import { normalizePageDocument, canonicalizeJson, type PageDocument } from '@metriccanvas/page';
import { createAuthoringSync, type DurableAuthoringState, type StableSavePort, type SyncSnapshot } from './authoring-sync';
import { validateHistoryPage, type ListRevisions } from './authoring-history';
import { validateAuthoringRecord } from './authoring-recovery';
import type { AuthoringStorage, StoredRecord } from './authoring-storage';
import { PageAssetsError, type PageRevision, type SavePageRevision, type PageAssets } from '../page-assets/contract';
import { createCanvasAuthoringDraft, projectCanvasDraft, type CanvasAuthoringDraft } from './document-edit';
import { type SavedDraft, type ReadSavedDraft, unavailableDraftReader } from '../dialogue/port';

/** Internal authoring-coordinator/1. Not a provider HTTP DTO or T04 strong Saved receipt. */
export interface DraftRef { pageId: string; revisionId: string; resourceId: string }
export interface OperationContext { operationId: string; actorId: string; workspaceId: string; origin: { kind: 'manual' } }
export type SaveOutcome =
  | { status: 'saved'; context: OperationContext; ref: DraftRef; revision: PageRevision; assurance: 'provider-response' }
  | { status: 'pending' | 'unknown'; context: OperationContext; message: string }
  | { status: 'rejected'; context: OperationContext; code: string; message: string };
export interface AuthoringCapabilities {
  latestRead?: boolean; currentRead: boolean; exactRead: boolean; exactDraftRead: boolean; history: boolean;
  stableSave: boolean; operationLookup: boolean; candidate: boolean; execute: boolean;
}
export interface AuthoringPort {
  capabilities: AuthoringCapabilities;
  assets?: PageAssets;
  getLatest(pageId: string, signal?: AbortSignal, resourceId?: string): Promise<PageRevision>;
  getRevision(pageId: string, revisionId: string, signal?: AbortSignal, resourceId?: string): Promise<PageRevision>;
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
  manualSave?: boolean;
  storageTarget?: () => string;
  localTaskId?: string;
}) {
  let state: AuthoringSnapshot = { draft: null, ref: null, loading: false, languageLocked: false, dirty: false, save: null, error: '', sync: null };
  let epoch = 0;
  let languageLease: symbol | null = null;
  let preparation: symbol | null = null;
  let flushing = false;
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
  const targetScope = () => ({ ...(options.storageTarget ? { serviceTarget: options.storageTarget() } : {}), ...(options.localTaskId ? { taskId: options.localTaskId } : {}) });
  const durableFormat = () => options.manualSave ? 3 as const : syncConfig?.port.delivery === 'single' ? 2 as const : 1 as const;
  const localState = () => options.manualSave ? { localDirty: false } : {};
  const scope = () => `${epoch}:${identityKey()}`;
  const recoveryLocked = () => state.sync?.phase === 'rejected' || state.save?.status === 'unknown' || state.save?.status === 'pending' || state.sync?.phase === 'unknown';
  const unresolved = () => state.loading || state.sync?.protection === 'failed' || state.save?.status === 'pending' || state.save?.status === 'unknown' || (state.sync?.pending ?? 0) > 0;
  const languageBlocked = () => disposed || unresolved() || (owner !== null && owner !== identityKey()) ||
    (!!syncConfig && !!state.draft && state.sync?.protection !== 'protected');
  function change(draft: CanvasAuthoringDraft) { epoch++; read?.abort(); state = { ...state, draft: structuredClone(draft), loading: false, error: '' }; }

  const currentScopeMatches = (expected: string) => !disposed && scope() === expected;
  function syncStorageScope(identity: ReturnType<typeof options.identity>): DurableAuthoringState['scope'] {
    return { ...identity, ...targetScope(), pageId: String(state.draft!.pageDocument.id), ...(options.port.assets && !options.localTaskId && state.ref?.resourceId ? { resourceId: state.ref.resourceId } : {}) };
  }
  function freshSyncState(storageScope: DurableAuthoringState['scope'], receipt?: PageRevision): DurableAuthoringState {
    return { format: durableFormat(), ...localState(), scope: storageScope, base: state.ref, draft: state.draft!, queue: [], ...(receipt ? { confirmed: receipt } : {}) };
  }
  function incomingSyncState(storageScope: DurableAuthoringState['scope'], stored: StoredRecord<DurableAuthoringState>, receipt?: PageRevision): DurableAuthoringState {
    return { format: durableFormat(), ...localState(), scope: storageScope, base: state.ref, draft: state.draft!, queue: [], ...(receipt ? { confirmed: receipt } : stored.value.confirmed?.revisionId === state.ref?.revisionId ? { confirmed: stored.value.confirmed } : {}) };
  }
  function assertSyncIdentity(identity: ReturnType<typeof options.identity>): void {
    if (!identity.actorId || !identity.workspaceId) throw new Error('身份失效，原记录已保留，请重新登录后打开页面。');
  }
  const replacementBlocked = () => !!((preparation && !flushing) || languageLease || recoveryLocked() || disposed || (syncConfig && state.loading) || state.save?.status === 'pending' || (options.manualSave && (state.sync?.pending ?? 0) > 0));
  const restorationBlocked = () => !!preparation || !!languageLease || disposed || owner !== identityKey();
  function incompatibleSavedDraft(draft: SavedDraft, newPage: boolean): boolean {
    return !!(draft.document.id !== draft.ref.pageId || (!newPage && state.ref?.resourceId && state.ref.resourceId !== draft.ref.resourceId) || (!newPage && state.draft && state.draft.pageDocument.id !== draft.ref.pageId));
  }
  async function attachSync(prepared?: StoredRecord<DurableAuthoringState> | null, incoming = false, receipt?: PageRevision) {
    if (!syncConfig || !state.draft) return;
    sync?.dispose(); sync = null;
    const identity = options.identity();
    const expected = scope();
    const storageScope = syncStorageScope(identity);
    state = { ...state, loading: true, sync: null }; emit();
    try {
      assertSyncIdentity(identity);
      const raw = prepared === undefined ? await syncConfig.storage.read(storageScope) : prepared;
      let stored = raw === null ? null : validateAuthoringRecord(raw, storageScope);
      if (!currentScopeMatches(expected)) return;
      if (incoming && stored && stored.value.queue.length === 0) {
        const value = incomingSyncState(storageScope, stored, receipt);
        const version = await syncConfig.storage.write(storageScope, stored.version, structuredClone(value));
        if (!currentScopeMatches(expected)) return;
        stored = { version, value };
      }
      if (stored) state = { ...state, draft: stored.value.draft, ref: stored.value.base, dirty: hasPendingWork(stored) };
      const active = createAuthoringSync({
        initial: stored?.value ?? freshSyncState(storageScope, receipt),
        ...syncConfig, manualSave: options.manualSave, identity: options.identity, restoredVersion: stored?.version, online
      });
      sync = active;
      active.subscribe((value) => {
        if (disposed || sync !== active) return;
        if (owner !== identityKey()) {
          state = { ...state, error: '身份已变化，原队列已停写停发，请重新打开页面。' }; emit(); return;
        }
        state = { ...state, sync: value, ref: value.base, dirty: value.dirty ?? value.pending > 0, languageLocked: !!preparation || !!languageLease || value.phase === 'unknown' }; emit();
      });
      state = { ...state, loading: false }; emit();
      active.start();
    } catch (error) {
      if (currentScopeMatches(expected)) {
        state = { ...state, loading: false, sync: { pending: 0, protection: 'failed', phase: 'storage-failed', message: messageOf(error), base: state.ref, lastSaved: null } }; emit();
      }
    }
  }

  type LocalWork = StoredRecord<DurableAuthoringState>;
  const workBlocked = () => !!preparation || !!languageLease || disposed || unresolved();
  const outdatedLoad = (signal: AbortSignal, expected: string) => disposed || signal.aborted || scope() !== expected;
  const hasPendingWork = (stored: LocalWork) => stored.value.queue.length > 0 || !!stored.value.localDirty;
  function refreshBlockedReason(pageId: string, refresh: boolean): string | undefined {
    if (!refresh) return;
    if (workBlocked() || state.dirty || (owner !== null && owner !== identityKey()) || (state.ref && state.ref.pageId !== pageId)) return '当前页面有未完成工作、身份已变化或通知属于其他页面，保留当前页面。';
    if (!options.port.capabilities.currentRead) return 'CAPABILITY_UNAVAILABLE：当前页面读取未接通。';
  }
  function loadStorageScope(pageId: string, resourceId: string | undefined): DurableAuthoringState['scope'] {
    const storageScope = { ...options.identity(), ...targetScope(), pageId, ...(resourceId && !options.localTaskId ? { resourceId } : {}) };
    if (!storageScope.actorId || !storageScope.workspaceId) throw new Error('身份失效，请重新登录后打开页面。');
    return storageScope;
  }
  function assertLegacyWorkResolved(legacy: LocalWork | null): void {
    if (legacy?.value.queue.length) throw Error('旧版未决工作已保留，请先人工核实，不能在新入口重放。');
  }
  function checkedLoadRecord(raw: LocalWork | null, storageScope: DurableAuthoringState['scope'], refresh: boolean): LocalWork | null {
    const stored = raw === null ? null : validateAuthoringRecord(raw, storageScope);
    if (refresh && stored && hasPendingWork(stored)) throw new Error('本地仍有未同步修改，保留当前页面。');
    return stored;
  }
  function shouldRestoreLocal(stored: LocalWork | null, localOnly: boolean | undefined, refresh: boolean): stored is LocalWork {
    return !!stored && (!options.port.assets || !!localOnly || hasPendingWork(stored)) && !refresh;
  }
  function restoreLocalDraft(stored: LocalWork): void {
    owner = identityKey();
    change(stored.value.draft);
    state = { ...state, ref: stored.value.base, dirty: hasPendingWork(stored), save: null };
  }
  function preferConfirmedRevision(stored: LocalWork | null, revision: PageRevision): PageRevision {
    const confirmed = stored?.value.confirmed;
    return confirmed && confirmed.resourceId === revision.resourceId && confirmed.revisionNumber > revision.revisionNumber ? confirmed : revision;
  }
  function adoptLoadedRevision(revision: PageRevision, pageId: string): void {
    if (revision.pageId !== pageId || revision.document.id !== pageId) throw new Error('RESPONSE_MISMATCH：页面身份不匹配。');
    const ref = refOf(revision);
    const parsed = createCanvasAuthoringDraft({ ...revision.document });
    if (!parsed.ok) throw new Error(parsed.message);
    owner = identityKey();
    change(parsed.draft);
    state = { ...state, ref, dirty: false, save: null };
  }
  function recordLoadError(cause: unknown, signal: AbortSignal, expected: string): void {
    if (!outdatedLoad(signal, expected)) state = { ...state, error: String(cause) };
  }
  function finishLoad(signal: AbortSignal): void {
    if (!disposed && read?.signal === signal) { state = { ...state, loading: false }; emit(); }
  }
  const savePermitted = (permit?: symbol) => !(preparation && preparation !== permit) && !languageLease && !disposed;
  const saveBlockedByReceipt = () => unresolved() || (state.save?.status === 'rejected' && state.save.code === 'REVISION_CONFLICT');
  function acceptedSaveRevision(revision: PageRevision, pageId: string, base: DraftRef | null, document: Record<string, unknown>, context: OperationContext): SaveOutcome {
    const ref = refOf(revision);
    const parsed = normalizePageDocument(revision.document);
    if (ref.pageId !== pageId || (base && ref.resourceId !== base.resourceId) || !parsed.ok || stable(parsed.document) !== stable(document)) throw new Error('RESPONSE_MISMATCH：保存回执与提交内容不匹配，结果未确定。');
    return { status: 'saved', context, ref, revision, assurance: 'provider-response' };
  }
  function failedSaveOutcome(cause: unknown, context: OperationContext): SaveOutcome {
    const error = cause as { code?: string; message?: string };
    const knownRejected = (cause instanceof PageAssetsError && cause.code !== 'PAGE_ASSETS_RESPONSE_ERROR' && cause.status < 500) || ['DQE_CONFIG_ERROR', 'DQE_AUTH_REQUIRED'].includes(error.code ?? '');
    return knownRejected ? { status: 'rejected', context, code: error.code ?? 'REJECTED', message: error.message ?? String(cause) } : { status: 'unknown', context, message: error.message ?? String(cause) };
  }
  const coordinator = {
    snapshot, scope,
    enableAutoSync(config: { storage: AuthoringStorage<DurableAuthoringState>; port: StableSavePort }) {
      syncConfig = config; if (state.draft) void attachSync();
    },
    setOnline(value: boolean) { online = value; sync?.setOnline(value); },
    setRetainDimensionValues(value: boolean) { if ((!preparation || flushing) && !languageLease && !recoveryLocked()) retainDimensionValues = value; },
    async retrySync() { await sync?.retry(); },
    /** Shared gate for consumers that require fully synchronized content (including publication). */
    requireSynchronizedRef(): DraftRef {
      if (preparation || languageLease || !state.ref || languageBlocked() || state.dirty || owner !== identityKey()) throw new Error('工作尚未完成同步，暂不能进入语言修改或发布。');
      return structuredClone(state.ref);
    },
    /** Local lease; trusted Relay association is separately verified by authoring-language. */
    beginLanguage(newPageId?: string,workingCopy=false) {
      if (preparation || languageLease || languageBlocked() || state.dirty&&!workingCopy) throw Error('等待当前工作保护后再进行语言修改。');
      const identity = options.identity();
      if (!identity.actorId || !identity.workspaceId) throw Error('身份失效。');
      const token = Symbol('language');let expected = scope();
      languageLease = token;
      state = { ...state, languageLocked: true }; emit();
      return {
        identity: { ...identity }, base: state.ref ? structuredClone(state.ref) : null,
        retainDimensionValues,
        input:state.draft?structuredClone(state.draft.pageDocument):null,
        current: () => !disposed && languageLease === token && scope() === expected,
        accept(draft: SavedDraft) {
          if (disposed || languageLease !== token || scope() !== expected) return false;
          if (newPageId && draft.ref.pageId !== newPageId) return false;
          return coordinator.acceptSavedDraft(draft, token, !!newPageId);
        },
        async applyDocument(value:unknown){
          if(!workingCopy||disposed||languageLease!==token||scope()!==expected)throw Error('本轮页面更新已过期。');
          const raw=typeof value==='string'?JSON.parse(value):value;
          const parsed=createCanvasAuthoringDraft(raw);
          if(!parsed.ok)throw Error(parsed.message);
          if(state.draft&&parsed.draft.pageDocument.id!==state.draft.pageDocument.id)throw Error('本轮页面身份不匹配。');
          owner=identityKey();change(parsed.draft);state={...state,dirty:true};expected=scope();emit();
          if(!sync&&syncConfig)await attachSync();
          if(sync)await sync.enqueue(parsed.draft,'Agent 组件更新工作副本',retainDimensionValues,true);
          expected=scope();
        },
        async applyRevision(revision:PageRevision){
          if(!workingCopy||disposed||languageLease!==token||scope()!==expected)throw Error('本轮页面更新已过期。');
          const pageId=String(state.draft?.pageDocument.id??revision.pageId);
          adoptLoadedRevision(revision,pageId);expected=scope();
          await attachSync(undefined,true,revision);expected=scope();emit();
        },
        release() {
          if (languageLease !== token) return;
          languageLease = null; state = { ...state, languageLocked: recoveryLocked() }; emit();
        }
      };
    },
    /** Locks new writers before draining already-started input. Sync itself remains live. */
    beginPreparation() {
      if (preparation || languageLease || disposed) throw Error('当前轮次尚未结束。');
      const token = Symbol('preparation');
      const identity = identityKey();
      preparation = token; state = { ...state, languageLocked: true }; emit();
      const current = () => !disposed && preparation === token && identityKey() === identity;
      return {
        current,
        flush(callback: () => void) {
          if (!current()) throw Error('工作范围已变化。');
          flushing = true;
          try { callback(); } finally { flushing = false; }
        },
        async synchronize() {
          if (!current()) throw Error('工作范围已变化。');
          if (options.manualSave && state.dirty) throw Error('人工修改尚未明确保存，请保存或取消本次 AI 修改。');
          if (sync) await sync.retry();
          else if (state.dirty) {
            // The private preparation token alone may drain the existing manual draft.
            await coordinator.save(token);
          }
        },
        async protectWorkingCopy(){
          if(!current())throw Error('工作范围已变化。');
          if(sync&&!await sync.protect())throw Error('前端工作副本保护失败。');
          if(!current()||languageBlocked())throw Error('当前工作副本不可用。');
          return {document:state.draft?structuredClone(state.draft.pageDocument):null,ref:state.ref?structuredClone(state.ref):null};
        },
        async rebaseTitle(revision:PageRevision,title:string){
          if(!current()||!state.draft)throw Error('工作范围已变化。');
          if(revision.pageId!==state.draft.pageDocument.id)throw Error('标题回执页面不匹配。');
          const parsed=projectCanvasDraft({...state.draft.canvasDocument,meta:{...(state.draft.canvasDocument.meta as object),title}});
          if(!parsed.ok)throw Error(parsed.message);
          if(sync)await sync.rebase(revision,parsed.draft);
          change(parsed.draft);state={...state,ref:refOf(revision),dirty:stable(parsed.draft.pageDocument)!==stable(revision.document)};emit();
        },
        async latest(signal: AbortSignal) {
          if (!current() || languageBlocked() || state.dirty) throw Error('当前工作尚未同步。');
          if (!options.port.capabilities.latestRead && !options.port.assets) throw Error('CAPABILITY_UNAVAILABLE：当前页面读取尚未接通。');
          const pageId = state.ref?.pageId;
          if (!pageId) throw Error('必须明确新建或打开已有页面。');
          const revision = await options.port.getLatest(pageId, signal, state.ref?.resourceId);
          if (signal.aborted || !current() || revision.pageId !== pageId || revision.document.id !== pageId || revision.resourceId !== state.ref?.resourceId) throw Error('RESPONSE_MISMATCH：最新页面范围已变化。');
          refOf(revision);
          if (!normalizePageDocument(revision.document).ok) throw Error('最新页面校验失败。');
          return structuredClone(revision);
        },
        async adoptLatest(revision: PageRevision) {
          if (!current() || state.dirty || languageBlocked()) throw Error('工作范围已变化。');
          if (stable(state.ref) === stable(refOf(revision)) && stable(state.draft?.pageDocument) === stable(revision.document)) return;
          const parsed = createCanvasAuthoringDraft({ ...revision.document });
          if (!parsed.ok) throw Error(parsed.message);
          change(parsed.draft); state = { ...state, ref: refOf(revision), dirty: false, save: null };
          await attachSync(undefined, true); emit();
          if (!current() || state.sync?.protection === 'failed') throw Error('最新工作副本保护失败。');
        },
        acquire(newPageId?: string,workingCopy=false) {
          if (!current()) throw Error('工作范围已变化。');
          preparation = null;
          try { return coordinator.beginLanguage(newPageId,workingCopy); }
          catch (error) { preparation = token; throw error; }
        },
        release() {
          if (preparation !== token) return;
          preparation = null; state = { ...state, languageLocked: recoveryLocked() }; emit();
        }
      };
    },
    async protect(): Promise<boolean> { return sync ? sync.protect() : !state.dirty; },
    capabilities: options.port.capabilities,
    subscribe(listener: (state: AuthoringSnapshot) => void) { listeners.add(listener); listener(snapshot()); return () => { listeners.delete(listener); }; },
    replaceDraft(draft: CanvasAuthoringDraft, description = '手工页面修改', forceOperation = false): boolean {
      if (replacementBlocked()) return false;
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
    /** Supplied metadata has no saved-revision receipt; apply locally without provider requests. */
    applyPreview(previewJson: unknown): boolean {
      if (preparation || languageLease || recoveryLocked() || disposed ||
        (state.sync?.pending ?? 0) > 0 || (owner !== null && owner !== identityKey())) {
        throw new Error('当前有未完成操作或身份已变化，暂不能应用页面文档。');
      }
      const document: unknown = typeof previewJson === 'string' ? JSON.parse(previewJson) : previewJson;
      if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('previewJson 必须是有效的页面文档。');
      const parsed = createCanvasAuthoringDraft(document as Record<string, unknown>);
      if (!parsed.ok) throw new Error(parsed.message);
      sync?.dispose(); sync = null;
      owner = identityKey();
      change(parsed.draft);
      state = { ...state, ref: null, dirty: true, save: null, sync: null };
      emit();
      if (syncConfig) void attachSync().then(async () => { await sync?.enqueue(parsed.draft, '应用页面工作副本', retainDimensionValues, true); });
      return true;
    },
    async load(pageId: string, optionsForLoad: { refreshCurrent?: boolean; resourceId?: string; localOnly?: boolean } = {}): Promise<void> {
      const refreshCurrent = optionsForLoad.refreshCurrent === true;
      const blocked = refreshBlockedReason(pageId, refreshCurrent);
      if (blocked) { state = { ...state, error: blocked }; emit(); return; }
      if (workBlocked()) return;
      epoch++; read?.abort(); read = new AbortController();
      const signal = read.signal, expected = scope();
      state = { ...state, loading: true, error: '' }; emit();
      try {
        let stored: StoredRecord<DurableAuthoringState> | null = null;
        const resourceId = optionsForLoad.resourceId ?? (options.port.assets && !options.localTaskId ? (await options.port.assets.resolve(pageId, signal)).resourceId : undefined);
        if (outdatedLoad(signal, expected)) return;
        if (syncConfig) {
          const storageScope = loadStorageScope(pageId, resourceId);
          if (resourceId && !options.storageTarget) {
            const legacy = await syncConfig.storage.read({ ...options.identity(), pageId });
            assertLegacyWorkResolved(legacy);
          }
          const raw = await syncConfig.storage.read(storageScope);
          if (outdatedLoad(signal, expected)) return;
          stored = checkedLoadRecord(raw, storageScope, refreshCurrent);
          if (shouldRestoreLocal(stored, optionsForLoad.localOnly, refreshCurrent)) {
            restoreLocalDraft(stored);
            await attachSync(stored); return;
          }
        }
        if (optionsForLoad.localOnly) return;
        const revision = preferConfirmedRevision(stored, await options.port.getLatest(pageId, signal, resourceId));
        if (outdatedLoad(signal, expected)) return;
        adoptLoadedRevision(revision, pageId);
        await attachSync(stored, true); emit();
      } catch (cause) {
        recordLoadError(cause, signal, expected);
      } finally {
        finishLoad(signal);
      }
    },
    readSavedDraft: (async (draftId, signal) => {
      if (preparation || languageLease || languageBlocked()) throw new Error('保存结果未确定或身份已变化，暂不能接收新的草稿。');
      if (state.dirty) throw new Error('工作副本有未保存修改，保留当前页面，请先保存后重试草稿通知。');
      if (!options.port.capabilities.exactDraftRead || !options.port.readSavedDraft) return unavailableDraftReader(draftId, signal);
      const expected = scope();
      const result = await options.port.readSavedDraft(draftId, signal);
      if (signal.aborted || scope() !== expected || languageBlocked() || state.dirty) throw new Error('草稿读取期间工作范围已变化，保留当前工作副本。');
      return result;
    }) as ReadSavedDraft,
    acceptSavedDraft(draft: SavedDraft, lease?: symbol, newPage = false): boolean {
      if (preparation || (languageLease && languageLease !== lease) || languageBlocked()) return false;
      if (state.dirty&&lease!==languageLease || incompatibleSavedDraft(draft, newPage)) {
        state = { ...state, error: '草稿通知与当前工作副本不兼容，保留当前页面。' }; emit(); return false;
      }
      if (options.port.assets && (!Number.isSafeInteger(draft.revisionNumber) || Number(draft.revisionNumber) < 1 || draft.isDraft !== true)) return false;
      const receipt: PageRevision | undefined = draft.revisionNumber ? { ...draft.ref, document: draft.document, revisionNumber: draft.revisionNumber, isDraft: draft.isDraft } : undefined;
      const parsed = createCanvasAuthoringDraft({ ...draft.document });
      if (!parsed.ok) { state = { ...state, error: parsed.message }; emit(); return false; }
      owner = identityKey();
      change(parsed.draft); state = { ...state, ref: structuredClone(draft.ref), dirty: false, save: null }; void attachSync(undefined, true, receipt); emit(); return true;
    },
    async undo(): Promise<void> {
      if (preparation || languageLease || disposed || !sync || state.loading || owner !== identityKey()) throw Error('当前工作副本不能撤销。');
      const expected = scope();
      const draft = await sync.undo(retainDimensionValues);
      if (disposed || scope() !== expected) return;
      if (draft) { change(draft); emit(); }
    },
    async publish(): Promise<void> {
      coordinator.requireSynchronizedRef();
      if (!sync || !state.draft) throw Error('工作尚未保护。');
      await sync.enqueue(state.draft, '发布页面', true, true, 'publish');
    },
    async publishTemplate(document: PageDocument, expectedSource: string, selectedIds: readonly string[]): Promise<void> {
      const ref = coordinator.requireSynchronizedRef();
      if (expectedSource !== canonicalizeJson({ ref, scope: coordinator.scope() })) throw Error('发布来源已变化');
      if (!sync || !state.draft || document.id !== ref.pageId) throw Error('工作尚未保护或页面不匹配');
      const declarations = pageParamDeclarations(document.params);
      if (selectedIds.some(id => !declarations.some(p => p.id === id)) || declarations.some(p => selectedIds.includes(p.id) && (p.value !== undefined || p.default !== undefined)) || selectedIds.length && Object.values(document.dataSources).some(ds => ds.source.type === 'query' && ds.source.initial)) throw Error('模板不得保存所选参数实际值或旧初始行');
      const draft = createCanvasAuthoringDraft({ ...document }); if (!draft.ok) throw Error(draft.message);
      await sync.enqueue(draft.draft, '发布参数模板', false, true, 'publish');
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
      if (!sync || restorationBlocked()) throw Error('当前工作副本不能恢复历史。');
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
      const revision = await options.port.getRevision(ref.pageId, ref.revisionId, signal, ref.resourceId);
      if (stable(refOf(revision)) !== stable(ref) || revision.document.id !== ref.pageId) throw new Error('RESPONSE_MISMATCH：预览引用不匹配。');
      const parsed = normalizePageDocument(revision.document);
      if (!parsed.ok) throw new Error('预览页面校验失败。');
      return { ...revision, document: parsed.document };
    },
    async save(preparationPermit?: symbol): Promise<SaveOutcome | null> {
      if (!savePermitted(preparationPermit) || !state.draft) return null;
      if (sync) { if (options.manualSave) await sync.commit(retainDimensionValues); else await sync.retry(); return null; }
      if (saveBlockedByReceipt()) return state.save;
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
        outcome = acceptedSaveRevision(revision, pageId, base, document, context);
      } catch (cause) {
        outcome = failedSaveOutcome(cause, context);
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
