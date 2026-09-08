import { randomUUID } from 'node:crypto';
import { validate, type PageDocument } from '@metriccanvas/page';
import {
  DEFAULT_PUBLISH_LEASE_MS,
  PUBLISH_LEASE_EXPIRED_REASON,
  buildPageRevision,
  canViewPublishRequest,
  checkSaveDocument,
  diffJson,
  hash,
  lifecycleFailure,
  pageListLimit,
  publishAuditActionFor,
  publishDecisionForbidden,
  publishLeaseState,
  saveRevisionPrecondition
} from '@metriccanvas/page-lifecycle/invariants';
import type {
  DataContextVersionProvider,
  JSONValue,
  LifecycleContext,
  PageLifecycle,
  PageReference,
  PageRevision,
  PageVisibility,
  PublishAuditAction,
  PublishAuditEvent,
  PublishRequest,
  PublishRequestDetails,
  PublishRequestDetailsResult,
  PublishRequestResult,
  PublishRequestStatus,
  RevisionResult
} from '@metriccanvas/page-lifecycle';
import {
  createMySqlDatabase,
  fromJson,
  jsonParameter,
  lockTransactionKey,
  toIso,
  type MySqlDatabase,
  type MySqlExecutor
} from './database';

export interface MySqlPageLifecycleOptions {
  databaseUrl: string;
  dataContext: DataContextVersionProvider;
  clock?: { now(): Date };
  ids?: { next(): string };
  tokens?: { next(): string };
  urls?: { confirmation(requestId: string, token: string): string };
  publishLeaseMs?: number;
}

interface RevisionRow {
  revision_id: string;
  revision_number: number;
  page_id: string;
  base_revision_id: string | null;
  document: PageDocument;
  content_hash: string;
  data_context_version: string | null;
  created_by: string;
  created_at: Date | string;
}

interface PublishRequestRow {
  request_id: string;
  page_id: string;
  revision_id: string;
  requested_by: string;
  requested_client_id: string;
  status: PublishRequestStatus;
  token_hash: string;
  expires_at: Date | string;
  decided_by: string | null;
  decided_client_id: string | null;
  decided_at: Date | string | null;
}

export async function createMySqlPageLifecycle(
  options: MySqlPageLifecycleOptions
): Promise<PageLifecycle> {
  // P3 会以独立 migration Job 管理 schema；这里刻意只建连接池，不执行 DDL。
  const database = createMySqlDatabase(options.databaseUrl);
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
      return database.transaction(async (tx) => {
        await lockIdempotency(tx, 'save_revision', context.clientId, command.idempotencyKey);
        const replay = await idempotentResult<RevisionResult>(
          tx,
          'save_revision',
          context.clientId,
          command.idempotencyKey
        );
        if (replay) return replay;

        await lockPage(tx, command.pageId);
        const pages = await tx.query<{
          page_id: string;
          latest_revision_id: string | null;
          active_publish_request_id: string | null;
        }>(
          `SELECT page_id, latest_revision_id, active_publish_request_id
           FROM dashboard_pages WHERE page_id = ? FOR UPDATE`,
          [command.pageId]
        );
        const page = pages[0];
        const createdAt = clock.now();
        const latest = page?.latest_revision_id
          ? pageRevisionFromPersistence((await selectRevision(tx, command.pageId, page.latest_revision_id))[0]!)
          : null;
        const precondition = saveRevisionPrecondition(page !== undefined, latest, command);
        if (precondition) return precondition;

        let expired: PublishRequestRow | null = null;
        if (page?.active_publish_request_id) {
          const active = await selectPublishRequest(tx, page.active_publish_request_id, true);
          const state = active
            ? publishLeaseState(active.status, active.expires_at, createdAt)
            : 'closed';
          if (state === 'active') {
            return lifecycleFailure('PAGE_LOCKED', `页面有活动发布租约:${active!.request_id}`);
          }
          if (state === 'expired') expired = active;
        }

        // 校验先于任何过期收尾写入，保证非法保存没有可观察副作用。
        const checked = checkSaveDocument(command.document, command.pageId);
        if (!checked.ok) return checked;

        if (!page) {
          await tx.query(
            `INSERT INTO dashboard_pages
             (page_id, latest_revision_id, published_revision_id,
              active_publish_request_id, created_by, created_at)
             VALUES (?, NULL, NULL, NULL, ?, ?)`,
            [command.pageId, context.actorId, createdAt]
          );
        } else if (page.active_publish_request_id) {
          if (expired) {
            await finishPublishRequest(tx, expired, 'expired', null, createdAt,
              PUBLISH_LEASE_EXPIRED_REASON);
          } else {
            await tx.query(
              `UPDATE dashboard_pages SET active_publish_request_id = NULL
               WHERE page_id = ? AND active_publish_request_id = ?`,
              [command.pageId, page.active_publish_request_id]
            );
          }
        }

        const revision = await buildPageRevision({
          command,
          document: checked.document,
          latest,
          revisionId: ids.next(),
          actorId: context.actorId,
          now: createdAt,
          dataContext: options.dataContext
        });
        await tx.query(
          `INSERT INTO page_revisions
           (revision_id, revision_number, page_id, base_revision_id, document,
            content_hash, data_context_version, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            revision.revisionId,
            revision.revisionNumber,
            revision.pageId,
            revision.baseRevisionId,
            jsonParameter(revision.document),
            revision.contentHash,
            revision.dataContextVersion,
            revision.createdBy,
            createdAt
          ]
        );
        await tx.query(
          'UPDATE dashboard_pages SET latest_revision_id = ? WHERE page_id = ?',
          [revision.revisionId, command.pageId]
        );
        const result: RevisionResult = { ok: true, revision };
        await storeIdempotentResult(
          tx,
          'save_revision',
          context.clientId,
          command.idempotencyKey,
          result,
          createdAt
        );
        return result;
      });
    },

    async getRevision(reference) {
      const row = (await selectRevision(database, reference.pageId, reference.revisionId))[0];
      return row
        ? { ok: true, revision: pageRevisionFromPersistence(row) }
        : lifecycleFailure('REVISION_NOT_FOUND', `页面修订不存在:${reference.revisionId}`);
    },

    async getPage(reference) {
      return selectPageRevision(database, reference);
    },

    async listPages(query = {}) {
      const limit = pageListLimit(query.limit);
      const rows = await database.query<{
        page_id: string;
        latest_revision_id: string | null;
        published_revision_id: string | null;
        visibility: PageVisibility;
      }>(
        `SELECT page_id, latest_revision_id, published_revision_id,
           CASE WHEN published_revision_id IS NULL THEN 'hidden' ELSE 'visible' END AS visibility
         FROM dashboard_pages
         WHERE page_id > ?
         ORDER BY page_id ASC
         LIMIT ?`,
        [query.afterPageId ?? '', limit + 1]
      );
      const pages = rows.slice(0, limit);
      return {
        pages: pages.map((page) => ({
          pageId: page.page_id,
          latestRevision: page.latest_revision_id
            ? { pageId: page.page_id, revisionId: page.latest_revision_id }
            : null,
          publishedRevision: page.published_revision_id
            ? { pageId: page.page_id, revisionId: page.published_revision_id }
            : null,
          visibility: page.visibility
        })),
        nextPageId: rows.length > limit ? pages.at(-1)?.page_id ?? null : null
      };
    },

    async listRevisionHistory(reference) {
      const pages = await database.query<{ page_id: string }>(
        'SELECT page_id FROM dashboard_pages WHERE page_id = ?',
        [reference.pageId]
      );
      if (!pages[0]) {
        return lifecycleFailure('PAGE_NOT_FOUND', `页面不存在:${reference.pageId}`);
      }
      const rows = await database.query<RevisionRow>(
        `${REVISION_COLUMNS} FROM page_revisions
         WHERE page_id = ? ORDER BY revision_number DESC, revision_id DESC`,
        [reference.pageId]
      );
      return {
        ok: true,
        history: { pageId: reference.pageId, revisions: rows.map(pageRevisionFromPersistence) }
      };
    },

    async diffRevisions(reference) {
      const [fromRows, toRows] = await Promise.all([
        selectRevision(database, reference.pageId, reference.fromRevisionId),
        selectRevision(database, reference.pageId, reference.toRevisionId)
      ]);
      if (!fromRows[0]) {
        return lifecycleFailure('REVISION_NOT_FOUND', `页面修订不存在:${reference.fromRevisionId}`);
      }
      if (!toRows[0]) {
        return lifecycleFailure('REVISION_NOT_FOUND', `页面修订不存在:${reference.toRevisionId}`);
      }
      return {
        ok: true,
        diff: {
          pageId: reference.pageId,
          fromRevisionId: reference.fromRevisionId,
          toRevisionId: reference.toRevisionId,
          changes: diffJson(
            fromRows[0].document as unknown as JSONValue,
            toRows[0].document as unknown as JSONValue
          )
        }
      };
    },

    async requestPublish(command, context) {
      return database.transaction(async (tx) => {
        await lockIdempotency(tx, 'request_publish', context.clientId, command.idempotencyKey);
        const replay = await idempotentResult<PublishRequestResult>(
          tx,
          'request_publish',
          context.clientId,
          command.idempotencyKey
        );
        if (replay) return replay;

        await lockPage(tx, command.pageId);
        const pages = await tx.query<{
          latest_revision_id: string | null;
          active_publish_request_id: string | null;
        }>(
          `SELECT latest_revision_id, active_publish_request_id
           FROM dashboard_pages WHERE page_id = ? FOR UPDATE`,
          [command.pageId]
        );
        const page = pages[0];
        if (!page) return lifecycleFailure('PAGE_NOT_FOUND', `页面不存在:${command.pageId}`);
        if (page.latest_revision_id !== command.revisionId) {
          return lifecycleFailure(
            'REVISION_NOT_LATEST',
            `发布只能针对当前最新页面修订:${page.latest_revision_id ?? '无'}`
          );
        }
        const now = clock.now();
        if (page.active_publish_request_id) {
          const active = await selectPublishRequest(tx, page.active_publish_request_id, true);
          const state = active ? publishLeaseState(active.status, active.expires_at, now) : 'closed';
          if (state === 'active') {
            return lifecycleFailure('PAGE_LOCKED', `页面已有活动发布租约:${active!.request_id}`);
          }
          if (state === 'expired') {
            await finishPublishRequest(tx, active!, 'expired', null, now,
              PUBLISH_LEASE_EXPIRED_REASON);
          }
        }

        const requestId = ids.next();
        const token = tokens.next();
        const expiresAt = new Date(now.getTime() + publishLeaseMs);
        const request: PublishRequest = {
          requestId,
          pageId: command.pageId,
          revisionId: command.revisionId,
          expiresAt: expiresAt.toISOString(),
          confirmationUrl: urls.confirmation(requestId, token)
        };
        await tx.query(
          `INSERT INTO publish_requests
           (request_id, page_id, revision_id, requested_by, requested_client_id,
            status, token_hash, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
          [
            requestId,
            command.pageId,
            command.revisionId,
            context.actorId,
            context.clientId,
            hash(token),
            now,
            expiresAt
          ]
        );
        await tx.query(
          'UPDATE dashboard_pages SET active_publish_request_id = ? WHERE page_id = ?',
          [requestId, command.pageId]
        );
        await insertPublishAudit(tx, {
          requestId,
          pageId: command.pageId,
          revisionId: command.revisionId,
          action: 'requested',
          actorId: context.actorId,
          clientId: context.clientId,
          occurredAt: now,
          reason: null
        });
        const result: PublishRequestResult = { ok: true, request };
        await storeIdempotentResult(
          tx,
          'request_publish',
          context.clientId,
          command.idempotencyKey,
          result,
          now
        );
        return result;
      });
    },

    async getPublishRequest(reference, context) {
      const request = await refreshPublishRequest(database, reference.requestId, clock.now());
      if (!request) {
        return lifecycleFailure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${reference.requestId}`);
      }
      if (!canViewPublishRequest({ requestedBy: request.requested_by }, context)) {
        return lifecycleFailure('PUBLISH_FORBIDDEN', '当前身份不能查看该发布请求');
      }
      return { ok: true, request: publishRequestDetailsFromPersistence(request) };
    },

    async confirmPublish(command, context) {
      const existing = await selectPublishRequest(database, command.requestId);
      if (!existing) {
        return lifecycleFailure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${command.requestId}`);
      }
      const revisionRow = (await selectRevision(
        database,
        existing.page_id,
        existing.revision_id
      ))[0];
      if (!revisionRow) {
        return lifecycleFailure('REVISION_NOT_FOUND', `页面修订不存在:${existing.revision_id}`);
      }
      const revision = pageRevisionFromPersistence(revisionRow);
      const validationErrors = validate(revision.document);

      return database.transaction(async (tx) => {
        await lockPage(tx, existing.page_id);
        const locked = await selectPublishRequest(tx, command.requestId, true);
        if (!locked) {
          return lifecycleFailure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${command.requestId}`);
        }
        if (locked.status !== 'pending') {
          return lifecycleFailure('PUBLISH_REQUEST_CLOSED', `发布请求已结束:${locked.status}`);
        }
        const now = clock.now();
        if (publishLeaseState(locked.status, locked.expires_at, now) === 'expired') {
          await finishPublishRequest(tx, locked, 'expired', null, now,
            PUBLISH_LEASE_EXPIRED_REASON);
          return lifecycleFailure(
            'PUBLISH_REQUEST_EXPIRED',
            `发布租约已于 ${toIso(locked.expires_at)} 到期`
          );
        }
        if (hash(command.token) !== locked.token_hash) {
          return lifecycleFailure('INVALID_CONFIRMATION_TOKEN', '发布确认 token 无效');
        }
        const forbidden = publishDecisionForbidden(
          'confirm',
          { requestedBy: locked.requested_by },
          context
        );
        if (forbidden) return forbidden;
        const page = (await tx.query<{
          latest_revision_id: string | null;
          active_publish_request_id: string | null;
        }>(
          `SELECT latest_revision_id, active_publish_request_id
           FROM dashboard_pages WHERE page_id = ? FOR UPDATE`,
          [locked.page_id]
        ))[0];
        if (
          !page ||
          page.latest_revision_id !== locked.revision_id ||
          page.active_publish_request_id !== locked.request_id
        ) {
          return lifecycleFailure('REVISION_NOT_LATEST', '发布请求不再绑定当前最新页面修订');
        }
        if (validationErrors.length > 0) {
          await finishPublishRequest(
            tx,
            locked,
            'validation_failed',
            context,
            now,
            '当前页面 Schema 复验失败'
          );
          return {
            ok: false,
            error: {
              code: 'INVALID_PAGE',
              message: '页面修订未通过发布复验',
              validationErrors
            }
          } satisfies RevisionResult;
        }
        await tx.query(
          `UPDATE dashboard_pages
           SET published_revision_id = ?, active_publish_request_id = NULL
           WHERE page_id = ?`,
          [locked.revision_id, locked.page_id]
        );
        await tx.query(
          `UPDATE publish_requests
           SET status = 'published', decided_by = ?, decided_client_id = ?, decided_at = ?
           WHERE request_id = ?`,
          [context.actorId, context.clientId, now, locked.request_id]
        );
        await insertPublishAudit(tx, {
          requestId: locked.request_id,
          pageId: locked.page_id,
          revisionId: locked.revision_id,
          action: publishAuditActionFor('published'),
          actorId: context.actorId,
          clientId: context.clientId,
          occurredAt: now,
          reason: null
        });
        return { ok: true, revision } satisfies RevisionResult;
      });
    },

    async rejectPublish(command, context) {
      return decidePublishRequest(database, command.requestId, clock.now(), async (tx, locked, now) => {
        if (hash(command.token) !== locked.token_hash) {
          return lifecycleFailure('INVALID_CONFIRMATION_TOKEN', '发布确认 token 无效');
        }
        const forbidden = publishDecisionForbidden('reject', { requestedBy: locked.requested_by }, context);
        if (forbidden) return forbidden;
        await finishPublishRequest(tx, locked, 'rejected', context, now, command.reason ?? null);
        return decidedRequestResult(locked, 'rejected', context, now);
      });
    },

    async cancelPublish(command, context) {
      return decidePublishRequest(database, command.requestId, clock.now(), async (tx, locked, now) => {
        const forbidden = publishDecisionForbidden('cancel', { requestedBy: locked.requested_by }, context);
        if (forbidden) return forbidden;
        await finishPublishRequest(tx, locked, 'cancelled', context, now, command.reason ?? null);
        return decidedRequestResult(locked, 'cancelled', context, now);
      });
    },

    async forceReleasePublish(command, context) {
      return decidePublishRequest(database, command.requestId, clock.now(), async (tx, locked, now) => {
        const forbidden = publishDecisionForbidden('force_release', { requestedBy: locked.requested_by }, context);
        if (forbidden) return forbidden;
        await finishPublishRequest(tx, locked, 'force_released', context, now, command.reason);
        return decidedRequestResult(locked, 'force_released', context, now);
      });
    },

    async listPublishAudit(reference, context) {
      const request = await refreshPublishRequest(database, reference.requestId, clock.now());
      if (!request) {
        return lifecycleFailure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${reference.requestId}`);
      }
      if (!canViewPublishRequest({ requestedBy: request.requested_by }, context)) {
        return lifecycleFailure('PUBLISH_FORBIDDEN', '当前身份不能查看该发布审计');
      }
      const rows = await database.query<{
        audit_id: string | number | bigint;
        request_id: string;
        page_id: string;
        revision_id: string;
        action: PublishAuditAction;
        actor_id: string | null;
        client_id: string | null;
        occurred_at: Date | string;
        reason: string | null;
      }>(
        `SELECT audit_id, request_id, page_id, revision_id, action,
                actor_id, client_id, occurred_at, reason
         FROM publish_audit_events WHERE request_id = ? ORDER BY audit_id ASC`,
        [reference.requestId]
      );
      return {
        ok: true,
        events: rows.map((row) => ({
          auditId: String(row.audit_id),
          requestId: row.request_id,
          pageId: row.page_id,
          revisionId: row.revision_id,
          action: row.action,
          actorId: row.actor_id,
          clientId: row.client_id,
          occurredAt: toIso(row.occurred_at),
          reason: row.reason
        }))
      };
    },

    async rollbackRevision(command, context) {
      const [latest, target] = await Promise.all([
        selectPageRevision(database, { pageId: command.pageId, selector: { type: 'latest' } }),
        selectPageRevision(database, {
          pageId: command.pageId,
          selector: { type: 'exact', revisionId: command.targetRevisionId }
        })
      ]);
      if (!latest.ok) return latest;
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

    async getPublished(reference) {
      const rows = await database.query<RevisionRow & { revision_id: string | null }>(
        `${QUALIFIED_REVISION_COLUMNS}
         FROM dashboard_pages AS page
         LEFT JOIN page_revisions AS revision
           ON revision.revision_id = page.published_revision_id
         WHERE page.page_id = ?`,
        [reference.pageId]
      );
      if (!rows[0]) return lifecycleFailure('PAGE_NOT_FOUND', `页面不存在:${reference.pageId}`);
      if (!rows[0].revision_id) {
        return lifecycleFailure('PAGE_NOT_PUBLISHED', `页面尚未发布:${reference.pageId}`);
      }
      return { ok: true, revision: pageRevisionFromPersistence(rows[0] as RevisionRow) };
    },

    async getPublishedRevision(reference) {
      const rows = isValidUuid(reference.revisionId)
        ? await database.query<RevisionRow>(
            `${REVISION_COLUMNS} FROM page_revisions AS revision
             WHERE revision.page_id = ? AND revision.revision_id = ?
               AND EXISTS (
                 SELECT 1 FROM publish_requests AS request
                 WHERE request.page_id = revision.page_id
                   AND request.revision_id = revision.revision_id
                   AND request.status = 'published'
               )`,
            [reference.pageId, reference.revisionId]
          )
        : [];
      if (!rows[0]) {
        const revision = await lifecycle.getRevision(reference);
        return revision.ok
          ? lifecycleFailure('REVISION_NOT_PUBLISHED', `页面修订未曾发布:${reference.revisionId}`)
          : revision;
      }
      return { ok: true, revision: pageRevisionFromPersistence(rows[0]) };
    },

    async close() {
      await database.close();
    }
  };

  return lifecycle;
}

const REVISION_COLUMNS = `SELECT revision_id, revision_number, page_id,
  base_revision_id, document, content_hash, data_context_version,
  created_by, created_at`;

const QUALIFIED_REVISION_COLUMNS = `SELECT
  revision.revision_id,
  revision.revision_number,
  revision.page_id,
  revision.base_revision_id,
  revision.document,
  revision.content_hash,
  revision.data_context_version,
  revision.created_by,
  revision.created_at`;

async function lockPage(tx: MySqlExecutor, pageId: string): Promise<void> {
  await lockTransactionKey(tx, `page:${hash(pageId)}`);
}

async function lockIdempotency(
  tx: MySqlExecutor,
  operation: string,
  clientId: string,
  key: string
): Promise<void> {
  await lockTransactionKey(tx, `lifecycle-idempotency:${hash(`${operation}\0${clientId}\0${key}`)}`);
}

async function selectRevision(
  sql: MySqlExecutor,
  pageId: string,
  revisionId: string
): Promise<RevisionRow[]> {
  if (!isValidUuid(revisionId)) return [];
  return sql.query<RevisionRow>(
    `${REVISION_COLUMNS} FROM page_revisions WHERE page_id = ? AND revision_id = ?`,
    [pageId, revisionId]
  );
}

async function selectPageRevision(
  sql: MySqlExecutor,
  reference: PageReference
): Promise<RevisionResult> {
  if (reference.selector.type === 'exact') {
    const page = await sql.query<{ page_id: string }>(
      'SELECT page_id FROM dashboard_pages WHERE page_id = ?',
      [reference.pageId]
    );
    if (!page[0]) return lifecycleFailure('PAGE_NOT_FOUND', `页面不存在:${reference.pageId}`);
    const row = (await selectRevision(sql, reference.pageId, reference.selector.revisionId))[0];
    return row
      ? { ok: true, revision: pageRevisionFromPersistence(row) }
      : lifecycleFailure('REVISION_NOT_FOUND', `页面修订不存在:${reference.selector.revisionId}`);
  }
  const column = reference.selector.type === 'latest'
    ? 'latest_revision_id'
    : 'published_revision_id';
  const page = (await sql.query<{ revision_id: string | null }>(
    `SELECT ${column} AS revision_id FROM dashboard_pages WHERE page_id = ?`,
    [reference.pageId]
  ))[0];
  if (!page) return lifecycleFailure('PAGE_NOT_FOUND', `页面不存在:${reference.pageId}`);
  if (!page.revision_id) {
    return lifecycleFailure(
      reference.selector.type === 'published' ? 'PAGE_NOT_PUBLISHED' : 'REVISION_NOT_FOUND',
      reference.selector.type === 'published'
        ? `页面尚未发布:${reference.pageId}`
        : `页面没有最新修订:${reference.pageId}`
    );
  }
  const row = (await selectRevision(sql, reference.pageId, page.revision_id))[0];
  return row
    ? { ok: true, revision: pageRevisionFromPersistence(row) }
    : lifecycleFailure('REVISION_NOT_FOUND', `页面修订不存在:${page.revision_id}`);
}

async function selectPublishRequest(
  sql: MySqlExecutor,
  requestId: string,
  forUpdate = false
): Promise<PublishRequestRow | null> {
  const rows = await sql.query<PublishRequestRow>(
    `SELECT request_id, page_id, revision_id, requested_by, requested_client_id,
            status, token_hash, expires_at, decided_by, decided_client_id, decided_at
     FROM publish_requests WHERE request_id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [requestId]
  );
  return rows[0] ?? null;
}

async function refreshPublishRequest(
  database: MySqlDatabase,
  requestId: string,
  now: Date
): Promise<PublishRequestRow | null> {
  const existing = await selectPublishRequest(database, requestId);
  if (!existing || publishLeaseState(existing.status, existing.expires_at, now) !== 'expired') {
    return existing;
  }
  return database.transaction(async (tx) => {
    await lockPage(tx, existing.page_id);
    const locked = await selectPublishRequest(tx, requestId, true);
    if (!locked) return null;
    if (publishLeaseState(locked.status, locked.expires_at, now) === 'expired') {
      await finishPublishRequest(tx, locked, 'expired', null, now,
        PUBLISH_LEASE_EXPIRED_REASON);
      return { ...locked, status: 'expired', decided_at: now };
    }
    return locked;
  });
}

async function decidePublishRequest(
  database: MySqlDatabase,
  requestId: string,
  now: Date,
  decide: (
    tx: MySqlExecutor,
    request: PublishRequestRow,
    now: Date
  ) => Promise<PublishRequestDetailsResult>
): Promise<PublishRequestDetailsResult> {
  const existing = await selectPublishRequest(database, requestId);
  if (!existing) {
    return lifecycleFailure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${requestId}`);
  }
  return database.transaction(async (tx) => {
    await lockPage(tx, existing.page_id);
    const locked = await selectPublishRequest(tx, requestId, true);
    if (!locked) return lifecycleFailure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${requestId}`);
    if (locked.status !== 'pending') {
      return lifecycleFailure('PUBLISH_REQUEST_CLOSED', `发布请求已结束:${locked.status}`);
    }
    if (publishLeaseState(locked.status, locked.expires_at, now) === 'expired') {
      await finishPublishRequest(tx, locked, 'expired', null, now,
        PUBLISH_LEASE_EXPIRED_REASON);
      return lifecycleFailure('PUBLISH_REQUEST_EXPIRED', `发布租约已于 ${toIso(locked.expires_at)} 到期`);
    }
    return decide(tx, locked, now);
  });
}

async function finishPublishRequest(
  tx: MySqlExecutor,
  request: PublishRequestRow,
  status: Exclude<PublishRequestStatus, 'pending' | 'published'>,
  context: LifecycleContext | null,
  now: Date,
  reason: string | null
): Promise<void> {
  await tx.query(
    `UPDATE publish_requests
     SET status = ?, decided_by = ?, decided_client_id = ?, decided_at = ?
     WHERE request_id = ? AND status = 'pending'`,
    [status, context?.actorId ?? null, context?.clientId ?? null, now, request.request_id]
  );
  await tx.query(
    `UPDATE dashboard_pages SET active_publish_request_id = NULL
     WHERE page_id = ? AND active_publish_request_id = ?`,
    [request.page_id, request.request_id]
  );
  await insertPublishAudit(tx, {
    requestId: request.request_id,
    pageId: request.page_id,
    revisionId: request.revision_id,
    action: publishAuditActionFor(status),
    actorId: context?.actorId ?? null,
    clientId: context?.clientId ?? null,
    occurredAt: now,
    reason
  });
}

async function insertPublishAudit(
  tx: MySqlExecutor,
  event: Omit<PublishAuditEvent, 'auditId' | 'occurredAt'> & { occurredAt: Date }
): Promise<void> {
  await tx.query(
    `INSERT INTO publish_audit_events
     (request_id, page_id, revision_id, action, actor_id, client_id, occurred_at, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.requestId,
      event.pageId,
      event.revisionId,
      event.action,
      event.actorId,
      event.clientId,
      event.occurredAt,
      event.reason
    ]
  );
}

function decidedRequestResult(
  request: PublishRequestRow,
  status: PublishRequestStatus,
  context: LifecycleContext,
  now: Date
): PublishRequestDetailsResult {
  return {
    ok: true,
    request: publishRequestDetailsFromPersistence({
      ...request,
      status,
      decided_by: context.actorId,
      decided_client_id: context.clientId,
      decided_at: now
    })
  };
}

function pageRevisionFromPersistence(row: RevisionRow): PageRevision {
  return {
    revisionId: row.revision_id,
    revisionNumber: row.revision_number,
    pageId: row.page_id,
    baseRevisionId: row.base_revision_id,
    document: row.document,
    contentHash: row.content_hash,
    dataContextVersion: row.data_context_version,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at)
  };
}

function publishRequestDetailsFromPersistence(
  row: PublishRequestRow
): PublishRequestDetails {
  return {
    requestId: row.request_id,
    pageId: row.page_id,
    revisionId: row.revision_id,
    requestedBy: row.requested_by,
    requestedClientId: row.requested_client_id,
    status: row.status,
    expiresAt: toIso(row.expires_at),
    decidedBy: row.decided_by,
    decidedClientId: row.decided_client_id,
    decidedAt: row.decided_at ? toIso(row.decided_at) : null
  };
}

async function idempotentResult<T>(
  sql: MySqlExecutor,
  operation: string,
  clientId: string,
  idempotencyKey: string
): Promise<T | null> {
  const row = (await sql.query<{ result: T | string | Buffer }>(
    `SELECT result FROM lifecycle_idempotency
     WHERE operation = ? AND client_id = ? AND idempotency_key = ?`,
    [operation, clientId, idempotencyKey]
  ))[0];
  return row ? fromJson<T>(row.result) : null;
}

async function storeIdempotentResult(
  tx: MySqlExecutor,
  operation: string,
  clientId: string,
  idempotencyKey: string,
  result: RevisionResult | PublishRequestResult,
  createdAt: Date
): Promise<void> {
  await tx.query(
    `INSERT INTO lifecycle_idempotency
     (operation, client_id, idempotency_key, result, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [operation, clientId, idempotencyKey, jsonParameter(result), createdAt]
  );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
