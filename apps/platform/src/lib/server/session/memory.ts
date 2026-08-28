import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import type { AnalysisStepEvent } from './step-event';
import {
  SESSION_RETENTION_MS,
  type AnalysisSessionList,
  type AnalysisSessionCheckpoint,
  type AnalysisSessionResult,
  type AnalysisSessionStore,
  type AnalysisSessionSummary,
  type AppendStepEventCommand,
  type AppendStepEventResult,
  type RecordedStepEvent,
  type SaveSessionCheckpointCommand,
  type SaveSessionCheckpointResult,
  type SessionStoreError,
  type SessionStoreErrorCode,
  type UpdateSessionCheckpointCommand
} from './store';

export interface MemoryAnalysisSessionStoreOptions {
  /** 可注入时钟:保留期与事件时刻全部经由它取值,测试不依赖真实时间。 */
  clock?: { now(): Date };
}

interface MemorySession {
  sessionId: string;
  actorId: string;
  startedAt: Date;
  lastEventAt: Date;
  lastActivityAt: Date;
  events: { sequence: number; occurredAt: Date; event: AnalysisStepEvent }[];
  checkpoint: Omit<AnalysisSessionCheckpoint, 'updatedAt'> & { updatedAt: Date } | null;
}

/**
 * 进程内分析会话存储,实现与未来 PostgreSQL 适配器相同的端口
 * (行为契约见 tests/session-store.contract.test.ts),状态在进程退出后清空。
 *
 * 保留期清理不是独立的定时任务:每次读写都先按注入时钟剔除保留期外的会话,
 * 因此过期数据在任何路径上都不可见;pruneExpiredSessions 是同一逻辑的显式入口。
 */
export function createMemoryAnalysisSessionStore(
  options: MemoryAnalysisSessionStoreOptions = {}
): AnalysisSessionStore {
  const sessions = new Map<string, MemorySession>();
  const clock = options.clock ?? { now: () => new Date() };

  function pruneExpired(now: Date): number {
    let removed = 0;
    for (const [sessionId, session] of sessions) {
      if (now.getTime() - session.lastActivityAt.getTime() > SESSION_RETENTION_MS) {
        sessions.delete(sessionId);
        removed += 1;
      }
    }
    return removed;
  }

  function visibleTo(session: MemorySession, context: LifecycleContext): boolean {
    return session.actorId === context.actorId || isPlatformAdmin(context);
  }

  return {
    async appendEvent(
      command: AppendStepEventCommand,
      context: LifecycleContext
    ): Promise<AppendStepEventResult> {
      const now = clock.now();
      pruneExpired(now);
      let session = sessions.get(command.sessionId);
      if (!session) {
        session = {
          sessionId: command.sessionId,
          actorId: context.actorId,
          startedAt: now,
          lastEventAt: now,
          lastActivityAt: now,
          events: [],
          checkpoint: null
        };
        sessions.set(command.sessionId, session);
      } else if (session.actorId !== context.actorId) {
        return failure(
          'SESSION_ACTOR_MISMATCH',
          `会话 ${command.sessionId} 归属 ${session.actorId},追加事件仅限本人`
        );
      }
      const recorded = {
        sequence: session.events.length + 1,
        occurredAt: now,
        // 深拷贝入库,调用方之后修改自己手里的事件对象不影响已落库内容。
        event: structuredClone(command.event)
      };
      session.events.push(recorded);
      session.lastEventAt = now;
      session.lastActivityAt = now;
      return { ok: true, session: toSummary(session), event: toRecorded(recorded) };
    },

    async saveCheckpoint(
      command: SaveSessionCheckpointCommand,
      context: LifecycleContext
    ): Promise<SaveSessionCheckpointResult> {
      const now = clock.now();
      pruneExpired(now);
      const session = sessions.get(command.sessionId);
      const accessError = checkpointWriteError(session, command.sessionId, context);
      if (accessError) return { ok: false, error: accessError };

      const current = session!.checkpoint;
      // runId 是 Agent 终态写的幂等键;重试不重复增加版本。
      if (current?.runId === command.runId) {
        return { ok: true, checkpoint: toCheckpoint(current) };
      }
      if (current && command.basedOnEventSequence < current.basedOnEventSequence) {
        return checkpointStale(
          `运行 ${command.runId} 只观察到事件 ${command.basedOnEventSequence},` +
            `新检查点已到 ${current.basedOnEventSequence}`,
          current.version
        );
      }
      const checkpoint: MemorySession['checkpoint'] = {
        formatVersion: 1,
        version: (current?.version ?? 0) + 1,
        basedOnEventSequence: command.basedOnEventSequence,
        runId: command.runId,
        status: command.status,
        document: cloneNullableRecord(command.document),
        contentHash: command.contentHash,
        askState: structuredClone(command.askState),
        pinnedComponents: structuredClone(command.pinnedComponents),
        interaction: command.interaction === null ? null : structuredClone(command.interaction),
        failure: command.failure === null ? null : structuredClone(command.failure),
        updatedAt: now
      };
      session!.checkpoint = checkpoint;
      session!.lastActivityAt = now;
      return { ok: true, checkpoint: toCheckpoint(checkpoint) };
    },

    async updateCheckpoint(
      command: UpdateSessionCheckpointCommand,
      context: LifecycleContext
    ): Promise<SaveSessionCheckpointResult> {
      const now = clock.now();
      pruneExpired(now);
      const session = sessions.get(command.sessionId);
      const accessError = checkpointWriteError(session, command.sessionId, context);
      if (accessError) return { ok: false, error: accessError };
      const current = session!.checkpoint;
      if (!current) {
        return failure(
          'SESSION_CHECKPOINT_NOT_FOUND',
          `会话 ${command.sessionId} 尚无可更新的检查点`
        );
      }
      if (current.version !== command.expectedVersion) {
        return checkpointStale(
          `检查点期望版本 ${command.expectedVersion},当前为 ${current.version}`,
          current.version
        );
      }
      if (
        current.contentHash === command.contentHash &&
        samePinnedComponents(current.pinnedComponents, command.pinnedComponents)
      ) {
        // 防抖之外再做内容去重:无变化写不增版本、不延长保留期。
        return { ok: true, checkpoint: toCheckpoint(current) };
      }
      const checkpoint: NonNullable<MemorySession['checkpoint']> = {
        ...current,
        version: current.version + 1,
        document: structuredClone(command.document),
        contentHash: command.contentHash,
        pinnedComponents: structuredClone(command.pinnedComponents),
        updatedAt: now
      };
      session!.checkpoint = checkpoint;
      session!.lastActivityAt = now;
      return { ok: true, checkpoint: toCheckpoint(checkpoint) };
    },

    async getSession(
      reference: { sessionId: string },
      context: LifecycleContext
    ): Promise<AnalysisSessionResult> {
      pruneExpired(clock.now());
      const session = sessions.get(reference.sessionId);
      // 不可见与不存在同响应,避免经由错误码探测他人会话的存在性。
      if (!session || !visibleTo(session, context)) {
        return failure('SESSION_NOT_FOUND', `会话 ${reference.sessionId} 不存在`);
      }
      return {
        ok: true,
        session: {
          ...toSummary(session),
          events: session.events.map(toRecorded),
          checkpoint: session.checkpoint === null ? null : toCheckpoint(session.checkpoint)
        }
      };
    },

    async listSessions(context: LifecycleContext): Promise<AnalysisSessionList> {
      pruneExpired(clock.now());
      const visible = [...sessions.values()].filter((session) => visibleTo(session, context));
      visible.sort(
        (a, b) =>
          b.lastActivityAt.getTime() - a.lastActivityAt.getTime() ||
          a.sessionId.localeCompare(b.sessionId)
      );
      return { sessions: visible.map(toSummary) };
    },

    async pruneExpiredSessions(): Promise<{ removedSessions: number }> {
      return { removedSessions: pruneExpired(clock.now()) };
    }
  };
}

function isPlatformAdmin(context: LifecycleContext): boolean {
  return context.roles?.includes('admin') ?? false;
}

function toSummary(session: MemorySession): AnalysisSessionSummary {
  const routed = session.events.find((entry) => entry.event.type === 'domain_routed');
  return {
    sessionId: session.sessionId,
    actorId: session.actorId,
    startedAt: session.startedAt.toISOString(),
    lastEventAt: session.lastEventAt.toISOString(),
    lastActivityAt: session.lastActivityAt.toISOString(),
    eventCount: session.events.length,
    question: routed?.event.type === 'domain_routed' ? routed.event.question : null
  };
}

function toCheckpoint(
  checkpoint: NonNullable<MemorySession['checkpoint']>
): AnalysisSessionCheckpoint {
  const { updatedAt, ...rest } = checkpoint;
  return {
    ...structuredClone(rest),
    updatedAt: updatedAt.toISOString()
  };
}

function cloneNullableRecord(
  value: Record<string, unknown> | null
): Record<string, unknown> | null {
  return value === null ? null : structuredClone(value);
}

function samePinnedComponents(
  left: readonly { dataSourceId: string; componentType: string }[],
  right: readonly { dataSourceId: string; componentType: string }[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.dataSourceId === right[index]?.dataSourceId &&
        entry.componentType === right[index]?.componentType
    )
  );
}

function checkpointWriteError(
  session: MemorySession | undefined,
  sessionId: string,
  context: LifecycleContext
): SessionStoreError | null {
  if (!session) {
    return { code: 'SESSION_NOT_FOUND', message: `会话 ${sessionId} 不存在` };
  }
  if (session.actorId !== context.actorId) {
    return {
      code: 'SESSION_ACTOR_MISMATCH',
      message: `会话 ${sessionId} 归属 ${session.actorId},检查点写入仅限本人`
    };
  }
  return null;
}

function checkpointStale(
  message: string,
  currentCheckpointVersion: number
): { ok: false; error: SessionStoreError } {
  return {
    ok: false,
    error: { code: 'SESSION_CHECKPOINT_STALE', message, currentCheckpointVersion }
  };
}

function toRecorded(entry: MemorySession['events'][number]): RecordedStepEvent {
  return {
    sequence: entry.sequence,
    occurredAt: entry.occurredAt.toISOString(),
    event: structuredClone(entry.event)
  };
}

function failure(
  code: SessionStoreErrorCode,
  message: string
): { ok: false; error: SessionStoreError } {
  return { ok: false, error: { code, message } };
}
