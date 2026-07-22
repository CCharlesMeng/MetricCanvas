import { createHash, randomUUID } from 'node:crypto';
import {
  canonicalizeJson,
  validate,
  versionPolicy,
  type Page
} from '@metriccanvas/page';
import type {
  CatalogProvider,
  LifecycleContext,
  LifecycleError,
  LifecycleErrorCode,
  PageLifecycle,
  PageList,
  PageReference,
  PageRevision,
  PublishAuditAction,
  PublishAuditEvent,
  PublishRequestDetails,
  PublishRequestDetailsResult,
  PublishRequestResult,
  PublishRequestStatus,
  RevisionResult
} from './index';

export interface MemoryPageLifecycleOptions {
  catalog: CatalogProvider;
  clock?: { now(): Date };
  ids?: { next(): string };
  tokens?: { next(): string };
  urls?: { confirmation(requestId: string, token: string): string };
  publishLeaseMs?: number;
}

interface MemoryPage {
  revisions: PageRevision[];
  publishedRevisionId: string | null;
  activePublishRequestId: string | null;
}

interface MemoryPublishRequest extends PublishRequestDetails {
  tokenHash: string;
  confirmationUrl: string;
}

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

/**
 * 进程内页面生命周期仅用于无外部依赖的本地体验。它实现与 PostgreSQL
 * 适配器相同的端口，但状态会在开发服务器退出或重启后清空。
 */
export function createMemoryPageLifecycle(
  options: MemoryPageLifecycleOptions
): PageLifecycle {
  const pages = new Map<string, MemoryPage>();
  const requests = new Map<string, MemoryPublishRequest>();
  const audits = new Map<string, PublishAuditEvent[]>();
  const idempotency = new Map<string, RevisionResult | PublishRequestResult>();
  const clock = options.clock ?? { now: () => new Date() };
  const ids = options.ids ?? { next: () => randomUUID() };
  const tokens = options.tokens ?? { next: () => randomUUID() };
  const urls = options.urls ?? {
    confirmation: (requestId: string, token: string) =>
      `/publish/${requestId}/confirm?token=${encodeURIComponent(token)}`
  };
  const publishLeaseMs = options.publishLeaseMs ?? 15 * 60 * 1000;

  const lifecycle: PageLifecycle = {
    async saveRevision(command, context) {
      const key = operationKey('save_revision', context, command.idempotencyKey);
      const replay = idempotency.get(key);
      if (replay) return clone(replay) as RevisionResult;

      const now = clock.now();
      const page = pages.get(command.pageId);
      const latest = page?.revisions.at(-1) ?? null;
      if (!page && command.baseRevisionId !== null) {
        return revisionConflict('首次保存的 baseRevisionId 必须为 null', null);
      }
      if (page && command.baseRevisionId !== latest?.revisionId) {
        return revisionConflict(
          `保存基线不是当前最新页面修订:${latest?.revisionId ?? '无'}`,
          latest
        );
      }
      if (page?.activePublishRequestId) {
        const active = requests.get(page.activePublishRequestId);
        if (active?.status === 'pending' && Date.parse(active.expiresAt) > now.getTime()) {
          return failure('PAGE_LOCKED', `看板页面有活动发布租约:${active.requestId}`);
        }
        if (active?.status === 'pending') {
          finishRequest(active, 'expired', null, now, '15 分钟发布租约已到期');
        }
        page.activePublishRequestId = null;
      }

      const catalog = await options.catalog.current();
      const validationErrors = validate(command.document, catalog.snapshot);
      if (validationErrors.length > 0) {
        return {
          ok: false,
          error: {
            code: validationErrors.some((error) => error.type === 'METRIC_GAP')
              ? 'METRIC_GAP'
              : 'INVALID_PAGE',
            message: '页面文档未通过校验',
            validationErrors
          }
        };
      }
      const document = clone(command.document) as Page;
      if (document.schemaVersion !== versionPolicy.current) {
        return failure(
          'INVALID_PAGE',
          `保存只接受当前 schemaVersion ${versionPolicy.current}`
        );
      }
      if (document.id !== command.pageId) {
        return failure(
          'PAGE_ID_MISMATCH',
          `命令页面 id ${command.pageId} 与页面文档 id ${document.id} 不一致`
        );
      }

      const revision: PageRevision = {
        revisionId: ids.next(),
        revisionNumber: (latest?.revisionNumber ?? 0) + 1,
        pageId: command.pageId,
        baseRevisionId: command.baseRevisionId,
        document,
        contentHash: hash(canonicalizeJson(document)),
        metadataVersion: catalog.version,
        createdBy: context.actorId,
        createdAt: now.toISOString()
      };
      if (page) page.revisions.push(revision);
      else {
        pages.set(command.pageId, {
          revisions: [revision],
          publishedRevisionId: null,
          activePublishRequestId: null
        });
      }
      const result: RevisionResult = { ok: true, revision: clone(revision) };
      idempotency.set(key, result);
      return clone(result);
    },

    async getRevision(reference) {
      const revision = findRevision(reference.pageId, reference.revisionId);
      return revision
        ? { ok: true, revision: clone(revision) }
        : failure('REVISION_NOT_FOUND', `页面修订不存在:${reference.revisionId}`);
    },

    async getPage(reference) {
      return selectPage(reference);
    },

    async listPages(query = {}) {
      const limit = pageListLimit(query.limit);
      const candidates = [...pages.entries()]
        .filter(([pageId]) => pageId > (query.afterPageId ?? ''))
        .sort(([left], [right]) => left.localeCompare(right));
      const selected = candidates.slice(0, limit);
      return {
        pages: selected.map(([pageId, page]) => ({
          pageId,
          latestRevision: page.revisions.at(-1)
            ? { pageId, revisionId: page.revisions.at(-1)!.revisionId }
            : null,
          publishedRevision: page.publishedRevisionId
            ? { pageId, revisionId: page.publishedRevisionId }
            : null,
          catalogVisibility: page.publishedRevisionId ? 'visible' : 'hidden'
        })),
        nextPageId: candidates.length > limit ? selected.at(-1)?.[0] ?? null : null
      } satisfies PageList;
    },

    async listRevisionHistory({ pageId }) {
      const page = pages.get(pageId);
      if (!page) return failure('PAGE_NOT_FOUND', `看板页面不存在:${pageId}`);
      return {
        ok: true,
        history: { pageId, revisions: clone([...page.revisions].reverse()) }
      };
    },

    async diffRevisions(reference) {
      const from = findRevision(reference.pageId, reference.fromRevisionId);
      if (!from) {
        return failure(
          'REVISION_NOT_FOUND',
          `页面修订不存在:${reference.fromRevisionId}`
        );
      }
      const to = findRevision(reference.pageId, reference.toRevisionId);
      if (!to) {
        return failure(
          'REVISION_NOT_FOUND',
          `页面修订不存在:${reference.toRevisionId}`
        );
      }
      return {
        ok: true,
        diff: {
          pageId: reference.pageId,
          fromRevisionId: reference.fromRevisionId,
          toRevisionId: reference.toRevisionId,
          changes: diffJson(
            from.document as unknown as JSONValue,
            to.document as unknown as JSONValue
          )
        }
      };
    },

    async requestPublish(command, context) {
      const key = operationKey('request_publish', context, command.idempotencyKey);
      const replay = idempotency.get(key);
      if (replay) return clone(replay) as PublishRequestResult;
      const page = pages.get(command.pageId);
      if (!page) return failure('PAGE_NOT_FOUND', `看板页面不存在:${command.pageId}`);
      const latest = page.revisions.at(-1);
      if (latest?.revisionId !== command.revisionId) {
        return failure(
          'REVISION_NOT_LATEST',
          `发布只能针对当前最新页面修订:${latest?.revisionId ?? '无'}`
        );
      }
      const now = clock.now();
      if (page.activePublishRequestId) {
        const active = requests.get(page.activePublishRequestId);
        if (active?.status === 'pending' && Date.parse(active.expiresAt) > now.getTime()) {
          return failure('PAGE_LOCKED', `看板页面已有活动发布租约:${active.requestId}`);
        }
        if (active?.status === 'pending') {
          finishRequest(active, 'expired', null, now, '15 分钟发布租约已到期');
        }
      }

      const requestId = ids.next();
      const token = tokens.next();
      const expiresAt = new Date(now.getTime() + publishLeaseMs).toISOString();
      const request: MemoryPublishRequest = {
        requestId,
        pageId: command.pageId,
        revisionId: command.revisionId,
        requestedBy: context.actorId,
        requestedClientId: context.clientId,
        status: 'pending',
        expiresAt,
        decidedBy: null,
        decidedClientId: null,
        decidedAt: null,
        tokenHash: hash(token),
        confirmationUrl: urls.confirmation(requestId, token)
      };
      requests.set(requestId, request);
      page.activePublishRequestId = requestId;
      addAudit(request, 'requested', context, now, null);
      const result: PublishRequestResult = {
        ok: true,
        request: {
          requestId,
          pageId: command.pageId,
          revisionId: command.revisionId,
          expiresAt,
          confirmationUrl: request.confirmationUrl
        }
      };
      idempotency.set(key, result);
      return clone(result);
    },

    async getPublishRequest({ requestId }, context) {
      const request = refreshRequest(requestId);
      if (!request) {
        return failure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${requestId}`);
      }
      if (!canView(request, context)) {
        return failure('PUBLISH_FORBIDDEN', '当前身份不能查看该发布请求');
      }
      return { ok: true, request: publicRequest(request) };
    },

    async confirmPublish(command, context) {
      const request = requests.get(command.requestId);
      if (!request) {
        return failure(
          'PUBLISH_REQUEST_NOT_FOUND',
          `发布请求不存在:${command.requestId}`
        );
      }
      if (request.status !== 'pending') {
        return failure('PUBLISH_REQUEST_CLOSED', `发布请求已结束:${request.status}`);
      }
      const now = clock.now();
      if (Date.parse(request.expiresAt) <= now.getTime()) {
        finishRequest(request, 'expired', null, now, '15 分钟发布租约已到期');
        return failure('PUBLISH_REQUEST_EXPIRED', `发布租约已于 ${request.expiresAt} 到期`);
      }
      if (hash(command.token) !== request.tokenHash) {
        return failure('INVALID_CONFIRMATION_TOKEN', '发布确认 token 无效');
      }
      if (!hasRole(context, 'publisher') && !hasRole(context, 'admin')) {
        return failure('PUBLISH_FORBIDDEN', '确认发布需要 publisher 权限');
      }
      const page = pages.get(request.pageId);
      const revision = findRevision(request.pageId, request.revisionId);
      if (
        !page ||
        !revision ||
        page.revisions.at(-1)?.revisionId !== request.revisionId ||
        page.activePublishRequestId !== request.requestId
      ) {
        return failure('REVISION_NOT_LATEST', '发布请求不再绑定当前最新页面修订');
      }
      const catalog = await options.catalog.current();
      const validationErrors = validate(revision.document, catalog.snapshot);
      if (validationErrors.length > 0) {
        finishRequest(request, 'validation_failed', context, now, '最新元数据复验失败');
        return {
          ok: false,
          error: {
            code: validationErrors.some((error) => error.type === 'METRIC_GAP')
              ? 'METRIC_GAP'
              : 'INVALID_PAGE',
            message: '页面修订未通过发布复验',
            validationErrors
          }
        };
      }
      page.publishedRevisionId = revision.revisionId;
      finishRequest(request, 'published', context, now, null);
      return { ok: true, revision: clone(revision) };
    },

    async rejectPublish(command, context) {
      const request = openRequest(command.requestId);
      if (!request.ok) return request;
      if (hash(command.token) !== request.request.tokenHash) {
        return failure('INVALID_CONFIRMATION_TOKEN', '发布确认 token 无效');
      }
      if (!hasRole(context, 'publisher') && !hasRole(context, 'admin')) {
        return failure('PUBLISH_FORBIDDEN', '拒绝发布需要 publisher 权限');
      }
      finishRequest(request.request, 'rejected', context, clock.now(), command.reason ?? null);
      return { ok: true, request: publicRequest(request.request) };
    },

    async cancelPublish(command, context) {
      const request = openRequest(command.requestId);
      if (!request.ok) return request;
      if (context.actorId !== request.request.requestedBy && !hasRole(context, 'admin')) {
        return failure('PUBLISH_FORBIDDEN', '只有发起人或管理员可取消发布请求');
      }
      finishRequest(request.request, 'cancelled', context, clock.now(), command.reason ?? null);
      return { ok: true, request: publicRequest(request.request) };
    },

    async forceReleasePublish(command, context) {
      const request = openRequest(command.requestId);
      if (!request.ok) return request;
      if (!hasRole(context, 'admin')) {
        return failure('PUBLISH_FORBIDDEN', '强制释放发布租约需要 admin 权限');
      }
      finishRequest(
        request.request,
        'force_released',
        context,
        clock.now(),
        command.reason
      );
      return { ok: true, request: publicRequest(request.request) };
    },

    async listPublishAudit({ requestId }, context) {
      const request = refreshRequest(requestId);
      if (!request) {
        return failure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${requestId}`);
      }
      if (!canView(request, context)) {
        return failure('PUBLISH_FORBIDDEN', '当前身份不能查看该发布审计');
      }
      return { ok: true, events: clone(audits.get(requestId) ?? []) };
    },

    async rollbackRevision(command, context) {
      const latest = await selectPage({ pageId: command.pageId, selector: { type: 'latest' } });
      if (!latest.ok) return latest;
      const target = await selectPage({
        pageId: command.pageId,
        selector: { type: 'exact', revisionId: command.targetRevisionId }
      });
      if (!target.ok) return target;
      return lifecycle.saveRevision(
        {
          pageId: command.pageId,
          baseRevisionId: latest.revision.revisionId,
          document: target.revision.document,
          idempotencyKey: `rollback:${command.idempotencyKey}`
        },
        context
      );
    },

    async getPublished({ pageId }) {
      return selectPage({ pageId, selector: { type: 'published' } });
    },

    async close() {}
  };

  return lifecycle;

  function findRevision(pageId: string, revisionId: string): PageRevision | undefined {
    return pages.get(pageId)?.revisions.find((revision) => revision.revisionId === revisionId);
  }

  async function selectPage(reference: PageReference): Promise<RevisionResult> {
    const page = pages.get(reference.pageId);
    if (!page) return failure('PAGE_NOT_FOUND', `看板页面不存在:${reference.pageId}`);
    const revision = reference.selector.type === 'latest'
      ? page.revisions.at(-1)
      : reference.selector.type === 'published'
        ? page.publishedRevisionId
          ? findRevision(reference.pageId, page.publishedRevisionId)
          : undefined
        : findRevision(reference.pageId, reference.selector.revisionId);
    if (!revision) {
      return reference.selector.type === 'published'
        ? failure('PAGE_NOT_PUBLISHED', `看板页面尚未发布:${reference.pageId}`)
        : failure(
            'REVISION_NOT_FOUND',
            `页面修订不存在:${reference.selector.type === 'exact' ? reference.selector.revisionId : '无'}`
          );
    }
    return { ok: true, revision: clone(revision) };
  }

  function refreshRequest(requestId: string): MemoryPublishRequest | undefined {
    const request = requests.get(requestId);
    if (
      request?.status === 'pending' &&
      Date.parse(request.expiresAt) <= clock.now().getTime()
    ) {
      finishRequest(request, 'expired', null, clock.now(), '15 分钟发布租约已到期');
    }
    return request;
  }

  function openRequest(requestId: string):
    | { ok: true; request: MemoryPublishRequest }
    | { ok: false; error: LifecycleError } {
    const request = refreshRequest(requestId);
    if (!request) {
      return failure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${requestId}`);
    }
    if (request.status !== 'pending') {
      return failure('PUBLISH_REQUEST_CLOSED', `发布请求已结束:${request.status}`);
    }
    return { ok: true, request };
  }

  function finishRequest(
    request: MemoryPublishRequest,
    status: PublishRequestStatus,
    context: LifecycleContext | null,
    now: Date,
    reason: string | null
  ) {
    request.status = status;
    request.decidedBy = context?.actorId ?? null;
    request.decidedClientId = context?.clientId ?? null;
    request.decidedAt = now.toISOString();
    const page = pages.get(request.pageId);
    if (page?.activePublishRequestId === request.requestId) {
      page.activePublishRequestId = null;
    }
    addAudit(
      request,
      auditActionFor(status),
      context,
      now,
      reason
    );
  }

  function addAudit(
    request: MemoryPublishRequest,
    action: PublishAuditAction,
    context: LifecycleContext | null,
    now: Date,
    reason: string | null
  ) {
    const events = audits.get(request.requestId) ?? [];
    events.push({
      auditId: String(events.length + 1),
      requestId: request.requestId,
      pageId: request.pageId,
      revisionId: request.revisionId,
      action,
      actorId: context?.actorId ?? null,
      clientId: context?.clientId ?? null,
      occurredAt: now.toISOString(),
      reason
    });
    audits.set(request.requestId, events);
  }
}

function auditActionFor(status: PublishRequestStatus): PublishAuditAction {
  if (status === 'published') return 'approved';
  if (status === 'pending') return 'requested';
  return status;
}

function failure(code: LifecycleErrorCode, message: string): { ok: false; error: LifecycleError } {
  return { ok: false, error: { code, message } };
}

function revisionConflict(
  message: string,
  currentLatestRevision: PageRevision | null
): RevisionResult {
  return {
    ok: false,
    error: { code: 'REVISION_CONFLICT', message, currentLatestRevision: clone(currentLatestRevision) }
  };
}

function operationKey(operation: string, context: LifecycleContext, key: string): string {
  return `${operation}:${context.clientId}:${key}`;
}

function hasRole(context: LifecycleContext, role: 'publisher' | 'admin'): boolean {
  return context.roles?.includes(role) ?? false;
}

function canView(request: MemoryPublishRequest, context: LifecycleContext): boolean {
  return request.requestedBy === context.actorId || hasRole(context, 'publisher') || hasRole(context, 'admin');
}

function publicRequest(request: MemoryPublishRequest): PublishRequestDetails {
  return {
    requestId: request.requestId,
    pageId: request.pageId,
    revisionId: request.revisionId,
    requestedBy: request.requestedBy,
    requestedClientId: request.requestedClientId,
    status: request.status,
    expiresAt: request.expiresAt,
    decidedBy: request.decidedBy,
    decidedClientId: request.decidedClientId,
    decidedAt: request.decidedAt
  };
}

function pageListLimit(value: number | undefined): number {
  return Number.isInteger(value) && value !== undefined && value > 0
    ? Math.min(value, 100)
    : 50;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function diffJson(before: JSONValue, after: JSONValue, path = ''): Array<{
  op: 'add' | 'remove' | 'replace';
  path: string;
  before?: JSONValue;
  after?: JSONValue;
}> {
  if (canonicalizeJson(before) === canonicalizeJson(after)) return [];
  if (Array.isArray(before) || Array.isArray(after) || !isJsonObject(before) || !isJsonObject(after)) {
    return [{ op: 'replace', path, before, after }];
  }
  const changes: ReturnType<typeof diffJson> = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    const childPath = `${path}/${escapeJsonPointer(key)}`;
    if (!(key in before)) changes.push({ op: 'add', path: childPath, after: after[key] });
    else if (!(key in after)) changes.push({ op: 'remove', path: childPath, before: before[key] });
    else changes.push(...diffJson(before[key]!, after[key]!, childPath));
  }
  return changes;
}

function isJsonObject(value: JSONValue): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeJsonPointer(value: string): string {
  return value.replace(/~/gu, '~0').replace(/\//gu, '~1');
}
