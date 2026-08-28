import type { LifecycleContext } from '@metriccanvas/page-lifecycle';
import type { AskConversationState } from '../../ask/conversation';
import type { AnalysisStepEvent, FailureStage } from './step-event';

/**
 * 分析会话存储端口(ADR-0030 轻量落库)。
 *
 * 能力:追加事件、保存/更新最新检查点、读取会话、按 actor 列出会话。
 * 可见性过滤在存储内真实
 * 执行:会话仅归属者本人与平台管理员(roles 含 admin)可见,不得因身份是
 * mock 而跳过过滤。存储不感知 HTTP;身份以平台统一的 LifecycleContext 传入。
 *
 * 本轮只有内存实现(./memory.ts);PostgreSQL 实现等 #52 的版本化迁移接入,
 * 不引入启动期建表,届时复用同一份契约测试(tests/session-store.contract.test.ts)。
 */

/** 分析会话保留期(ADR-0030/0058):自最后一次有效写入起 90 天。 */
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
  /** 最后一条步骤事件的时间;检查点写入不改写这个事件事实。 */
  lastEventAt: string;
  /** 最后一次事件或检查点写入时间;会话保留期与列表排序以它为准。 */
  lastActivityAt: string;
  eventCount: number;
  /** 问题原文,取自会话中首个域路由事件;尚无路由事件时为 null。 */
  question: string | null;
}

export interface AnalysisSession extends AnalysisSessionSummary {
  events: RecordedStepEvent[];
  /** 最新有效检查点;历史会话可缺省。 */
  checkpoint: AnalysisSessionCheckpoint | null;
}

export type SessionCheckpointStatus =
  | 'completed'
  | 'interaction_required'
  | 'failed'
  | 'cancelled';

export interface SessionCheckpointInteraction {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
}

export interface SessionCheckpointFailure {
  code: string;
  message: string;
  stage: FailureStage;
  retryable: boolean;
}

export interface SessionPinnedComponent {
  dataSourceId: string;
  componentType: string;
}

/**
 * 分析会话的最新有效检查点。
 *
 * 它是会话下的可恢复状态,不是页面修订:不进页面仓储、目录或
 * 发布治理。只保留最新一份,步骤事件仍保持追加式事实流。
 */
export interface AnalysisSessionCheckpoint {
  formatVersion: 1;
  /** 每次成功更新加一;本地编辑以它做乐观并发控制。 */
  version: number;
  /** 该检查点已观察到的最后一条会话事件序号。 */
  basedOnEventSequence: number;
  /** Agent 运行幂等键;本地编辑不改写。 */
  runId: string;
  status: SessionCheckpointStatus;
  /** 当前临时页面态;尚未产出文档或结果已清空时为 null。 */
  document: Record<string, unknown> | null;
  /** 页面文档的确定性哈希;document 为 null 时是 null 的哈希。 */
  contentHash: string;
  /** 可续跑的结构化问数状态;不保存完整对话和模型 prompt。 */
  askState: AskConversationState;
  pinnedComponents: SessionPinnedComponent[];
  interaction: SessionCheckpointInteraction | null;
  failure: SessionCheckpointFailure | null;
  updatedAt: string;
}

export interface AppendStepEventCommand {
  sessionId: string;
  event: AnalysisStepEvent;
}

export interface SaveSessionCheckpointCommand {
  sessionId: string;
  basedOnEventSequence: number;
  runId: string;
  status: SessionCheckpointStatus;
  document: Record<string, unknown> | null;
  contentHash: string;
  askState: AskConversationState;
  pinnedComponents: SessionPinnedComponent[];
  interaction: SessionCheckpointInteraction | null;
  failure: SessionCheckpointFailure | null;
}

export interface UpdateSessionCheckpointCommand {
  sessionId: string;
  expectedVersion: number;
  document: Record<string, unknown>;
  contentHash: string;
  pinnedComponents: SessionPinnedComponent[];
}

export type SessionStoreErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ACTOR_MISMATCH'
  | 'SESSION_CHECKPOINT_NOT_FOUND'
  | 'SESSION_CHECKPOINT_STALE';

export interface SessionStoreError {
  code: SessionStoreErrorCode;
  message: string;
  /** 乐观并发冲突时带回服务端当前版本,便于客户端提示刷新。 */
  currentCheckpointVersion?: number;
}

export type AppendStepEventResult =
  | { ok: true; session: AnalysisSessionSummary; event: RecordedStepEvent }
  | { ok: false; error: SessionStoreError };

export type AnalysisSessionResult =
  | { ok: true; session: AnalysisSession }
  | { ok: false; error: SessionStoreError };

export type SaveSessionCheckpointResult =
  | { ok: true; checkpoint: AnalysisSessionCheckpoint }
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
   * 保存 Agent 终态检查点。相同 runId 幂等返回既有结果;早于当前
   * basedOnEventSequence 的慢运行不得覆盖较新结果。
   */
  saveCheckpoint(
    command: SaveSessionCheckpointCommand,
    context: LifecycleContext
  ): Promise<SaveSessionCheckpointResult>;
  /** 保存工作台本地有效编辑;必须命中期望版本,避免多标签页静默覆盖。 */
  updateCheckpoint(
    command: UpdateSessionCheckpointCommand,
    context: LifecycleContext
  ): Promise<SaveSessionCheckpointResult>;
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
