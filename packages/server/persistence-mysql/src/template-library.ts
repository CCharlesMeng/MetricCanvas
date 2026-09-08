import { randomUUID } from 'node:crypto';
import { hash, type PageLifecycle } from '@metriccanvas/page-lifecycle';
import {
  clone,
  conflict,
  failure,
  forbidden,
  isAdmin,
  normalizeStrings,
  validateCommand
} from '@metriccanvas/template-library/invariants';
import type {
  MemoryTemplateLibraryOptions,
  TemplateLibrary,
  TemplateListItem,
  TemplateMatch,
  TemplatePublishRequest,
  TemplatePublishRequestResult,
  TemplatePublishStatus,
  TemplateRevision,
  TemplateRevisionResult
} from '@metriccanvas/template-library';
import {
  createMySqlDatabase,
  fromJson,
  jsonParameter,
  lockTransactionKey,
  toIso,
  type MySqlExecutor
} from './database';

export interface MySqlTemplateLibraryOptions
  extends Omit<MemoryTemplateLibraryOptions, 'pageLifecycle'> {
  databaseUrl: string;
  pageLifecycle: PageLifecycle;
}

interface TemplateRevisionRow {
  revision_id: string;
  revision_number: number;
  template_id: string;
  base_revision_id: string | null;
  title: string;
  description: string;
  tags: string[];
  viewer_subject_ids: string[];
  source_page_id: string;
  source_revision_id: string;
  created_by: string;
  created_at: Date | string;
}

interface TemplatePublishRequestRow {
  request_id: string;
  template_id: string;
  revision_id: string;
  confirmation_url: string;
  requested_by: string;
  status: TemplatePublishStatus;
  token_hash: string;
  created_at: Date | string;
  decided_by: string | null;
  decided_at: Date | string | null;
}

export async function createMySqlTemplateLibrary(
  options: MySqlTemplateLibraryOptions
): Promise<TemplateLibrary> {
  // 生产 DDL 由 P3 的独立 migration Job 执行；工厂只连接既有 schema。
  const database = createMySqlDatabase(options.databaseUrl);
  const clock = options.clock ?? { now: () => new Date() };
  const ids = options.ids ?? { next: () => randomUUID() };
  const tokens = options.tokens ?? { next: () => randomUUID() };
  const urls = options.urls ?? {
    confirmation: (requestId: string, token: string) =>
      `/templates/publish/${requestId}?token=${encodeURIComponent(token)}`
  };

  const library: TemplateLibrary = {
    async saveRevision(command, context) {
      if (!isAdmin(context)) return forbidden('保存模板修订需要 admin 权限');
      return database.transaction(async (tx) => {
        await lockTemplateIdempotency(
          tx,
          'save_revision',
          context.clientId,
          command.idempotencyKey
        );
        const replay = await templateIdempotentResult<TemplateRevisionResult>(
          tx,
          'save_revision',
          context.clientId,
          command.idempotencyKey
        );
        if (replay) return replay;
        // 与 memory/PG 一致：同幂等键已成功时，即使重试 payload 已损坏，
        // 仍优先重放已提交结果，而不是重新校验一条已经完成的命令。
        const invalid = validateCommand(command);
        if (invalid) return invalid;

        await lockTemplate(tx, command.templateId);
        const template = (await tx.query<{ latest_revision_id: string | null }>(
          `SELECT latest_revision_id FROM page_templates
           WHERE template_id = ? FOR UPDATE`,
          [command.templateId]
        ))[0];
        const latest = template?.latest_revision_id
          ? await selectTemplateRevision(tx, template.latest_revision_id)
          : null;
        if (!template && command.baseRevisionId !== null) {
          return conflict('首次保存的 baseRevisionId 必须为 null', null);
        }
        if (template && command.baseRevisionId !== latest?.revisionId) {
          return conflict(`保存基线不是当前最新模板修订:${latest?.revisionId ?? '无'}`, latest);
        }
        const source = await options.pageLifecycle.getPublishedRevision(command.source);
        if (!source.ok) {
          return failure(
            'SOURCE_REVISION_NOT_PUBLISHED',
            `模板来源必须是已发布页面修订:${command.source.revisionId}`
          );
        }

        const createdAt = clock.now();
        const revision: TemplateRevision = {
          revisionId: ids.next(),
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          templateId: command.templateId,
          baseRevisionId: command.baseRevisionId,
          title: command.title.trim(),
          description: command.description?.trim() ?? '',
          tags: normalizeStrings(command.tags ?? []),
          viewerSubjectIds: normalizeStrings(command.viewerSubjectIds),
          source: clone(command.source),
          createdBy: context.actorId,
          createdAt: createdAt.toISOString()
        };
        if (!template) {
          await tx.query(
            `INSERT INTO page_templates
             (template_id, latest_revision_id, published_revision_id, created_by, created_at)
             VALUES (?, NULL, NULL, ?, ?)`,
            [command.templateId, context.actorId, createdAt]
          );
        }
        await tx.query(
          `INSERT INTO template_revisions
           (revision_id, revision_number, template_id, base_revision_id,
            title, description, tags, viewer_subject_ids, source_page_id,
            source_revision_id, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            revision.revisionId,
            revision.revisionNumber,
            revision.templateId,
            revision.baseRevisionId,
            revision.title,
            revision.description,
            jsonParameter(revision.tags),
            jsonParameter(revision.viewerSubjectIds),
            revision.source.pageId,
            revision.source.revisionId,
            revision.createdBy,
            createdAt
          ]
        );
        await tx.query(
          'UPDATE page_templates SET latest_revision_id = ? WHERE template_id = ?',
          [revision.revisionId, revision.templateId]
        );
        const result: TemplateRevisionResult = { ok: true, revision };
        await storeTemplateIdempotentResult(
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

    async requestPublish(command, context) {
      if (!isAdmin(context)) return forbidden('申请发布页面模板需要 admin 权限');
      return database.transaction(async (tx) => {
        await lockTemplateIdempotency(
          tx,
          'request_publish',
          context.clientId,
          command.idempotencyKey
        );
        const replay = await templateIdempotentResult<TemplatePublishRequestResult>(
          tx,
          'request_publish',
          context.clientId,
          command.idempotencyKey
        );
        if (replay) return replay;

        await lockTemplate(tx, command.templateId);
        const template = (await tx.query<{ latest_revision_id: string | null }>(
          `SELECT latest_revision_id FROM page_templates
           WHERE template_id = ? FOR UPDATE`,
          [command.templateId]
        ))[0];
        if (!template) {
          return failure('TEMPLATE_NOT_FOUND', `页面模板不存在:${command.templateId}`);
        }
        if (template.latest_revision_id !== command.revisionId) {
          return failure(
            'TEMPLATE_REVISION_NOT_LATEST',
            `只能发布当前最新模板修订:${template.latest_revision_id ?? '无'}`
          );
        }
        const requestId = ids.next();
        const token = tokens.next();
        const createdAt = clock.now();
        const request: TemplatePublishRequest = {
          requestId,
          templateId: command.templateId,
          revisionId: command.revisionId,
          confirmationUrl: urls.confirmation(requestId, token),
          requestedBy: context.actorId,
          status: 'pending',
          decidedBy: null,
          createdAt: createdAt.toISOString(),
          decidedAt: null
        };
        await tx.query(
          `INSERT INTO template_publish_requests
           (request_id, template_id, revision_id, confirmation_url, requested_by,
            status, token_hash, created_at, decided_by, decided_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL, NULL)`,
          [
            request.requestId,
            request.templateId,
            request.revisionId,
            request.confirmationUrl,
            request.requestedBy,
            hash(token),
            createdAt
          ]
        );
        const result: TemplatePublishRequestResult = { ok: true, request };
        await storeTemplateIdempotentResult(
          tx,
          'request_publish',
          context.clientId,
          command.idempotencyKey,
          result,
          createdAt
        );
        return result;
      });
    },

    async getPublishRequest({ requestId }, context) {
      if (!isAdmin(context)) return forbidden('查看模板发布请求需要 admin 权限');
      const row = await selectTemplatePublishRequest(database, requestId);
      return row
        ? { ok: true, request: templatePublishRequestFromPersistence(row) }
        : failure('TEMPLATE_PUBLISH_REQUEST_NOT_FOUND', `模板发布请求不存在:${requestId}`);
    },

    async confirmPublish(command, context) {
      if (!isAdmin(context)) return forbidden('确认发布页面模板需要 admin 权限');
      const existing = await selectTemplatePublishRequest(database, command.requestId);
      if (!existing) {
        return failure(
          'TEMPLATE_PUBLISH_REQUEST_NOT_FOUND',
          `模板发布请求不存在:${command.requestId}`
        );
      }
      return database.transaction(async (tx) => {
        await lockTemplate(tx, existing.template_id);
        const request = await selectTemplatePublishRequest(tx, command.requestId, true);
        if (!request) {
          return failure(
            'TEMPLATE_PUBLISH_REQUEST_NOT_FOUND',
            `模板发布请求不存在:${command.requestId}`
          );
        }
        if (request.status !== 'pending') {
          return failure(
            'TEMPLATE_PUBLISH_REQUEST_CLOSED',
            `模板发布请求已结束:${request.status}`
          );
        }
        if (hash(command.token) !== request.token_hash) {
          return failure('INVALID_TEMPLATE_CONFIRMATION_TOKEN', '模板发布确认 token 无效');
        }
        const template = (await tx.query<{ latest_revision_id: string | null }>(
          `SELECT latest_revision_id FROM page_templates
           WHERE template_id = ? FOR UPDATE`,
          [request.template_id]
        ))[0];
        if (template?.latest_revision_id !== request.revision_id) {
          return failure(
            'TEMPLATE_REVISION_NOT_LATEST',
            '模板发布请求不再绑定当前最新模板修订'
          );
        }
        const revision = await selectTemplateRevision(tx, request.revision_id);
        if (!revision) {
          return failure(
            'TEMPLATE_REVISION_NOT_FOUND',
            `模板修订不存在:${request.revision_id}`
          );
        }
        const decidedAt = clock.now();
        await tx.query(
          'UPDATE page_templates SET published_revision_id = ? WHERE template_id = ?',
          [request.revision_id, request.template_id]
        );
        await tx.query(
          `UPDATE template_publish_requests
           SET status = 'published', decided_by = ?, decided_at = ?
           WHERE request_id = ?`,
          [context.actorId, decidedAt, request.request_id]
        );
        return { ok: true, revision };
      });
    },

    async list(context) {
      if (!isAdmin(context)) return { templates: [] };
      const rows = await database.query<{
        template_id: string;
        latest_revision_id: string;
        published_revision_id: string | null;
      }>(
        `SELECT template.template_id,
                latest.revision_id AS latest_revision_id,
                published.revision_id AS published_revision_id
         FROM page_templates AS template
         JOIN template_revisions AS latest
           ON latest.revision_id = template.latest_revision_id
         LEFT JOIN template_revisions AS published
           ON published.revision_id = template.published_revision_id
         ORDER BY template.template_id`
      );
      const templates: TemplateListItem[] = [];
      for (const row of rows) {
        const latest = await selectTemplateRevision(database, row.latest_revision_id);
        const published = row.published_revision_id
          ? await selectTemplateRevision(database, row.published_revision_id)
          : null;
        if (latest) {
          templates.push({
            templateId: row.template_id,
            latestRevision: latest,
            publishedRevision: published
          });
        }
      }
      return { templates };
    },

    async search(query, context) {
      const rows = await database.query<TemplateRevisionRow>(
        `SELECT revision.*
         FROM page_templates AS template
         JOIN template_revisions AS revision
           ON revision.revision_id = template.published_revision_id
         ORDER BY template.template_id`
      );
      const needle = query.query.trim().toLocaleLowerCase();
      const subjectIds = new Set([context.actorId, ...(context.subjectIds ?? [])]);
      const limit = Math.max(1, Math.min(query.limit ?? 5, 20));
      const revisions = rows
        .map(templateRevisionFromPersistence)
        .filter((revision) =>
          revision.viewerSubjectIds.some((subjectId) => subjectIds.has(subjectId))
        )
        .filter((revision) =>
          [revision.templateId, revision.title, revision.description, ...revision.tags]
            .join(' ')
            .toLocaleLowerCase()
            .includes(needle)
        )
        .slice(0, limit);
      const matches: TemplateMatch[] = [];
      for (const revision of revisions) {
        const source = await options.pageLifecycle.getPublishedRevision(revision.source);
        if (source.ok) {
          matches.push({
            templateId: revision.templateId,
            revision,
            sourcePageRevision: source.revision
          });
        }
      }
      return { matches };
    },

    async close() {
      await database.close();
    }
  };

  return library;
}

async function lockTemplate(tx: MySqlExecutor, templateId: string): Promise<void> {
  await lockTransactionKey(tx, `template:${hash(templateId)}`);
}

async function lockTemplateIdempotency(
  tx: MySqlExecutor,
  operation: string,
  clientId: string,
  key: string
): Promise<void> {
  await lockTransactionKey(tx, `template-idempotency:${hash(`${operation}\0${clientId}\0${key}`)}`);
}

async function selectTemplateRevision(
  sql: MySqlExecutor,
  revisionId: string
): Promise<TemplateRevision | null> {
  const row = (await sql.query<TemplateRevisionRow>(
    'SELECT * FROM template_revisions WHERE revision_id = ?',
    [revisionId]
  ))[0];
  return row ? templateRevisionFromPersistence(row) : null;
}

async function selectTemplatePublishRequest(
  sql: MySqlExecutor,
  requestId: string,
  forUpdate = false
): Promise<TemplatePublishRequestRow | null> {
  const row = (await sql.query<TemplatePublishRequestRow>(
    `SELECT * FROM template_publish_requests
     WHERE request_id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [requestId]
  ))[0];
  return row ?? null;
}

function templateRevisionFromPersistence(
  row: TemplateRevisionRow
): TemplateRevision {
  return {
    revisionId: row.revision_id,
    revisionNumber: row.revision_number,
    templateId: row.template_id,
    baseRevisionId: row.base_revision_id,
    title: row.title,
    description: row.description,
    tags: row.tags,
    viewerSubjectIds: row.viewer_subject_ids,
    source: { pageId: row.source_page_id, revisionId: row.source_revision_id },
    createdBy: row.created_by,
    createdAt: toIso(row.created_at)
  };
}

function templatePublishRequestFromPersistence(
  row: TemplatePublishRequestRow
): TemplatePublishRequest {
  return {
    requestId: row.request_id,
    templateId: row.template_id,
    revisionId: row.revision_id,
    confirmationUrl: row.confirmation_url,
    requestedBy: row.requested_by,
    status: row.status,
    decidedBy: row.decided_by,
    createdAt: toIso(row.created_at),
    decidedAt: row.decided_at ? toIso(row.decided_at) : null
  };
}

async function templateIdempotentResult<T>(
  sql: MySqlExecutor,
  operation: string,
  clientId: string,
  idempotencyKey: string
): Promise<T | null> {
  const row = (await sql.query<{ result: T | string | Buffer }>(
    `SELECT result FROM template_idempotency
     WHERE operation = ? AND client_id = ? AND idempotency_key = ?`,
    [operation, clientId, idempotencyKey]
  ))[0];
  return row ? fromJson<T>(row.result) : null;
}

async function storeTemplateIdempotentResult(
  tx: MySqlExecutor,
  operation: string,
  clientId: string,
  idempotencyKey: string,
  result: TemplateRevisionResult | TemplatePublishRequestResult,
  createdAt: Date
): Promise<void> {
  await tx.query(
    `INSERT INTO template_idempotency
     (operation, client_id, idempotency_key, result, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [operation, clientId, idempotencyKey, jsonParameter(result), createdAt]
  );
}
