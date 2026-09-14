import { normalizePageDocument, type PageDocument } from '@metriccanvas/page';
import type { CanvasAuthoringDraft } from './document-edit';
import type { DraftRef, OperationContext } from './authoring-coordinator';
import type { AuthoringStorage, StorageScope } from './authoring-storage';

export interface DurableSaveCommand {
  context: OperationContext; base: DraftRef | null; pageId: string; document: PageDocument;
  description: string; retainDimensionValues: boolean;
}
export interface StrongSaved {
  status: 'saved'; operationId: string; ref: DraftRef; base: DraftRef | null;
  contentHash: string; canonicalization: string; revisionNumber: number;
}
export type StrongSaveOutcome = StrongSaved
  | { status: 'pending' | 'unknown'; operationId: string; message?: string }
  | { status: 'rejected'; operationId: string; code: string; message: string; retryable: boolean };
export type OperationLookup = StrongSaveOutcome | { status: 'not-applied'; operationId: string; retrySafe: boolean };
/** All methods are proposed service ports. No speculative production URL is installed. */
export interface StableSavePort {
  stableSave: boolean;
  save(command: DurableSaveCommand): Promise<StrongSaveOutcome>;
  lookup(context: OperationContext): Promise<OperationLookup>;
  verifySaved(command: DurableSaveCommand, saved: StrongSaved): Promise<boolean>;
}
export const unavailableStableSave: StableSavePort = {
  stableSave: false,
  async save(command) { return { status: 'rejected', operationId: command.context.operationId, code: 'CAPABILITY_UNAVAILABLE', message: '服务尚未确认稳定幂等保存，工作仅在浏览器保护。', retryable: false }; },
  async lookup(context) { return { status: 'unknown', operationId: context.operationId }; },
  async verifySaved() { return false; }
};
interface QueuedOperation {
  operationId: string; document: PageDocument; description: string; retainDimensionValues: boolean;
  command?: DurableSaveCommand; outcome?: StrongSaveOutcome;
}
export interface DurableAuthoringState {
  format: 1; scope: StorageScope; base: DraftRef | null; draft: CanvasAuthoringDraft;
  queue: QueuedOperation[];
}
export interface SyncSnapshot {
  pending: number; protection: 'pending' | 'protected' | 'failed';
  phase: 'idle' | 'saving' | 'unavailable' | 'unknown' | 'rejected' | 'storage-failed' | 'identity-changed';
  message: string; base: DraftRef | null; lastSaved: StrongSaved | null;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  return JSON.stringify(value);
}
function same(a: unknown, b: unknown): boolean { return canonical(a) === canonical(b); }
function messageOf(error: unknown) { return error instanceof Error ? error.message : String(error); }

export function createAuthoringSync(options: {
  initial: DurableAuthoringState;
  storage: AuthoringStorage<DurableAuthoringState>;
  port: StableSavePort;
  identity(): Pick<StorageScope, 'actorId' | 'workspaceId'>;
  operationId?: () => string;
  restoredVersion?: number;
  online?: boolean;
  retryDelays?: readonly number[];
}) {
  let state = structuredClone(options.initial);
  let storageVersion = options.restoredVersion ?? 0;
  let durable = options.restoredVersion !== undefined, disposed = false, running = false;
  // A durable command may have crossed the network even when no outcome was stored.
  if (options.restoredVersion && state.queue[0]?.command && !state.queue[0].outcome) state.queue[0].outcome = { status: 'unknown', operationId: state.queue[0].operationId, message: '恢复的原操作等待核实。' };
  let online = options.online ?? true;
  let attempts = 0, retryBlocked = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const delays = options.retryDelays ?? [1000, 3000, 10000];
  let identityInvalidated = false;
  const restoredOutcome = state.queue[0]?.outcome;
  let status: SyncSnapshot = { pending: state.queue.length, protection: durable ? 'protected' : 'pending', phase: state.queue[0]?.outcome?.status === 'rejected' ? 'rejected' : 'idle', message: restoredOutcome && restoredOutcome.status !== 'saved' ? restoredOutcome.message ?? '' : '', base: state.base, lastSaved: null };
  let serial: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(value: SyncSnapshot) => void>();
  const identityMatches = () => {
    const identity = options.identity();
    if (!identity.actorId || !identity.workspaceId || identity.actorId !== state.scope.actorId || identity.workspaceId !== state.scope.workspaceId) identityInvalidated = true;
    return !identityInvalidated;
  };
  const snapshot = (): SyncSnapshot => structuredClone({ ...status, pending: state.queue.length, base: state.base });
  const emit = () => { if (!disposed) for (const listener of listeners) listener(snapshot()); };
  function transaction(change: () => void): Promise<boolean> {
    const result = serial.then(async () => {
      if (disposed) return false;
      if (!identityMatches()) { pause('identity-changed', '身份已变化，原队列已停写停发，请重新打开页面。'); return false; }
      change(); durable = false; status.protection = 'pending'; emit();
      try {
        storageVersion = await options.storage.write(state.scope, storageVersion, structuredClone(state));
        if (disposed) return false;
        if (!identityMatches()) { pause('identity-changed', '身份已变化，原记录已保留，请重新打开页面。'); return false; }
        durable = true; status.protection = 'protected'; emit(); return true;
      } catch (error) {
        status = { ...status, phase: 'storage-failed', protection: 'failed', message: messageOf(error) }; emit(); return false;
      }
    });
    serial = result.catch(() => {}); return result;
  }
  function scheduleRetry() {
    if (timer || disposed || running || !online || !durable || retryBlocked || !options.port.stableSave || !state.queue.length || state.queue[0].outcome?.status === 'rejected' || !identityMatches() || attempts >= delays.length) return;
    timer = setTimeout(() => { timer = undefined; attempts++; void api.retry(false); }, delays[attempts]);
  }
  function pause(phase: SyncSnapshot['phase'], message: string) { status = { ...status, phase, message }; emit(); }
  async function accept(command: DurableSaveCommand, outcome: StrongSaveOutcome): Promise<boolean> {
    if (!identityMatches()) { pause('identity-changed', '身份已变化，已停止同步；原工作保留在原用户范围。'); return false; }
    if (!outcome || typeof outcome !== 'object' || !['saved', 'pending', 'unknown', 'rejected'].includes(outcome.status) || outcome.operationId !== command.context.operationId) { retryBlocked = true; outcome = { status: 'unknown', operationId: command.context.operationId, message: 'RESPONSE_MISMATCH：操作回执不匹配。' }; }
    if (outcome.status === 'saved') {
      const matching = !!outcome.ref && typeof outcome.ref === 'object' && same(outcome.base, command.base) && outcome.ref.pageId === command.pageId &&
        Number.isInteger(outcome.revisionNumber) && outcome.revisionNumber > 0 &&
        [outcome.ref.revisionId, outcome.ref.resourceId, outcome.contentHash, outcome.canonicalization].every((value) => typeof value === 'string' && value.length > 0) &&
        (!command.base || (outcome.ref.resourceId === command.base.resourceId && outcome.ref.revisionId !== command.base.revisionId));
      let verified = false;
      try { verified = matching && await options.port.verifySaved(command, outcome); } catch { /* uncertain verification never acknowledges a save */ }
      if (!verified) { retryBlocked = true; }
      if (!verified) outcome = { status: 'unknown', operationId: command.context.operationId, message: 'RESPONSE_MISMATCH：保存引用或完整性验证失败。' };
    }
    if (!identityMatches()) { pause('identity-changed', '身份已变化，原已发操作等待原身份重新打开后核实。'); return false; }
    // Persist only the declared receipt fields, never arbitrary transport metadata.
    const result: StrongSaveOutcome = outcome.status === 'saved'
      ? { status: 'saved', operationId: outcome.operationId, ref: { pageId: outcome.ref.pageId, revisionId: outcome.ref.revisionId, resourceId: outcome.ref.resourceId }, base: command.base, contentHash: outcome.contentHash, canonicalization: outcome.canonicalization, revisionNumber: outcome.revisionNumber }
      : outcome.status === 'rejected'
        ? { status: 'rejected', operationId: outcome.operationId, code: outcome.code, message: outcome.message, retryable: outcome.retryable === true }
        : { status: outcome.status, operationId: outcome.operationId, message: outcome.message };
    const protectedResult = await transaction(() => {
      const head = state.queue[0];
      if (!head || head.operationId !== command.context.operationId) return;
      if (result.status === 'saved') { state.base = result.ref; state.queue.shift(); status.lastSaved = result; }
      else head.outcome = result;
    });
    if (!protectedResult) return false;
    if (result.status === 'saved') { pause('idle', ''); return true; }
    pause(result.status === 'rejected' ? 'rejected' : 'unknown', result.message ?? '保存结果未确定，已暂停同步。');
    return false;
  }
  async function pump() {
    if (running || disposed || !durable || !state.queue.length || !online) return;
    if (!identityMatches()) { pause('identity-changed', '身份已变化，已暂停同步。'); return; }
    if (!options.port.stableSave) { pause('unavailable', '服务尚未确认稳定幂等保存，工作已在浏览器保护。'); return; }
    if (state.queue[0].outcome || status.phase === 'identity-changed') return;
    running = true;
    try {
      while (!disposed && durable && online && state.queue.length && identityMatches()) {
        const operation = state.queue[0];
        if (operation.outcome) break;
        if (!operation.command) {
          const protectedCommand = await transaction(() => {
            operation.command = { context: { operationId: operation.operationId, actorId: state.scope.actorId, workspaceId: state.scope.workspaceId, origin: { kind: 'manual' } },
              base: structuredClone(state.base), pageId: state.scope.pageId, document: operation.document,
              description: operation.description, retainDimensionValues: operation.retainDimensionValues };
          });
          if (!protectedCommand || disposed || !identityMatches()) break;
        }
        const command = structuredClone(operation.command!);
        pause('saving', '正在同步…');
        let outcome: StrongSaveOutcome;
        try { outcome = await options.port.save(command); }
        catch (error) { outcome = { status: 'unknown', operationId: operation.operationId, message: messageOf(error) }; }
        if (!await accept(command, outcome)) break;
      }
    } finally {
      running = false;
      if (!disposed && durable && online && state.queue.length && !state.queue[0].outcome && identityMatches() && options.port.stableSave) queueMicrotask(() => void pump());
      else scheduleRetry();
    }
  }
  const api = {
    snapshot,
    start() {
      if (!durable) { void transaction(() => {}).then((protectedWork) => { if (protectedWork) void pump(); }); return; }
      if (state.queue[0]?.outcome) void api.retry(false); else void pump();
    },
    setOnline(value: boolean) {
      const reconnect = !online && value; online = value;
      if (!value && timer) { clearTimeout(timer); timer = undefined; }
      if (reconnect) { attempts = 0; if (!retryBlocked) void api.retry(false); }
    },
    subscribe(listener: (value: SyncSnapshot) => void) { listeners.add(listener); listener(snapshot()); return () => { listeners.delete(listener); }; },
    /** Exactly one call for one committed edit, never an input/drag intermediate. */
    async enqueue(draft: CanvasAuthoringDraft, description: string, retainDimensionValues: boolean): Promise<void> {
      if (!identityMatches()) { pause('identity-changed', '身份已变化，编辑未写入旧用户记录，请重新打开页面。'); return; }
      const parsed = normalizePageDocument(draft.pageDocument);
      if (!parsed.ok || parsed.document.id !== state.scope.pageId) throw new Error('无效页面操作，未加入保存队列。');
      const operationId = options.operationId?.() ?? crypto.randomUUID();
      const persisted = await transaction(() => {
        if (same(state.draft.pageDocument, parsed.document)) { state.draft = structuredClone(draft); return; }
        state.draft = structuredClone(draft);
        state.queue.push({ operationId, document: parsed.document, description, retainDimensionValues });
      });
      if (persisted) void pump();
    },
    /** Explicit retry first resolves the original key; unknown is never treated as not applied. */
    async retry(manual = true): Promise<void> {
      if (manual) { attempts = 0; if (timer) { clearTimeout(timer); timer = undefined; } }
      await serial;
      if (disposed || running || !online || !identityMatches()) return;
      if (!durable && !await transaction(() => {})) return;
      const head = state.queue[0];
      if (!head) return;
      if (!options.port.stableSave) { void pump(); return; }
      if (!head.command || !head.outcome) { void pump(); return; }
      if (head.outcome.status === 'rejected') return;
      running = true;
      try {
        const result = await options.port.lookup(head.command.context);
        if (!identityMatches()) { pause('identity-changed', '身份已变化，已暂停同步。'); return; }
        if (!result || typeof result !== 'object' || result.operationId !== head.operationId) { retryBlocked = true; pause('unknown', '操作查询回执不匹配。'); return; }
        if (result.status === 'not-applied') {
          if (result.retrySafe !== true) { retryBlocked = true; pause('unknown', '服务无法保证幂等重试窗口，请保留工作并人工核实。'); return; }
          await transaction(() => { delete head.outcome; });
        } else await accept(head.command, result);
      } catch (error) { pause('unknown', messageOf(error)); }
      finally { running = false; scheduleRetry(); }
      void pump();
    },
    dispose() { disposed = true; if (timer) clearTimeout(timer); listeners.clear(); }
  };
  return api;
}
