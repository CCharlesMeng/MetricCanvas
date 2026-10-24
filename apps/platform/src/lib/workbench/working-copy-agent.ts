import {canonicalizeJson} from '@metriccanvas/page';
import type {DialogueAgentPort, DialoguePageRequest, DialoguePageInput} from '../integration/contract';
import type {PageRevision} from '../page-assets/contract';
import type {createAuthoringCoordinator} from './authoring-coordinator';

type Coordinator = ReturnType<typeof createAuthoringCoordinator>;
type Lease = ReturnType<Coordinator['beginLanguage']>;
export interface WorkingAgentState {
  phase: 'idle' | 'preparing' | 'running' | 'completed' | 'failed' | 'unknown';
  message: string;
}
async function documentHash(documentJson: string | null) {
  if (documentJson === null) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(documentJson));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

/** Coordinates frontend state; the injected cloud Adapter owns Agent execution and delivery. */
export function createWorkingCopyAgent(options: {
  coordinator: Coordinator;
  port: DialogueAgentPort;
  sessionId: string;
  flushInput(): void;
  beforeStart?(): Promise<void>;
  readPage(pageId: string, signal: AbortSignal): Promise<PageRevision>;
}) {
  let state: WorkingAgentState = {phase: 'idle', message: ''};
  let disposed = false, starting = false;
  let active: {lease: Lease; controller: AbortController; requestId: string} | null = null;
  let updates: Promise<void> = Promise.resolve();
  const listeners = new Set<(state: WorkingAgentState) => void>();

  function emit(phase: WorkingAgentState['phase'], message: string) {
    state = {phase, message};
    for (const listener of listeners) listener({...state});
  }
  function finish() {
    active?.lease.release();
    active = null;
  }
  async function inputOf(lease: Lease): Promise<DialoguePageInput> {
    const documentJson = lease.input ? canonicalizeJson(lease.input) : null;
    return {
      pageId: lease.input ? String(lease.input.id) : null,
      documentJson,
      documentSha256: await documentHash(documentJson),
      persistedRef: lease.base
    };
  }
  function settle(result: Awaited<ReturnType<DialogueAgentPort['send']>>, requestId: string, lease: Lease) {
    if (!lease.current()) {
      emit('failed', '页面身份或工作副本已变化，本轮回执未应用。');
      finish();
      return;
    }
    if (result.requestId !== requestId) throw Error('云宝轮次回执不匹配。');
    if (result.status === 'unknown') {
      emit('unknown', result.message ?? '本轮结果待核实，工作副本已保留。');
      return;
    }
    emit(result.status, result.message ?? (result.status === 'completed' ? '本轮处理完成。' : '本轮未完成，工作副本已保留。'));
    finish();
  }
  async function send(question: string, intent: DialoguePageRequest['intent']) {
    const preparing = options.coordinator.beginPreparation();
    let sent = false;
    try {
      preparing.flush(options.flushInput);
      await preparing.protectWorkingCopy();
      const lease = preparing.acquire(undefined, true);
      const controller = new AbortController(), requestId = crypto.randomUUID();
      active = {lease, controller, requestId};
      updates = Promise.resolve();
      const input = await inputOf(lease);
      if (disposed) return;
      if (!lease.current()) throw Error('创作输入冻结期间工作范围已变化。');
      emit('running', '云宝正在处理当前页面，编辑已暂时锁定。');
      sent = true;
      const result = await options.port.send({requestId, sessionId: options.sessionId, intent, question, input}, controller.signal);
      await updates;
      if (disposed || !active || active.requestId !== requestId) return;
      settle(result, requestId, lease);
    } catch (error) {
      if (!disposed) {
        emit(sent ? 'unknown' : 'failed', String(error));
        if (!sent) finish();
      }
    } finally {
      preparing.release();
    }
  }

  return {
    snapshot: () => ({...state}),
    subscribe(listener: (value: WorkingAgentState) => void) {
      listeners.add(listener);
      listener({...state});
      return () => {listeners.delete(listener);};
    },
    async start(question: string, intent: DialoguePageRequest['intent'] = 'adjust') {
      if (disposed || starting || active || !question.trim()) return;
      starting = true;
      try {
        await options.beforeStart?.();
        if (!disposed) {
          emit('preparing', '正在收齐前端最新修改。');
          await send(question, intent);
        }
      } catch (error) {
        if (!disposed) emit('failed', String(error));
      } finally {
        starting = false;
      }
    },
    applyPreview(value: unknown) {
      const turn = active;
      if (!turn) return Promise.reject(Error('页面通知不属于正在执行的云宝轮次。'));
      updates = updates.then(() => {
        if (active !== turn || disposed) throw Error('页面通知已过期。');
        return turn.lease.applyDocument(value);
      });
      return updates;
    },
    applyPage(pageId: string) {
      const turn = active;
      if (!turn) return Promise.reject(Error('页面通知不属于正在执行的云宝轮次。'));
      updates = updates.then(async () => {
        const revision = await options.readPage(pageId, turn.controller.signal);
        if (active !== turn || disposed) throw Error('页面通知已过期。');
        await turn.lease.applyRevision(revision);
      });
      return updates;
    },
    dispose() {
      disposed = true;
      active?.controller.abort();
      finish();
      listeners.clear();
    }
  };
}
