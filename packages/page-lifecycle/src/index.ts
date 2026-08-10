import { randomUUID } from 'node:crypto';
import postgres, { type JSONValue as PostgresJSONValue, type Sql, type TransactionSql } from 'postgres';
import { canonicalizeJson, validate, versionPolicy, type PageDocument } from '@metriccanvas/page';
import {
  diffJson,
  hash,
  hasQueryDataSource,
  hasRole,
  lifecycleFailure,
  pageListLimit,
  revisionConflict
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
  PageVisibility,
  PublishAuditAction,
  PublishAuditEvent,
  PublishRequest,
  PublishRequestDetails,
  PublishRequestDetailsResult,
  PublishRequestResult,
  PublishRequestStatus,
  RevisionResult
} from './types';

export { createMemoryPageLifecycle } from './memory';
export type { MemoryPageLifecycleOptions } from './memory';
export * from './types';

export interface PostgresPageLifecycleOptions {
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

export async function createPostgresPageLifecycle(
  options: PostgresPageLifecycleOptions
): Promise<PageLifecycle> {
  const sql = postgres(options.databaseUrl, { max: 5, onnotice: () => {} });
  await ensureSchema(sql);

  const clock = options.clock ?? { now: () => new Date() };
  const ids = options.ids ?? { next: () => randomUUID() };
  const tokens = options.tokens ?? { next: () => randomUUID() };
  const urls =
    options.urls ??
    ({
      confirmation: (requestId: string, token: string) =>
        `/publish/${requestId}/confirm?token=${encodeURIComponent(token)}`
    } satisfies NonNullable<PostgresPageLifecycleOptions['urls']>);
  const publishLeaseMs = options.publishLeaseMs ?? 15 * 60 * 1000;

  const lifecycle: PageLifecycle = {
    async saveRevision(command, context) {
      const completed = await idempotentResult<RevisionResult>(
        sql,
        'save_revision',
        context.clientId,
        command.idempotencyKey
      );
      if (completed) return completed;

      return sql.begin(async (tx) => {
        await tx`
          SELECT pg_advisory_xact_lock(
            hashtextextended(
              ${`save_revision:${context.clientId}:${command.idempotencyKey}`},
              0
            )
          )
        `;
        const replay = await idempotentResult<RevisionResult>(
          tx,
          'save_revision',
          context.clientId,
          command.idempotencyKey
        );
        if (replay) return replay;

        await tx`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`dashboard_page:${command.pageId}`}, 0)
          )
        `;
        const pages = (await tx`
          SELECT page_id, latest_revision_id, active_publish_request_id
          FROM dashboard_pages
          WHERE page_id = ${command.pageId}
          FOR UPDATE
        `) as unknown as Array<{
          page_id: string;
          latest_revision_id: string | null;
          active_publish_request_id: string | null;
        }>;
        const page = pages[0];
        const createdAt = clock.now();

        let revisionNumber: number;
        let expiredPublishRequestId: string | null = null;
        if (!page) {
          if (command.baseRevisionId !== null) {
            return revisionConflict(
              '首次保存的 baseRevisionId 必须为 null',
              null
            );
          }
          if (command.pageIdConfirmed !== true) {
            return lifecycleFailure(
              'PAGE_ID_CONFIRMATION_REQUIRED',
              `首次保存前必须确认页面 id ${command.pageId}`
            );
          }
          revisionNumber = 1;
        } else {
          const latestRows = page.latest_revision_id
            ? await selectRevision(tx, command.pageId, page.latest_revision_id)
            : [];
          const latest = latestRows[0] ? toRevision(latestRows[0]) : null;
          if (command.baseRevisionId !== page.latest_revision_id || !latest) {
            return revisionConflict(
              `保存基线不是当前最新页面修订:${page.latest_revision_id ?? '无'}`,
              latest
            );
          }

          if (page.active_publish_request_id) {
            const requests = (await tx`
              SELECT request_id, status, expires_at
              FROM publish_requests
              WHERE request_id = ${page.active_publish_request_id}
              FOR UPDATE
            `) as unknown as Array<{
              request_id: string;
              status: PublishRequestStatus;
              expires_at: Date | string;
            }>;
            const active = requests[0];
            if (
              active?.status === 'pending' &&
              new Date(active.expires_at).getTime() > createdAt.getTime()
            ) {
              return lifecycleFailure(
                'PAGE_LOCKED',
                `看板页面有活动发布租约:${active.request_id}`
              );
            }
            if (active?.status === 'pending') {
              expiredPublishRequestId = active.request_id;
            }
          }
          revisionNumber = latest.revisionNumber + 1;
        }

        const validationErrors = validate(command.document);
        if (validationErrors.length > 0) {
          return {
            ok: false,
            error: {
              code: 'INVALID_PAGE',
              message: '页面文档未通过校验',
              validationErrors
            }
          } satisfies RevisionResult;
        }
        const document = command.document as PageDocument;
        if (document.schemaVersion !== versionPolicy.current) {
          return lifecycleFailure(
            'INVALID_PAGE',
            `保存只接受当前 schemaVersion ${versionPolicy.current}`
          );
        }
        if (document.id !== command.pageId) {
          return lifecycleFailure(
            'PAGE_ID_MISMATCH',
            `命令页面 id ${command.pageId} 与页面文档 id ${document.id} 不一致`
          );
        }

        if (!page) {
          await tx`
            INSERT INTO dashboard_pages (
              page_id,
              latest_revision_id,
              published_revision_id,
              created_by,
              created_at
            )
            VALUES (
              ${command.pageId},
              NULL,
              NULL,
              ${context.actorId},
              ${createdAt}
            )
          `;
        } else if (page.active_publish_request_id) {
          if (expiredPublishRequestId) {
            await tx`
              UPDATE publish_requests
              SET
                status = 'expired',
                decided_at = ${createdAt}
              WHERE request_id = ${expiredPublishRequestId}
            `;
            await insertPublishAudit(tx, {
              requestId: expiredPublishRequestId,
              pageId: command.pageId,
              revisionId: page.latest_revision_id ?? command.baseRevisionId ?? '',
              action: 'expired',
              actorId: null,
              clientId: null,
              occurredAt: createdAt,
              reason: '15 分钟发布租约已到期'
            });
          }
          await tx`
            UPDATE dashboard_pages
            SET active_publish_request_id = NULL
            WHERE page_id = ${command.pageId}
              AND active_publish_request_id = ${page.active_publish_request_id}
          `;
        }

        const revision: PageRevision = {
          revisionId: ids.next(),
          revisionNumber,
          pageId: command.pageId,
          baseRevisionId: command.baseRevisionId,
          document,
          contentHash: hash(canonicalizeJson(document)),
          dataContextVersion: hasQueryDataSource(document)
            ? (await options.dataContext.current()).version
            : null,
          createdBy: context.actorId,
          createdAt: createdAt.toISOString()
        };
        await tx`
          INSERT INTO page_revisions (
            revision_id,
            revision_number,
            page_id,
            base_revision_id,
            document,
            content_hash,
            data_context_version,
            created_by,
            created_at
          )
          VALUES (
            ${revision.revisionId},
            ${revision.revisionNumber},
            ${revision.pageId},
            ${revision.baseRevisionId},
            ${tx.json(revision.document as unknown as PostgresJSONValue)},
            ${revision.contentHash},
            ${revision.dataContextVersion},
            ${revision.createdBy},
            ${createdAt}
          )
        `;
        await tx`
          UPDATE dashboard_pages
          SET latest_revision_id = ${revision.revisionId}
          WHERE page_id = ${command.pageId}
        `;

        const result: RevisionResult = { ok: true, revision };
        await tx`
          INSERT INTO lifecycle_idempotency (
            operation,
            client_id,
            idempotency_key,
            result,
            created_at
          )
          VALUES (
            'save_revision',
            ${context.clientId},
            ${command.idempotencyKey},
            ${tx.json(result as unknown as PostgresJSONValue)},
            ${createdAt}
          )
        `;
        return result;
      });
    },

    async getRevision(reference) {
      const rows = isValidUuid(reference.revisionId)
        ? ((await sql`
            SELECT
              revision_id,
              revision_number,
              page_id,
              base_revision_id,
              document,
              content_hash,
              data_context_version,
              created_by,
              created_at
            FROM page_revisions
            WHERE page_id = ${reference.pageId}
              AND revision_id = ${reference.revisionId}
          `) as unknown as RevisionRow[])
        : [];

      if (rows.length === 0) {
        return {
          ok: false,
          error: {
            code: 'REVISION_NOT_FOUND',
            message: `页面修订不存在:${reference.revisionId}`
          }
        };
      }
      return { ok: true, revision: toRevision(rows[0]) };
    },

    async getPage(reference) {
      return selectPageRevision(sql, reference);
    },

    async listPages(query = {}) {
      const limit = pageListLimit(query.limit);
      // visibility 从 published_revision_id 派生，而不是读取存储列：仓库里
      // 没有任何代码路径会 SET visibility，存储列会恒为建表时的默认值。
      const rows = (await sql`
        SELECT
          page_id,
          latest_revision_id,
          published_revision_id,
          CASE WHEN published_revision_id IS NULL THEN 'hidden' ELSE 'visible' END AS visibility
        FROM dashboard_pages
        WHERE page_id > ${query.afterPageId ?? ''}
        ORDER BY page_id ASC
        LIMIT ${limit + 1}
      `) as unknown as Array<{
        page_id: string;
        latest_revision_id: string | null;
        published_revision_id: string | null;
        visibility: PageVisibility;
      }>;
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
      const pages = (await sql`
        SELECT page_id
        FROM dashboard_pages
        WHERE page_id = ${reference.pageId}
      `) as unknown as Array<{ page_id: string }>;
      if (pages.length === 0) {
        return lifecycleFailure('PAGE_NOT_FOUND', `看板页面不存在:${reference.pageId}`);
      }
      const rows = (await sql`
        SELECT
          revision_id,
          revision_number,
          page_id,
          base_revision_id,
          document,
          content_hash,
          data_context_version,
          created_by,
          created_at
        FROM page_revisions
        WHERE page_id = ${reference.pageId}
        ORDER BY revision_number DESC, revision_id DESC
      `) as unknown as RevisionRow[];
      return {
        ok: true,
        history: {
          pageId: reference.pageId,
          revisions: rows.map(toRevision)
        }
      };
    },

    async diffRevisions(reference) {
      const [fromRows, toRows] = await Promise.all([
        selectRevision(sql, reference.pageId, reference.fromRevisionId),
        selectRevision(sql, reference.pageId, reference.toRevisionId)
      ]);
      const from = fromRows[0];
      if (!from) {
        return lifecycleFailure(
          'REVISION_NOT_FOUND',
          `页面修订不存在:${reference.fromRevisionId}`
        );
      }
      const to = toRows[0];
      if (!to) {
        return lifecycleFailure(
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
      const now = clock.now();
      const expiresAt = new Date(now.getTime() + publishLeaseMs);
      const requestId = ids.next();
      const token = tokens.next();
      const request: PublishRequest = {
        requestId,
        pageId: command.pageId,
        revisionId: command.revisionId,
        expiresAt: expiresAt.toISOString(),
        confirmationUrl: urls.confirmation(requestId, token)
      };

      return sql.begin(async (tx) => {
        await tx`
          SELECT pg_advisory_xact_lock(
            hashtextextended(
              ${`request_publish:${context.clientId}:${command.idempotencyKey}`},
              0
            )
          )
        `;
        const replay = await idempotentResult<PublishRequestResult>(
          tx,
          'request_publish',
          context.clientId,
          command.idempotencyKey
        );
        if (replay) return replay;

        await tx`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`dashboard_page:${command.pageId}`}, 0)
          )
        `;
        const pages = (await tx`
          SELECT page_id, latest_revision_id, active_publish_request_id
          FROM dashboard_pages
          WHERE page_id = ${command.pageId}
          FOR UPDATE
        `) as unknown as Array<{
          page_id: string;
          latest_revision_id: string | null;
          active_publish_request_id: string | null;
        }>;
        const page = pages[0];
        if (!page) {
          return lifecycleFailure('PAGE_NOT_FOUND', `看板页面不存在:${command.pageId}`);
        }
        if (page.latest_revision_id !== command.revisionId) {
          return lifecycleFailure(
            'REVISION_NOT_LATEST',
            `发布只能针对当前最新页面修订:${page.latest_revision_id ?? '无'}`
          );
        }

        if (page.active_publish_request_id) {
          const activeRows = (await tx`
            SELECT request_id, status, expires_at
            FROM publish_requests
            WHERE request_id = ${page.active_publish_request_id}
            FOR UPDATE
          `) as unknown as Array<{
            request_id: string;
            status: string;
            expires_at: Date | string;
          }>;
          const active = activeRows[0];
          if (
            active?.status === 'pending' &&
            new Date(active.expires_at).getTime() > now.getTime()
          ) {
            return lifecycleFailure(
              'PAGE_LOCKED',
              `看板页面已有活动发布租约:${active.request_id}`
            );
          }
          if (active?.status === 'pending') {
            await tx`
              UPDATE publish_requests
              SET
                status = 'expired',
                decided_at = ${now}
              WHERE request_id = ${active.request_id}
            `;
            await insertPublishAudit(tx, {
              requestId: active.request_id,
              pageId: command.pageId,
              revisionId: command.revisionId,
              action: 'expired',
              actorId: null,
              clientId: null,
              occurredAt: now,
              reason: '15 分钟发布租约已到期'
            });
          }
        }

        await tx`
          INSERT INTO publish_requests (
            request_id,
            page_id,
            revision_id,
            requested_by,
            requested_client_id,
            status,
            token_hash,
            created_at,
            expires_at
          )
          VALUES (
            ${requestId},
            ${command.pageId},
            ${command.revisionId},
            ${context.actorId},
            ${context.clientId},
            'pending',
            ${hash(token)},
            ${now},
            ${expiresAt}
          )
        `;
        await tx`
          UPDATE dashboard_pages
          SET active_publish_request_id = ${requestId}
          WHERE page_id = ${command.pageId}
        `;
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
        await tx`
          INSERT INTO lifecycle_idempotency (
            operation,
            client_id,
            idempotency_key,
            result,
            created_at
          )
          VALUES (
            'request_publish',
            ${context.clientId},
            ${command.idempotencyKey},
            ${tx.json(result as unknown as PostgresJSONValue)},
            ${now}
          )
        `;
        return result;
      });
    },

    async getPublishRequest(reference, context) {
      const request = await refreshPublishRequest(sql, reference.requestId, clock.now());
      if (!request) {
        return lifecycleFailure(
          'PUBLISH_REQUEST_NOT_FOUND',
          `发布请求不存在:${reference.requestId}`
        );
      }
      if (
        context.actorId !== request.requested_by &&
        !hasRole(context, 'publisher') &&
        !hasRole(context, 'admin')
      ) {
        return lifecycleFailure('PUBLISH_FORBIDDEN', '当前身份不能查看该发布请求');
      }
      return {
        ok: true,
        request: toPublishRequestDetails(request)
      };
    },

    async confirmPublish(command, context) {
      const requestRows = (await sql`
        SELECT
          request_id,
          page_id,
          revision_id,
          requested_by,
          requested_client_id,
          status,
          token_hash,
          expires_at,
          decided_by,
          decided_client_id,
          decided_at
        FROM publish_requests
        WHERE request_id = ${command.requestId}
      `) as unknown as PublishRequestRow[];
      const request = requestRows[0];
      if (!request) {
        return lifecycleFailure(
          'PUBLISH_REQUEST_NOT_FOUND',
          `发布请求不存在:${command.requestId}`
        );
      }

      const revisionRows = await selectRevision(sql, request.page_id, request.revision_id);
      const revision = revisionRows[0];
      if (!revision) {
        return lifecycleFailure(
          'REVISION_NOT_FOUND',
          `页面修订不存在:${request.revision_id}`
        );
      }
      const validationErrors = validate(revision.document);

      return sql.begin(async (tx) => {
        await lockDashboardPage(tx, request.page_id);
        const lockedRows = (await tx`
          SELECT
            request_id,
            page_id,
            revision_id,
            requested_by,
            requested_client_id,
            status,
            token_hash,
            expires_at,
            decided_by,
            decided_client_id,
            decided_at
          FROM publish_requests
          WHERE request_id = ${command.requestId}
          FOR UPDATE
        `) as unknown as PublishRequestRow[];
        const locked = lockedRows[0];
        if (!locked) {
          return lifecycleFailure(
            'PUBLISH_REQUEST_NOT_FOUND',
            `发布请求不存在:${command.requestId}`
          );
        }
        if (locked.status !== 'pending') {
          return lifecycleFailure(
            'PUBLISH_REQUEST_CLOSED',
            `发布请求已结束:${locked.status}`
          );
        }

        const now = clock.now();
        if (new Date(locked.expires_at).getTime() <= now.getTime()) {
          await finishPublishRequest(tx, locked, 'expired', null, now,
            '15 分钟发布租约已到期');
          return lifecycleFailure(
            'PUBLISH_REQUEST_EXPIRED',
            `发布租约已于 ${new Date(locked.expires_at).toISOString()} 到期`
          );
        }
        if (hash(command.token) !== locked.token_hash) {
          return lifecycleFailure('INVALID_CONFIRMATION_TOKEN', '发布确认 token 无效');
        }
        if (!hasRole(context, 'publisher') && !hasRole(context, 'admin')) {
          return lifecycleFailure('PUBLISH_FORBIDDEN', '确认发布需要 publisher 权限');
        }

        const pageRows = (await tx`
          SELECT latest_revision_id, active_publish_request_id
          FROM dashboard_pages
          WHERE page_id = ${locked.page_id}
          FOR UPDATE
        `) as unknown as Array<{
          latest_revision_id: string | null;
          active_publish_request_id: string | null;
        }>;
        const page = pageRows[0];
        if (
          !page ||
          page.latest_revision_id !== locked.revision_id ||
          page.active_publish_request_id !== locked.request_id
        ) {
          return lifecycleFailure(
            'REVISION_NOT_LATEST',
            '发布请求不再绑定当前最新页面修订'
          );
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

        await tx`
          UPDATE dashboard_pages
          SET
            published_revision_id = ${locked.revision_id},
            active_publish_request_id = NULL
          WHERE page_id = ${locked.page_id}
        `;
        await tx`
          UPDATE publish_requests
          SET
            status = 'published',
            confirmed_by = ${context.actorId},
            confirmed_at = ${now},
            decided_by = ${context.actorId},
            decided_client_id = ${context.clientId},
            decided_at = ${now}
          WHERE request_id = ${locked.request_id}
        `;
        await insertPublishAudit(tx, {
          requestId: locked.request_id,
          pageId: locked.page_id,
          revisionId: locked.revision_id,
          action: 'approved',
          actorId: context.actorId,
          clientId: context.clientId,
          occurredAt: now,
          reason: null
        });
        return { ok: true, revision: toRevision(revision) } satisfies RevisionResult;
      });
    },

    async rejectPublish(command, context) {
      return decidePublishRequest(sql, command.requestId, clock.now(), async (tx, locked, now) => {
        if (hash(command.token) !== locked.token_hash) {
          return lifecycleFailure('INVALID_CONFIRMATION_TOKEN', '发布确认 token 无效');
        }
        if (!hasRole(context, 'publisher') && !hasRole(context, 'admin')) {
          return lifecycleFailure('PUBLISH_FORBIDDEN', '拒绝发布需要 publisher 权限');
        }
        await finishPublishRequest(tx, locked, 'rejected', context, now, command.reason ?? null);
        return { ok: true, request: toPublishRequestDetails({
          ...locked,
          status: 'rejected',
          decided_by: context.actorId,
          decided_client_id: context.clientId,
          decided_at: now
        }) };
      });
    },

    async cancelPublish(command, context) {
      return decidePublishRequest(sql, command.requestId, clock.now(), async (tx, locked, now) => {
        if (context.actorId !== locked.requested_by && !hasRole(context, 'admin')) {
          return lifecycleFailure('PUBLISH_FORBIDDEN', '只有发起人或管理员可取消发布请求');
        }
        await finishPublishRequest(tx, locked, 'cancelled', context, now, command.reason ?? null);
        return { ok: true, request: toPublishRequestDetails({
          ...locked,
          status: 'cancelled',
          decided_by: context.actorId,
          decided_client_id: context.clientId,
          decided_at: now
        }) };
      });
    },

    async forceReleasePublish(command, context) {
      return decidePublishRequest(sql, command.requestId, clock.now(), async (tx, locked, now) => {
        if (!hasRole(context, 'admin')) {
          return lifecycleFailure('PUBLISH_FORBIDDEN', '强制释放发布租约需要 admin 权限');
        }
        await finishPublishRequest(tx, locked, 'force_released', context, now, command.reason);
        return { ok: true, request: toPublishRequestDetails({
          ...locked,
          status: 'force_released',
          decided_by: context.actorId,
          decided_client_id: context.clientId,
          decided_at: now
        }) };
      });
    },

    async listPublishAudit(reference, context) {
      const request = await refreshPublishRequest(sql, reference.requestId, clock.now());
      if (!request) {
        return lifecycleFailure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${reference.requestId}`);
      }
      if (
        context.actorId !== request.requested_by &&
        !hasRole(context, 'publisher') &&
        !hasRole(context, 'admin')
      ) {
        return lifecycleFailure('PUBLISH_FORBIDDEN', '当前身份不能查看该发布审计');
      }
      const rows = (await sql`
        SELECT
          audit_id,
          request_id,
          page_id,
          revision_id,
          action,
          actor_id,
          client_id,
          occurred_at,
          reason
        FROM publish_audit_events
        WHERE request_id = ${reference.requestId}
        ORDER BY audit_id ASC
      `) as unknown as Array<{
        audit_id: string | number;
        request_id: string;
        page_id: string;
        revision_id: string;
        action: PublishAuditAction;
        actor_id: string | null;
        client_id: string | null;
        occurred_at: Date | string;
        reason: string | null;
      }>;
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
        selectPageRevision(sql, { pageId: command.pageId, selector: { type: 'latest' } }),
        selectPageRevision(sql, {
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
      const rows = (await sql`
        SELECT
          revision.revision_id,
          revision.revision_number,
          revision.page_id,
          revision.base_revision_id,
          revision.document,
          revision.content_hash,
          revision.data_context_version,
          revision.created_by,
          revision.created_at
        FROM dashboard_pages AS page
        LEFT JOIN page_revisions AS revision
          ON revision.revision_id = page.published_revision_id
        WHERE page.page_id = ${reference.pageId}
      `) as unknown as Array<RevisionRow & { revision_id: string | null }>;

      if (rows.length === 0) {
        return lifecycleFailure('PAGE_NOT_FOUND', `看板页面不存在:${reference.pageId}`);
      }
      if (!rows[0].revision_id) {
        return lifecycleFailure(
          'PAGE_NOT_PUBLISHED',
          `看板页面尚未发布:${reference.pageId}`
        );
      }
      return { ok: true, revision: toRevision(rows[0] as RevisionRow) };
    },

    async getPublishedRevision(reference) {
      const rows = isValidUuid(reference.revisionId)
        ? ((await sql`
            SELECT
              revision.revision_id,
              revision.revision_number,
              revision.page_id,
              revision.base_revision_id,
              revision.document,
              revision.content_hash,
              revision.data_context_version,
              revision.created_by,
              revision.created_at
            FROM page_revisions AS revision
            WHERE revision.page_id = ${reference.pageId}
              AND revision.revision_id = ${reference.revisionId}
              AND EXISTS (
                SELECT 1
                FROM publish_requests AS request
                WHERE request.page_id = revision.page_id
                  AND request.revision_id = revision.revision_id
                  AND request.status = 'published'
              )
          `) as unknown as RevisionRow[])
        : [];
      if (!rows[0]) {
        const revision = await lifecycle.getRevision(reference);
        return revision.ok
          ? lifecycleFailure(
              'REVISION_NOT_PUBLISHED',
              `页面修订未曾发布:${reference.revisionId}`
            )
          : revision;
      }
      return { ok: true, revision: toRevision(rows[0]) };
    },

    async close() {
      await sql.end();
    }
  };
  return lifecycle;
}

async function ensureSchema(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS dashboard_pages (
      page_id text PRIMARY KEY,
      latest_revision_id uuid,
      published_revision_id uuid,
      active_publish_request_id uuid,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL
    )
  `;
  await sql`
    ALTER TABLE dashboard_pages
    ADD COLUMN IF NOT EXISTS active_publish_request_id uuid
  `;
  // visibility 曾作为存储列声明，但全仓库没有任何写路径会 SET 它，
  // 恒等于建表默认值。listPages() 改为从 published_revision_id 派生，
  // 因此这里不再需要该列（也不做迁移期 DROP COLUMN，避免影响既有部署）。
  await sql`
    CREATE TABLE IF NOT EXISTS page_revisions (
      revision_id uuid PRIMARY KEY,
      revision_number integer NOT NULL,
      page_id text NOT NULL REFERENCES dashboard_pages(page_id),
      base_revision_id uuid,
      document jsonb NOT NULL,
      content_hash text NOT NULL,
      data_context_version text,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL,
      UNIQUE (page_id, revision_number)
    )
  `;
  await sql`
    ALTER TABLE page_revisions
    ADD COLUMN IF NOT EXISTS data_context_version text
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS publish_requests (
      request_id uuid PRIMARY KEY,
      page_id text NOT NULL REFERENCES dashboard_pages(page_id),
      revision_id uuid NOT NULL REFERENCES page_revisions(revision_id),
      requested_by text NOT NULL,
      requested_client_id text NOT NULL DEFAULT 'unknown',
      status text NOT NULL,
      token_hash text NOT NULL,
      created_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      confirmed_by text,
      confirmed_at timestamptz,
      decided_by text,
      decided_client_id text,
      decided_at timestamptz
    )
  `;
  await sql`
    ALTER TABLE publish_requests
    ADD COLUMN IF NOT EXISTS requested_client_id text NOT NULL DEFAULT 'unknown'
  `;
  await sql`
    ALTER TABLE publish_requests
    ADD COLUMN IF NOT EXISTS decided_by text
  `;
  await sql`
    ALTER TABLE publish_requests
    ADD COLUMN IF NOT EXISTS decided_client_id text
  `;
  await sql`
    ALTER TABLE publish_requests
    ADD COLUMN IF NOT EXISTS decided_at timestamptz
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS publish_audit_events (
      audit_id bigserial PRIMARY KEY,
      request_id uuid NOT NULL REFERENCES publish_requests(request_id),
      page_id text NOT NULL REFERENCES dashboard_pages(page_id),
      revision_id uuid NOT NULL REFERENCES page_revisions(revision_id),
      action text NOT NULL,
      actor_id text,
      client_id text,
      occurred_at timestamptz NOT NULL,
      reason text
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS lifecycle_idempotency (
      operation text NOT NULL,
      client_id text NOT NULL,
      idempotency_key text NOT NULL,
      result jsonb NOT NULL,
      created_at timestamptz NOT NULL,
      PRIMARY KEY (operation, client_id, idempotency_key)
    )
  `;
}

async function selectPublishRequest(
  sql: Sql | TransactionSql,
  requestId: string,
  forUpdate = false
): Promise<PublishRequestRow | null> {
  const rows = forUpdate
    ? ((await sql`
        SELECT
          request_id,
          page_id,
          revision_id,
          requested_by,
          requested_client_id,
          status,
          token_hash,
          expires_at,
          decided_by,
          decided_client_id,
          decided_at
        FROM publish_requests
        WHERE request_id = ${requestId}
        FOR UPDATE
      `) as unknown as PublishRequestRow[])
    : ((await sql`
        SELECT
          request_id,
          page_id,
          revision_id,
          requested_by,
          requested_client_id,
          status,
          token_hash,
          expires_at,
          decided_by,
          decided_client_id,
          decided_at
        FROM publish_requests
        WHERE request_id = ${requestId}
      `) as unknown as PublishRequestRow[]);
  return rows[0] ?? null;
}

async function refreshPublishRequest(
  sql: Sql,
  requestId: string,
  now: Date
): Promise<PublishRequestRow | null> {
  const request = await selectPublishRequest(sql, requestId);
  if (
    !request ||
    request.status !== 'pending' ||
    new Date(request.expires_at).getTime() > now.getTime()
  ) {
    return request;
  }
  return sql.begin(async (tx) => {
    await lockDashboardPage(tx, request.page_id);
    const locked = await selectPublishRequest(tx, requestId, true);
    if (!locked) return null;
    if (
      locked.status === 'pending' &&
      new Date(locked.expires_at).getTime() <= now.getTime()
    ) {
      await finishPublishRequest(
        tx,
        locked,
        'expired',
        null,
        now,
        '15 分钟发布租约已到期'
      );
      return { ...locked, status: 'expired', decided_at: now };
    }
    return locked;
  });
}

async function decidePublishRequest(
  sql: Sql,
  requestId: string,
  now: Date,
  decide: (
    tx: TransactionSql,
    request: PublishRequestRow,
    now: Date
  ) => Promise<PublishRequestDetailsResult>
): Promise<PublishRequestDetailsResult> {
  const request = await selectPublishRequest(sql, requestId);
  if (!request) {
    return lifecycleFailure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${requestId}`);
  }
  return sql.begin(async (tx) => {
    await lockDashboardPage(tx, request.page_id);
    const locked = await selectPublishRequest(tx, requestId, true);
    if (!locked) {
      return lifecycleFailure('PUBLISH_REQUEST_NOT_FOUND', `发布请求不存在:${requestId}`);
    }
    if (locked.status !== 'pending') {
      return lifecycleFailure('PUBLISH_REQUEST_CLOSED', `发布请求已结束:${locked.status}`);
    }
    if (new Date(locked.expires_at).getTime() <= now.getTime()) {
      await finishPublishRequest(
        tx,
        locked,
        'expired',
        null,
        now,
        '15 分钟发布租约已到期'
      );
      return lifecycleFailure(
        'PUBLISH_REQUEST_EXPIRED',
        `发布租约已于 ${toIso(locked.expires_at)} 到期`
      );
    }
    return decide(tx, locked, now);
  });
}

async function finishPublishRequest(
  tx: TransactionSql,
  request: PublishRequestRow,
  status: Exclude<PublishRequestStatus, 'pending' | 'published'>,
  context: LifecycleContext | null,
  now: Date,
  reason: string | null
): Promise<void> {
  await tx`
    UPDATE publish_requests
    SET
      status = ${status},
      decided_by = ${context?.actorId ?? null},
      decided_client_id = ${context?.clientId ?? null},
      decided_at = ${now}
    WHERE request_id = ${request.request_id}
      AND status = 'pending'
  `;
  await tx`
    UPDATE dashboard_pages
    SET active_publish_request_id = NULL
    WHERE page_id = ${request.page_id}
      AND active_publish_request_id = ${request.request_id}
  `;
  await insertPublishAudit(tx, {
    requestId: request.request_id,
    pageId: request.page_id,
    revisionId: request.revision_id,
    action: status,
    actorId: context?.actorId ?? null,
    clientId: context?.clientId ?? null,
    occurredAt: now,
    reason
  });
}

async function insertPublishAudit(
  tx: TransactionSql,
  event: Omit<PublishAuditEvent, 'auditId' | 'occurredAt'> & { occurredAt: Date }
): Promise<void> {
  await tx`
    INSERT INTO publish_audit_events (
      request_id,
      page_id,
      revision_id,
      action,
      actor_id,
      client_id,
      occurred_at,
      reason
    )
    VALUES (
      ${event.requestId},
      ${event.pageId},
      ${event.revisionId},
      ${event.action},
      ${event.actorId},
      ${event.clientId},
      ${event.occurredAt},
      ${event.reason}
    )
  `;
}

async function lockDashboardPage(tx: TransactionSql, pageId: string): Promise<void> {
  await tx`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`dashboard_page:${pageId}`}, 0)
    )
  `;
}

function toPublishRequestDetails(request: PublishRequestRow): PublishRequestDetails {
  return {
    requestId: request.request_id,
    pageId: request.page_id,
    revisionId: request.revision_id,
    requestedBy: request.requested_by,
    requestedClientId: request.requested_client_id,
    status: request.status,
    expiresAt: toIso(request.expires_at),
    decidedBy: request.decided_by,
    decidedClientId: request.decided_client_id,
    decidedAt: request.decided_at ? toIso(request.decided_at) : null
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function idempotentResult<T>(
  sql: Sql | TransactionSql,
  operation: string,
  clientId: string,
  idempotencyKey: string
): Promise<T | null> {
  const rows = (await sql`
    SELECT result
    FROM lifecycle_idempotency
    WHERE operation = ${operation}
      AND client_id = ${clientId}
      AND idempotency_key = ${idempotencyKey}
  `) as unknown as Array<{ result: T }>;
  return rows[0]?.result ?? null;
}

/**
 * `revision_id` 是 postgres 侧的 uuid 列。语法上不是合法 UUID 的字符串
 * （例如 HTTP 路由把 URL 参数原样传入）会让驱动在查询层直接抛出
 * PostgresError，而不是像 memory 实现那样优雅地返回业务错误。这里在
 * 进入 SQL 之前拦截格式非法的输入，与 memory 侧的行为对齐——memory
 * 只是做一次 Map/数组查找，天然不会因为格式而抛异常。
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

async function selectRevision(
  sql: Sql | TransactionSql,
  pageId: string,
  revisionId: string
): Promise<RevisionRow[]> {
  if (!isValidUuid(revisionId)) return [];
  return (await sql`
    SELECT
      revision_id,
      revision_number,
      page_id,
      base_revision_id,
      document,
      content_hash,
      data_context_version,
      created_by,
      created_at
    FROM page_revisions
    WHERE page_id = ${pageId}
      AND revision_id = ${revisionId}
  `) as unknown as RevisionRow[];
}

async function selectPageRevision(
  sql: Sql,
  reference: PageReference
): Promise<RevisionResult> {
  if (reference.selector.type === 'exact') {
    const existingPages = (await sql`
      SELECT page_id FROM dashboard_pages WHERE page_id = ${reference.pageId}
    `) as unknown as Array<{ page_id: string }>;
    if (existingPages.length === 0) {
      return lifecycleFailure('PAGE_NOT_FOUND', `看板页面不存在:${reference.pageId}`);
    }
    const rows = await selectRevision(sql, reference.pageId, reference.selector.revisionId);
    if (!rows[0]) {
      return lifecycleFailure(
        'REVISION_NOT_FOUND',
        `页面修订不存在:${reference.selector.revisionId}`
      );
    }
    return { ok: true, revision: toRevision(rows[0]) };
  }

  const column =
    reference.selector.type === 'latest' ? 'latest_revision_id' : 'published_revision_id';
  const pages = (await sql.unsafe(
    `
      SELECT ${column} AS revision_id
      FROM dashboard_pages
      WHERE page_id = $1
    `,
    [reference.pageId]
  )) as unknown as Array<{ revision_id: string | null }>;
  const page = pages[0];
  if (!page) {
    return lifecycleFailure('PAGE_NOT_FOUND', `看板页面不存在:${reference.pageId}`);
  }
  if (!page.revision_id) {
    return lifecycleFailure(
      reference.selector.type === 'published' ? 'PAGE_NOT_PUBLISHED' : 'REVISION_NOT_FOUND',
      reference.selector.type === 'published'
        ? `看板页面尚未发布:${reference.pageId}`
        : `页面没有最新修订:${reference.pageId}`
    );
  }
  const rows = await selectRevision(sql, reference.pageId, page.revision_id);
  if (!rows[0]) {
    return lifecycleFailure('REVISION_NOT_FOUND', `页面修订不存在:${page.revision_id}`);
  }
  return { ok: true, revision: toRevision(rows[0]) };
}

function toRevision(row: RevisionRow): PageRevision {
  return {
    revisionId: row.revision_id,
    revisionNumber: row.revision_number,
    pageId: row.page_id,
    baseRevisionId: row.base_revision_id,
    document: row.document,
    contentHash: row.content_hash,
    dataContextVersion: row.data_context_version,
    createdBy: row.created_by,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString()
  };
}
