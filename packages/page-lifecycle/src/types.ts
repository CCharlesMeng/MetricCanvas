import type { PageDocument, TypedError } from '@metriccanvas/page';

export interface DataContextVersion {
  version: string;
}

/**
 * page-lifecycle 只需要给页面修订盖创作依据版本印章,不需要完整数据
 * 上下文快照(那是 `@metriccanvas/mcp` 的 `DataContextProvider`)。
 * 命名带 `Version` 前缀以避免与之同名但契约不同(ADR-0024)。
 */
export interface DataContextVersionProvider {
  current(): Promise<DataContextVersion>;
}

export interface LifecycleContext {
  actorId: string;
  clientId: string;
  roles?: readonly LifecycleRole[];
}

export type LifecycleRole = 'publisher' | 'admin';

export interface PageRevision {
  revisionId: string;
  revisionNumber: number;
  pageId: string;
  baseRevisionId: string | null;
  document: PageDocument;
  contentHash: string;
  dataContextVersion: string | null;
  createdBy: string;
  createdAt: string;
}

export interface SaveRevisionCommand {
  pageId: string;
  baseRevisionId: string | null;
  document: unknown;
  idempotencyKey: string;
  /**
   * 首次保存(该 pageId 尚不存在任何修订)前必须显式确认为 true,否则
   * 返回 `PAGE_ID_CONFIRMATION_REQUIRED`;后续修订忽略此字段。语义与
   * 原 MCP 客户端装饰器 `createPageIdConfirmationMcpClient` 一致,现由
   * lifecycle 统一强制,HTTP 与 MCP 两条入口共享同一约束。
   */
  pageIdConfirmed?: boolean;
}

export interface RevisionReference {
  pageId: string;
  revisionId: string;
}

export type PageVisibility = 'visible' | 'hidden';

export type PageRevisionSelector =
  | { type: 'latest' }
  | { type: 'published' }
  | { type: 'exact'; revisionId: string };

export interface PageReference {
  pageId: string;
  selector: PageRevisionSelector;
}

export interface PageListQuery {
  afterPageId?: string;
  limit?: number;
}

export interface PageListItem {
  pageId: string;
  latestRevision: RevisionReference | null;
  publishedRevision: RevisionReference | null;
  visibility: PageVisibility;
}

export interface PageList {
  pages: PageListItem[];
  nextPageId: string | null;
}

export interface RevisionHistory {
  pageId: string;
  revisions: PageRevision[];
}

export interface RevisionDiffReference {
  pageId: string;
  fromRevisionId: string;
  toRevisionId: string;
}

/**
 * 本地定义而不是复用 `postgres` 包的同名类型：这个类型是公开 API
 * 的一部分（`JsonDiffEntry`），而 `postgres` 只是 postgres 端实现
 * 的运行时依赖，公开类型不应绑定到某一种存储实现上。
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

export interface JsonDiffEntry {
  op: 'add' | 'remove' | 'replace';
  path: string;
  before?: JSONValue;
  after?: JSONValue;
}

export interface RevisionDiff {
  pageId: string;
  fromRevisionId: string;
  toRevisionId: string;
  changes: JsonDiffEntry[];
}

export interface PublishedReference {
  pageId: string;
}

export interface RequestPublishCommand {
  pageId: string;
  revisionId: string;
  idempotencyKey: string;
}

export interface ConfirmPublishCommand {
  requestId: string;
  token: string;
}

export interface RejectPublishCommand {
  requestId: string;
  token: string;
  reason?: string;
}

export interface CancelPublishCommand {
  requestId: string;
  reason?: string;
}

export interface ForceReleasePublishCommand {
  requestId: string;
  reason: string;
}

export interface RollbackRevisionCommand {
  pageId: string;
  targetRevisionId: string;
  idempotencyKey: string;
}

export interface PublishRequest {
  requestId: string;
  pageId: string;
  revisionId: string;
  expiresAt: string;
  confirmationUrl: string;
}

export type PublishRequestStatus =
  | 'pending'
  | 'published'
  | 'expired'
  | 'validation_failed'
  | 'rejected'
  | 'cancelled'
  | 'force_released';

export interface PublishRequestDetails {
  requestId: string;
  pageId: string;
  revisionId: string;
  requestedBy: string;
  requestedClientId: string;
  status: PublishRequestStatus;
  expiresAt: string;
  decidedBy: string | null;
  decidedClientId: string | null;
  decidedAt: string | null;
}

export type PublishAuditAction =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'force_released'
  | 'validation_failed';

export interface PublishAuditEvent {
  auditId: string;
  requestId: string;
  pageId: string;
  revisionId: string;
  action: PublishAuditAction;
  actorId: string | null;
  clientId: string | null;
  occurredAt: string;
  reason: string | null;
}

export type PublishAuditResult =
  | { ok: true; events: PublishAuditEvent[] }
  | { ok: false; error: LifecycleError };

export type LifecycleErrorCode =
  | 'INVALID_PAGE'
  | 'PAGE_ID_MISMATCH'
  | 'PAGE_ID_TAKEN'
  | 'PAGE_ID_CONFIRMATION_REQUIRED'
  | 'PAGE_NOT_FOUND'
  | 'REVISION_NOT_FOUND'
  | 'REVISION_NOT_PUBLISHED'
  | 'REVISION_CONFLICT'
  | 'REVISION_NOT_LATEST'
  | 'PAGE_LOCKED'
  | 'PAGE_NOT_PUBLISHED'
  | 'PUBLISH_REQUEST_NOT_FOUND'
  | 'PUBLISH_REQUEST_EXPIRED'
  | 'PUBLISH_REQUEST_CLOSED'
  | 'INVALID_CONFIRMATION_TOKEN'
  | 'PUBLISH_FORBIDDEN';

export interface LifecycleError {
  code: LifecycleErrorCode;
  message: string;
  validationErrors?: TypedError[];
  currentLatestRevision?: PageRevision | null;
}

export type RevisionResult =
  | { ok: true; revision: PageRevision }
  | { ok: false; error: LifecycleError };

export type RevisionHistoryResult =
  | { ok: true; history: RevisionHistory }
  | { ok: false; error: LifecycleError };

export type RevisionDiffResult =
  | { ok: true; diff: RevisionDiff }
  | { ok: false; error: LifecycleError };

export type PublishRequestResult =
  | { ok: true; request: PublishRequest }
  | { ok: false; error: LifecycleError };

export type PublishRequestDetailsResult =
  | { ok: true; request: PublishRequestDetails }
  | { ok: false; error: LifecycleError };

export interface PageLifecycle {
  saveRevision(command: SaveRevisionCommand, context: LifecycleContext): Promise<RevisionResult>;
  getRevision(reference: RevisionReference): Promise<RevisionResult>;
  getPage(reference: PageReference): Promise<RevisionResult>;
  listPages(query?: PageListQuery): Promise<PageList>;
  listRevisionHistory(reference: { pageId: string }): Promise<RevisionHistoryResult>;
  diffRevisions(reference: RevisionDiffReference): Promise<RevisionDiffResult>;
  requestPublish(
    command: RequestPublishCommand,
    context: LifecycleContext
  ): Promise<PublishRequestResult>;
  getPublishRequest(
    reference: { requestId: string },
    context: LifecycleContext
  ): Promise<PublishRequestDetailsResult>;
  confirmPublish(
    command: ConfirmPublishCommand,
    context: LifecycleContext
  ): Promise<RevisionResult>;
  rejectPublish(
    command: RejectPublishCommand,
    context: LifecycleContext
  ): Promise<PublishRequestDetailsResult>;
  cancelPublish(
    command: CancelPublishCommand,
    context: LifecycleContext
  ): Promise<PublishRequestDetailsResult>;
  forceReleasePublish(
    command: ForceReleasePublishCommand,
    context: LifecycleContext
  ): Promise<PublishRequestDetailsResult>;
  listPublishAudit(
    reference: { requestId: string },
    context: LifecycleContext
  ): Promise<PublishAuditResult>;
  rollbackRevision(
    command: RollbackRevisionCommand,
    context: LifecycleContext
  ): Promise<RevisionResult>;
  getPublished(reference: PublishedReference): Promise<RevisionResult>;
  getPublishedRevision(reference: RevisionReference): Promise<RevisionResult>;
  close(): Promise<void>;
}
