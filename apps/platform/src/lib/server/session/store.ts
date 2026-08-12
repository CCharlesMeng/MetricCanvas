import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import type { AnalysisStepEvent } from './step-event';

/**
 * 分析会话存储端口(ADR-0030 轻量落库)。
 *
 * 三个能力:追加事件、读取会话、按 actor 列出会话。可见性过滤在存储内真实
 * 执行:会话仅归属者本人与平台管理员(roles 含 admin)可见,不得因身份是
 * mock 而跳过过滤。存储不感知 HTTP;身份以平台统一的 LifecycleContext 传入。
 *
 * 本轮只有内存实现(./memory.ts);PostgreSQL 实现等 #52 的版本化迁移接入,
 * 不引入启动期建表,届时复用同一份契约测试(tests/session-store.contract.test.ts)。
 */

/** 分析会话保留期(ADR-0030):自最后一个事件起 90 天,过期由存储清理。 */
export const SESSION_RETENTION_DAYS = 90;
export const SESSION_RETENTION_MS = SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** 已落库的步骤事件:契约事件加上存储分配的序号与落库时刻。 */
export interface RecordedStepEvent {
  /** 会话内从 1 开始单调递增;读取按该序号稳定排序,同一时钟毫秒内仍保持追加顺序。 */
  sequence: number;
  /** 落库时刻(ISO 8601),取自存储注入的时钟。 */
  occurredAt: string;
  event: AnalysisStepEvent;
}

export interface AnalysisSessionSummary {
  sessionId: string;
  /** 会话归属者:首次追加事件的 actorId,此后不可变;可见性过滤的依据(ADR-0030)。 */
  actorId: string;
  startedAt: string;
  lastEventAt: string;
  eventCount: number;
  /** 问题原文,取自会话中首个域路由事件;尚无路由事件时为 null。 */
  question: string | null;
}

export interface AnalysisSession extends AnalysisSessionSummary {
  events: RecordedStepEvent[];
}

export interface AppendStepEventCommand {
  sessionId: string;
  event: AnalysisStepEvent;
}

export type SessionStoreErrorCode = 'SESSION_NOT_FOUND' | 'SESSION_ACTOR_MISMATCH';

export interface SessionStoreError {
  code: SessionStoreErrorCode;
  message: string;
}

export type AppendStepEventResult =
  | { ok: true; session: AnalysisSessionSummary; event: RecordedStepEvent }
  | { ok: false; error: SessionStoreError };

export type AnalysisSessionResult =
  | { ok: true; session: AnalysisSession }
  | { ok: false; error: SessionStoreError };

export interface AnalysisSessionList {
  sessions: AnalysisSessionSummary[];
}

export interface AnalysisSessionStore {
  /**
   * 追加步骤事件。sessionId 由编排方生成;首次追加即创建会话并固定归属者。
   * 追加只属于归属者本人:向他人会话追加返回 SESSION_ACTOR_MISMATCH,
   * 平台管理员也不例外(admin 的特权只在读取侧)。
   */
  appendEvent(
    command: AppendStepEventCommand,
    context: LifecycleContext
  ): Promise<AppendStepEventResult>;
  /**
   * 读取会话与全量事件流。对非归属者且非管理员,不可见与不存在同响应
   * (SESSION_NOT_FOUND),不经由错误码暴露他人会话的存在性。
   */
  getSession(
    reference: { sessionId: string },
    context: LifecycleContext
  ): Promise<AnalysisSessionResult>;
  /** 按 actor 列出会话:本人只见自己的,管理员可见全部;按最后活跃时间倒序。 */
  listSessions(context: LifecycleContext): Promise<AnalysisSessionList>;
  /**
   * 删除保留期外的会话并返回数量。读写路径也会顺带清理(过期会话在任何
   * 操作里都不可见),这里额外暴露显式入口供未来调度器周期调用。
   */
  pruneExpiredSessions(): Promise<{ removedSessions: number }>;
}
