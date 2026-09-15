import { canonicalizeJson, validate } from '@metriccanvas/page';
import type { SavedDraft } from '../dialogue/port';
import type { createAuthoringCoordinator, DraftRef } from './authoring-coordinator';

type Identity = { actorId: string; workspaceId: string };
export interface RecoverySummary extends Identity {
  formatVersion: '1.0'; recoveryRef: string; pageId: string; operationId: string;
  status: 'unknown' | 'pending' | 'not-applied' | 'rejected' | 'unchanged' | 'saved-unverified' | 'saved';
  cancelRequested: boolean; ref: DraftRef | null; previewState: 'not-requested' | 'failed' | 'ready';
}
export interface TrustedLanguageRecoveryPort {
  loadPending(scope: Identity & { pageId: string | null }, signal: AbortSignal): Promise<RecoverySummary | null>;
  recover(recoveryRef: string, attemptId: string, signal: AbortSignal): Promise<RecoverySummary>;
  cancel(recoveryRef: string, signal: AbortSignal): Promise<RecoverySummary>;
  retryOriginal(recoveryRef: string, attemptId: string, signal: AbortSignal): Promise<RecoverySummary>;
  readVerified(recoveryRef: string, ref: DraftRef, signal: AbortSignal): Promise<SavedDraft>;
}
export interface LanguageRecoverySnapshot {
  phase: 'idle' | 'checking' | 'pending' | 'busy' | 'error' | 'ready' | 'opened';
  message: string; summary: RecoverySummary | null; locked: boolean; busy: boolean;
}
type Coordinator = ReturnType<typeof createAuthoringCoordinator>;
const equal = (a: unknown, b: unknown) => canonicalizeJson(a) === canonicalizeJson(b);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 256;
const terminal = (value: RecoverySummary) => ['not-applied', 'rejected', 'unchanged'].includes(value.status);
const message = (error: unknown) => {
  const detail = error instanceof Error ? error.message : '';
  if (detail.startsWith('RESPONSE_MISMATCH')) return 'RESPONSE_MISMATCH：恢复结果未通过核验，保持当前页面锁定。';
  if (/本地|工作副本|同步|当前轮次/.test(detail)) return '本地工作尚未完成同步，已保留内容与恢复锁。';
  if (detail.includes('身份')) return '身份已变化，请重新打开页面。';
  return '恢复请求未完成，请重试；当前页面保持锁定。';
};

export function createAuthoringLanguageRecovery(options: {
  coordinator: Coordinator; port: TrustedLanguageRecoveryPort; identity(): Identity;
  resume(pageId: string | null): Promise<void>; protectSaved?(): void; currentPageId?(): string | null; id?: () => string;
}) {
  let state: LanguageRecoverySnapshot = { phase: 'idle', message: '', summary: null, locked: false, busy: false };
  let lease: ReturnType<Coordinator['beginLanguage']> | null = null;
  let expected: (Identity & { pageId: string | null }) | null = null;
  let requestedPageId: string | null = null;
  let controller: AbortController | null = null;
  let disposed = false, generation = 0;
  const listeners = new Set<(snapshot: LanguageRecoverySnapshot) => void>();
  const emit = (value: Partial<LanguageRecoverySnapshot>) => { state = { ...state, ...value, locked: !!lease }; listeners.forEach(listener => listener(api.snapshot())); };
  const identityMatches = () => !!expected && options.identity().actorId === expected.actorId && options.identity().workspaceId === expected.workspaceId;
  function current(signal: AbortSignal, version: number) {
    return !disposed && !signal.aborted && generation === version && !!expected && identityMatches() &&
      (!options.currentPageId || options.currentPageId() === requestedPageId);
  }
  function validateSummary(value: RecoverySummary) {
    if (!value || !expected || value.formatVersion !== '1.0' ||
      ![value.actorId, value.workspaceId, value.pageId, value.operationId, value.recoveryRef].every(text) ||
      value.actorId !== expected.actorId || value.workspaceId !== expected.workspaceId || (expected.pageId !== null && value.pageId !== expected.pageId) ||
      !['unknown', 'pending', 'not-applied', 'rejected', 'unchanged', 'saved-unverified', 'saved'].includes(value.status) ||
      typeof value.cancelRequested !== 'boolean' || !['not-requested', 'failed', 'ready'].includes(value.previewState) ||
      (value.ref !== null && (!value.ref || Object.keys(value.ref).sort().join() !== 'pageId,resourceId,revisionId' || !Object.values(value.ref).every(text) || value.ref.pageId !== value.pageId)) ||
      (['saved', 'saved-unverified'].includes(value.status) && value.ref === null)) throw Error('RESPONSE_MISMATCH：恢复结果范围或格式不匹配，保持当前页面锁定。');
    const old = state.summary;
    if (old && (old.recoveryRef !== value.recoveryRef || old.operationId !== value.operationId ||
      (old.ref !== null && !equal(old.ref, value.ref)) || (old.cancelRequested && !value.cancelRequested) ||
      (old.status === 'saved' && value.status !== 'saved') || (old.status === 'saved-unverified' && !['saved-unverified', 'saved'].includes(value.status)))) throw Error('RESPONSE_MISMATCH：恢复操作或精确修订已变化，保持锁定。');
  }
  function lock(pageId: string | null) {
    if (!lease) lease = options.coordinator.beginLanguage(pageId ?? undefined);
  }
  async function consume(summary: RecoverySummary, signal: AbortSignal, version: number) {
    validateSummary(summary);
    expected!.pageId = summary.pageId;
    emit({ summary: structuredClone(summary), phase: 'pending', message: summary.status === 'saved' ? '已核实保存结果，可打开已保存修订。' :
      summary.status === 'saved-unverified' ? '服务已保存，精确读取尚未核实；请继续查询恢复。' :
      summary.cancelRequested ? '已记录取消；原操作结果仍需核实。' : '检测到未决语言操作，请先查询恢复。' });
    if (!current(signal, version)) return;
    if (terminal(summary)) {
      lease?.release(); lease = null;
      emit({ phase: 'ready', message: '服务已确认原操作结束，正在打开页面。' });
      await options.resume(summary.pageId);
      if (!current(signal, version)) return;
      emit({ message: '原操作已结束，可以继续编辑。' });
    }
  }
  async function request(task: (signal: AbortSignal, version: number) => Promise<void>, phase: 'checking' | 'busy') {
    if (disposed || state.busy) return;
    const active = new AbortController(), version = ++generation; controller = active;
    emit({ busy: true, phase });
    try { await task(active.signal, version); }
    catch (error) { if (current(active.signal, version)) emit({ phase: 'error', message: message(error) }); }
    finally { if (controller === active) { controller = null; emit({ busy: false }); } }
  }
  async function waitForProtection(signal: AbortSignal) {
    await new Promise<void>((resolve, reject) => {
      let unsubscribe = () => {};
      const done = (error?: Error) => { unsubscribe(); signal.removeEventListener('abort', check); error ? reject(error) : resolve(); };
      const check = () => {
        const value = options.coordinator.snapshot();
        if (signal.aborted || disposed) return done(Error('恢复读取已取消。'));
        if (value.sync?.protection === 'protected' && value.sync.pending > 0 && value.sync.phase === 'idle') return done(Error('本地队列仍待同步，已保留原内容与恢复锁。'));
        if (value.sync?.protection === 'failed' || ['unknown', 'rejected', 'unavailable', 'identity-changed'].includes(value.sync?.phase ?? '')) return done(Error('本地工作尚未完成同步，已保留原队列，请先处理同步冲突。'));
        if (!value.loading && (!value.sync || value.sync.protection === 'protected' && value.sync.pending === 0)) done();
      };
      unsubscribe = options.coordinator.subscribe(() => queueMicrotask(check));
      signal.addEventListener('abort', check, { once: true });
    });
  }
  const api = {
    snapshot(): LanguageRecoverySnapshot {
      if (expected && (!identityMatches() ||
        options.currentPageId && options.currentPageId() !== requestedPageId)) return { ...state, summary: null, phase: 'error', message: '身份或页面已变化，请重新打开页面。' };
      return structuredClone(state);
    },
    subscribe(listener: (snapshot: LanguageRecoverySnapshot) => void) { listeners.add(listener); listener(api.snapshot()); return () => { listeners.delete(listener); }; },
    async check(pageId: string | null) {
      if (disposed || state.busy) return;
      if (lease && expected && requestedPageId !== pageId) { emit({ phase: 'error', message: '原操作尚未核实，不能切换页面。' }); return; }
      if (lease && state.summary) return;
      requestedPageId = pageId;
      expected = { ...options.identity(), pageId };
      try { lock(pageId); } catch (error) { emit({ phase: 'error', message: message(error) }); return; }
      await request(async (signal, version) => {
        if (![expected!.actorId, expected!.workspaceId].every(text) || pageId !== null && !text(pageId)) throw Error('请先打开需要恢复的页面。');
        const result = await options.port.loadPending({ ...expected! }, signal);
        if (!current(signal, version)) return;
        if (result === null) {
          lease?.release(); lease = null;
          emit({ phase: 'ready', summary: null, message: '未发现未决操作，正在打开页面。' });
          await options.resume(pageId);
        } else await consume(result, signal, version);
      }, 'checking');
    },
    async recover() { await operation('recover'); },
    async cancel() { await operation('cancel'); },
    async retryOriginal() { await operation('retryOriginal'); },
    async openSaved() {
      const summary = state.summary;
      if (!summary || summary.status !== 'saved' || !summary.ref || !lease) return;
      await request(async (signal, version) => {
        if (!current(signal, version)) return;
        const draft = await options.port.readVerified(summary.recoveryRef, structuredClone(summary.ref!), signal);
        if (!current(signal, version)) return;
        if (!text(draft.draftId) || !equal(draft.ref, summary.ref) || validate(draft.document).length || draft.document.id !== summary.pageId) throw Error('RESPONSE_MISMATCH：已保存修订读取不匹配。');
        options.protectSaved?.();
        if (!lease!.accept(draft)) throw Error('当前工作副本存在冲突，保留本地内容与恢复锁。');
        await waitForProtection(signal);
        if (!current(signal, version)) return;
        if (!equal(options.coordinator.snapshot().ref, summary.ref)) throw Error('本地队列与已保存修订不同，保留本地内容与恢复锁。');
        lease?.release(); lease = null;
        emit({ phase: 'opened', message: '已打开并保护该精确修订，可以继续编辑。' });
      }, 'busy');
    },
    dispose() { disposed = true; generation++; controller?.abort(); lease?.release(); lease = null; listeners.clear(); }
  };
  async function operation(kind: 'recover' | 'cancel' | 'retryOriginal') {
    const summary = state.summary;
    if (!summary || !expected || disposed || state.busy) return;
    try { lock(expected.pageId); } catch (error) { emit({ phase: 'error', message: message(error) }); return; }
    await request(async (signal, version) => {
      if (!current(signal, version)) return;
      const result = kind === 'cancel' ? await options.port.cancel(summary.recoveryRef, signal) :
        await options.port[kind](summary.recoveryRef, (options.id ?? (() => crypto.randomUUID()))(), signal);
      if (current(signal, version)) await consume(result, signal, version);
    }, 'busy');
  }
  return api;
}
