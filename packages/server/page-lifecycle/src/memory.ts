import { randomUUID } from 'node:crypto';
import { validate, type PageDocument } from '@metriccanvas/page';
import {
  DEFAULT_PUBLISH_LEASE_MS,
  PUBLISH_LEASE_EXPIRED_REASON,
  buildPageRevision,
  canViewPublishRequest,
  checkSaveDocument,
  comparePageIds,
  diffJson,
  hash,
  lifecycleFailure as failure,
  pageListLimit,
  publishAuditActionFor,
  publishDecisionForbidden,
  publishLeaseState,
  saveRevisionPrecondition
} from './invariants';
import type {
  DataContextVersionProvider,
  JSONValue,
  LifecycleContext,
  LifecycleError,
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
} from './types';

export interface MemoryPageLifecycleOptions {
  dataContext: DataContextVersionProvider;
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
  const pageLocks = new Map<string, Promise<unknown>>();
  const clock = options.clock ?? { now: () => new Date() };
  const ids = options.ids ?? { next: () => randomUUID() };
  const tokens = options.tokens ?? { next: () => randomUUID() };
  const urls = options.urls ?? {
    confirmation: (requestId: string, token: string) =>
      `/publish/${requestId}/confirm?token=${encodeURIComponent(token)}`
  };
  const publishLeaseMs = options.publishLeaseMs ?? DEFAULT_PUBLISH_LEASE_MS;

  const lifecycle: PageLifecycle = {
    async saveRevision(command, context) {
      const key = operationKey('save_revision', context, command.idempotencyKey);
      const replay = idempotency.get(key);
      if (replay) return clone(replay) as RevisionResult;

      // 读（page/latest）与写（推入 revision）之间隔着对
      // options.dataContext.current() 的 await；单靠事件循环的运行时特性
      // 隐式保证这段临界区的原子性并不可靠（两个并发的同基线 saveRevision
      // 可能都读到同一个 latest 并双双通过冲突检查）。这里用按 pageId 排队
      // 的显式锁，模拟 postgres 侧 `pg_advisory_xact_lock` 的效果。
      return withPageLock(command.pageId, async () => {
        const replayed = idempotency.get(key);
        if (replayed) return clone(replayed) as RevisionResult;

        const now = clock.now();
        const page = pages.get(command.pageId);
        const latest = page?.revisions.at(-1) ?? null;
        // clone:冲突结果携带 currentLatestRevision,不能把内部状态的引用交给调用方。
        const precondition = saveRevisionPrecondition(page !== undefined, latest, command);
        if (precondition) return clone(precondition);

        // 只探测、不提交：是否存在阻塞发布租约立即返回 PAGE_LOCKED；
        // 是否有已过期的待释放租约先记下来，真正的释放（含审计）推迟到
        // 文档校验通过之后再做（见下方），这样保存一份非法文档不会有
        // 任何可观察的副作用——与 postgres 侧行为一致。
        let expiredActiveRequest: MemoryPublishRequest | null = null;
        if (page?.activePublishRequestId) {
          const active = requests.get(page.activePublishRequestId);
          const state = active ? publishLeaseState(active.status, active.expiresAt, now) : 'closed';
          if (state === 'active') {
            return failure('PAGE_LOCKED', `页面有活动发布租约:${active!.requestId}`);
          }
          if (state === 'expired') {
            expiredActiveRequest = active!;
          }
        }

        const checked = checkSaveDocument(command.document, command.pageId);
        if (!checked.ok) return checked;
        const document = clone(checked.document) as PageDocument;

        if (page?.activePublishRequestId) {
          if (expiredActiveRequest) {
            finishRequest(expiredActiveRequest, 'expired', null, now, PUBLISH_LEASE_EXPIRED_REASON);
          }
          page.activePublishRequestId = null;
        }

        const revision = await buildPageRevision({
          command,
          document,
          latest,
          revisionId: ids.next(),
          actorId: context.actorId,
          now,
          dataContext: options.dataContext
        });
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
      });
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
      // 游标过滤与排序必须使用同一比较(码点序,真源在 comparePageIds),
      // 否则游标会跳页或重复——这是与 postgres 侧 COLLATE "C" 对齐的契约。
      const candidates = [...pages.entries()]
        .filter(([pageId]) => comparePageIds(pageId, query.afterPageId ?? '') > 0)
        .sort(([left], [right]) => comparePageIds(left, right));
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
          visibility: page.publishedRevisionId ? 'visible' : 'hidden'
        })),
        nextPageId: candidates.length > limit ? selected.at(-1)?.[0] ?? null : null
      } satisfies PageList;
    },

    async listRevisionHistory({ pageId }) {
      const page = pages.get(pageId);
      if (!page) return failure('PAGE_NOT_FOUND', `页面不存在:${pageId}`);
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
      // 与 postgres 侧一致:发布申请也是页面写路径,必须进入同一临界区,
      // 否则两个并发申请都能通过活动租约检查、双双持有租约。
      return withPageLock(command.pageId, async () => {
        const replayed = idempotency.get(key);
        if (replayed) return clone(replayed) as PublishRequestResult;
        const page = pages.get(command.pageId);
        if (!page) return failure('PAGE_NOT_FOUND', `页面不存在:${command.pageId}`);
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
          const state = active ? publishLeaseState(active.status, active.expiresAt, now) : 'closed';
          if (state === 'active') {
            return failure('PAGE_LOCKED', `页面已有活动发布租约:${active!.requestId}`);
          }
          if (state === 'expired') {
            finishRequest(active!, 'expired', null, now, PUBLISH_LEASE_EXPIRED_REASON);
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
      });
    },

    async getPublishRequest({ requestId }, context) {
      const request = refreshRequest(requestId);
      if (!request) {
        return failure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${requestId}`);
      }
      if (!canViewPublishRequest(request, context)) {
        return failure('PUBLISH_FORBIDDEN', '当前身份不能查看该发布请求');
      }
      return { ok: true, request: publicRequest(request) };
    },

    async confirmPublish(command, context) {
      // 决策路径与 postgres 侧同样进入页面临界区:并发的确认/保存/申请
      // 不得交错读写同一页面的租约与发布指针。
      return withRequestPageLock(command.requestId, async () => {
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
        if (publishLeaseState(request.status, request.expiresAt, now) === 'expired') {
          finishRequest(request, 'expired', null, now, PUBLISH_LEASE_EXPIRED_REASON);
          return failure('PUBLISH_REQUEST_EXPIRED', `发布租约已于 ${request.expiresAt} 到期`);
        }
        if (hash(command.token) !== request.tokenHash) {
          return failure('INVALID_CONFIRMATION_TOKEN', '发布确认 token 无效');
        }
        const forbidden = publishDecisionForbidden('confirm', request, context);
        if (forbidden) return forbidden;
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
        const validationErrors = validate(revision.document);
        if (validationErrors.length > 0) {
          finishRequest(request, 'validation_failed', context, now, '当前页面 Schema 复验失败');
          return {
            ok: false,
            error: {
              code: 'INVALID_PAGE',
              message: '页面修订未通过发布复验',
              validationErrors
            }
          };
        }
        // 与 postgres 侧一致:成功发布不是"结束请求"的一种,走显式路径,
        // finishRequest 的定义域只覆盖非成功收尾(状态机语义单点)。
        page.publishedRevisionId = revision.revisionId;
        request.status = 'published';
        request.decidedBy = context.actorId;
        request.decidedClientId = context.clientId;
        request.decidedAt = now.toISOString();
        page.activePublishRequestId = null;
        addAudit(request, publishAuditActionFor('published'), context, now, null);
        return { ok: true, revision: clone(revision) };
      });
    },

    async rejectPublish(command, context) {
      return withRequestPageLock(command.requestId, async () => {
        const request = openRequest(command.requestId);
        if (!request.ok) return request;
        if (hash(command.token) !== request.request.tokenHash) {
          return failure('INVALID_CONFIRMATION_TOKEN', '发布确认 token 无效');
        }
        const forbidden = publishDecisionForbidden('reject', request.request, context);
        if (forbidden) return forbidden;
        finishRequest(request.request, 'rejected', context, clock.now(), command.reason ?? null);
        return { ok: true, request: publicRequest(request.request) };
      });
    },

    async cancelPublish(command, context) {
      return withRequestPageLock(command.requestId, async () => {
        const request = openRequest(command.requestId);
        if (!request.ok) return request;
        const forbidden = publishDecisionForbidden('cancel', request.request, context);
        if (forbidden) return forbidden;
        finishRequest(request.request, 'cancelled', context, clock.now(), command.reason ?? null);
        return { ok: true, request: publicRequest(request.request) };
      });
    },

    async forceReleasePublish(command, context) {
      return withRequestPageLock(command.requestId, async () => {
        const request = openRequest(command.requestId);
        if (!request.ok) return request;
        const forbidden = publishDecisionForbidden('force_release', request.request, context);
        if (forbidden) return forbidden;
        finishRequest(
          request.request,
          'force_released',
          context,
          clock.now(),
          command.reason
        );
        return { ok: true, request: publicRequest(request.request) };
      });
    },

    async listPublishAudit({ requestId }, context) {
      const request = refreshRequest(requestId);
      if (!request) {
        return failure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${requestId}`);
      }
      if (!canViewPublishRequest(request, context)) {
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

    async getPublishedRevision(reference) {
      const revision = findRevision(reference.pageId, reference.revisionId);
      if (!revision) {
        return failure('REVISION_NOT_FOUND', `页面修订不存在:${reference.revisionId}`);
      }
      const published = [...requests.values()].some(
        (request) =>
          request.pageId === reference.pageId &&
          request.revisionId === reference.revisionId &&
          request.status === 'published'
      );
      return published
        ? { ok: true, revision: clone(revision) }
        : failure(
            'REVISION_NOT_PUBLISHED',
            `页面修订未曾发布:${reference.revisionId}`
          );
    },

    async close() {}
  };

  return lifecycle;

  /**
   * 按 pageId 排队执行：同一 pageId 的操作严格顺序化，即便回调内部
   * 跨越了 await 点。不同 pageId 互不阻塞。
   */
  function withPageLock<T>(pageId: string, run: () => Promise<T>): Promise<T> {
    const previous = pageLocks.get(pageId) ?? Promise.resolve();
    const settled = previous.then(run, run);
    pageLocks.set(
      pageId,
      settled.then(
        () => undefined,
        () => undefined
      )
    );
    return settled;
  }

  /**
   * 按发布请求所属页面进入临界区;请求不存在时直接执行(回调内部会给出
   * PUBLISH_REQUEST_NOT_FOUND)。回调内必须重新读取请求,不得复用锁外快照。
   */
  function withRequestPageLock<T>(requestId: string, run: () => Promise<T>): Promise<T> {
    const existing = requests.get(requestId);
    if (!existing) return run();
    return withPageLock(existing.pageId, run);
  }

  function findRevision(pageId: string, revisionId: string): PageRevision | undefined {
    return pages.get(pageId)?.revisions.find((revision) => revision.revisionId === revisionId);
  }

  async function selectPage(reference: PageReference): Promise<RevisionResult> {
    const page = pages.get(reference.pageId);
    if (!page) return failure('PAGE_NOT_FOUND', `页面不存在:${reference.pageId}`);
    const revision = reference.selector.type === 'latest'
      ? page.revisions.at(-1)
      : reference.selector.type === 'published'
        ? page.publishedRevisionId
          ? findRevision(reference.pageId, page.publishedRevisionId)
          : undefined
        : findRevision(reference.pageId, reference.selector.revisionId);
    if (!revision) {
      return reference.selector.type === 'published'
        ? failure('PAGE_NOT_PUBLISHED', `页面尚未发布:${reference.pageId}`)
        : failure(
            'REVISION_NOT_FOUND',
            `页面修订不存在:${reference.selector.type === 'exact' ? reference.selector.revisionId : '无'}`
          );
    }
    return { ok: true, revision: clone(revision) };
  }

  function refreshRequest(requestId: string): MemoryPublishRequest | undefined {
    const request = requests.get(requestId);
    if (request && publishLeaseState(request.status, request.expiresAt, clock.now()) === 'expired') {
      finishRequest(request, 'expired', null, clock.now(), PUBLISH_LEASE_EXPIRED_REASON);
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
    status: Exclude<PublishRequestStatus, 'pending' | 'published'>,
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
      publishAuditActionFor(status),
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

function operationKey(operation: string, context: LifecycleContext, key: string): string {
  return `${operation}:${context.clientId}:${key}`;
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

function clone<T>(value: T): T {
  return structuredClone(value);
}
