import { createHash, randomUUID } from 'node:crypto';
import postgres, {
  type JSONValue,
  type Sql,
  type TransactionSql
} from 'postgres';
import type {
  PageLifecycle,
  PageRevision,
  RevisionReference
} from '@metriccanvas/page-lifecycle';

export interface TemplateContext {
  actorId: string;
  clientId: string;
  subjectIds?: readonly string[];
  roles?: readonly TemplateRole[];
}

export type TemplateRole = 'admin';

export interface TemplateRevision {
  revisionId: string;
  revisionNumber: number;
  templateId: string;
  baseRevisionId: string | null;
  title: string;
  description: string;
  tags: string[];
  viewerSubjectIds: string[];
  source: RevisionReference;
  createdBy: string;
  createdAt: string;
}

export interface SaveTemplateRevisionCommand {
  templateId: string;
  baseRevisionId: string | null;
  title: string;
  description?: string;
  tags?: string[];
  viewerSubjectIds: string[];
  source: RevisionReference;
  idempotencyKey: string;
}

export interface RequestTemplatePublishCommand {
  templateId: string;
  revisionId: string;
  idempotencyKey: string;
}

export interface ConfirmTemplatePublishCommand {
  requestId: string;
  token: string;
}

export interface TemplatePublishRequest {
  requestId: string;
  templateId: string;
  revisionId: string;
  confirmationUrl: string;
  requestedBy: string;
  status: TemplatePublishStatus;
  decidedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export type TemplatePublishStatus = 'pending' | 'published';

export interface TemplateListItem {
  templateId: string;
  latestRevision: TemplateRevision;
  publishedRevision: TemplateRevision | null;
}

export interface TemplateMatch {
  templateId: string;
  revision: TemplateRevision;
  sourcePageRevision: PageRevision;
}

export type TemplateErrorCode =
  | 'TEMPLATE_FORBIDDEN'
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_REVISION_NOT_FOUND'
  | 'TEMPLATE_REVISION_CONFLICT'
  | 'TEMPLATE_REVISION_NOT_LATEST'
  | 'SOURCE_REVISION_NOT_PUBLISHED'
  | 'TEMPLATE_PUBLISH_REQUEST_NOT_FOUND'
  | 'TEMPLATE_PUBLISH_REQUEST_CLOSED'
  | 'INVALID_TEMPLATE_CONFIRMATION_TOKEN'
  | 'INVALID_TEMPLATE';

export interface TemplateError {
  code: TemplateErrorCode;
  message: string;
  currentLatestRevision?: TemplateRevision | null;
}

export type TemplateRevisionResult =
  | { ok: true; revision: TemplateRevision }
  | { ok: false; error: TemplateError };

export type TemplatePublishRequestResult =
  | { ok: true; request: TemplatePublishRequest }
  | { ok: false; error: TemplateError };

export interface TemplateLibrary {
  saveRevision(
    command: SaveTemplateRevisionCommand,
    context: TemplateContext
  ): Promise<TemplateRevisionResult>;
  requestPublish(
    command: RequestTemplatePublishCommand,
    context: TemplateContext
  ): Promise<TemplatePublishRequestResult>;
  getPublishRequest(
    reference: { requestId: string },
    context: TemplateContext
  ): Promise<TemplatePublishRequestResult>;
  confirmPublish(
    command: ConfirmTemplatePublishCommand,
    context: TemplateContext
  ): Promise<TemplateRevisionResult>;
  list(context: TemplateContext): Promise<{ templates: TemplateListItem[] }>;
  search(
    query: { query: string; limit?: number },
    context: TemplateContext
  ): Promise<{ matches: TemplateMatch[] }>;
  close(): Promise<void>;
}

export interface MemoryTemplateLibraryOptions {
  pageLifecycle: PageLifecycle;
  clock?: { now(): Date };
  ids?: { next(): string };
  tokens?: { next(): string };
  urls?: { confirmation(requestId: string, token: string): string };
}

export interface PostgresTemplateLibraryOptions
  extends Omit<MemoryTemplateLibraryOptions, 'pageLifecycle'> {
  databaseUrl: string;
  pageLifecycle: PageLifecycle;
}

interface MemoryTemplate {
  revisions: TemplateRevision[];
  publishedRevisionId: string | null;
}

interface MemoryPublishRequest extends TemplatePublishRequest {
  tokenHash: string;
}

export function createMemoryTemplateLibrary(
  options: MemoryTemplateLibraryOptions
): TemplateLibrary {
  const templates = new Map<string, MemoryTemplate>();
  const requests = new Map<string, MemoryPublishRequest>();
  const idempotency = new Map<
    string,
    TemplateRevisionResult | TemplatePublishRequestResult
  >();
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
      const key = operationKey('save_revision', context, command.idempotencyKey);
      const replay = idempotency.get(key);
      if (replay) return clone(replay) as TemplateRevisionResult;
      const invalid = validateCommand(command);
      if (invalid) return invalid;

      const template = templates.get(command.templateId);
      const latest = template?.revisions.at(-1) ?? null;
      if (!template && command.baseRevisionId !== null) {
        return conflict('首次保存的 baseRevisionId 必须为 null', null);
      }
      if (template && command.baseRevisionId !== latest?.revisionId) {
        return conflict(
          `保存基线不是当前最新模板修订:${latest?.revisionId ?? '无'}`,
          latest
        );
      }

      const source = await options.pageLifecycle.getPublishedRevision(command.source);
      if (!source.ok) {
        return failure(
          'SOURCE_REVISION_NOT_PUBLISHED',
          `模板来源必须是已发布页面修订:${command.source.revisionId}`
        );
      }

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
        createdAt: clock.now().toISOString()
      };
      if (template) template.revisions.push(revision);
      else {
        templates.set(command.templateId, {
          revisions: [revision],
          publishedRevisionId: null
        });
      }
      const result: TemplateRevisionResult = {
        ok: true,
        revision: clone(revision)
      };
      idempotency.set(key, result);
      return clone(result);
    },

    async requestPublish(command, context) {
      if (!isAdmin(context)) return forbidden('申请发布页面模板需要 admin 权限');
      const key = operationKey('request_publish', context, command.idempotencyKey);
      const replay = idempotency.get(key);
      if (replay) return clone(replay) as TemplatePublishRequestResult;
      const template = templates.get(command.templateId);
      if (!template) {
        return failure('TEMPLATE_NOT_FOUND', `页面模板不存在:${command.templateId}`);
      }
      const latest = template.revisions.at(-1);
      if (latest?.revisionId !== command.revisionId) {
        return failure(
          'TEMPLATE_REVISION_NOT_LATEST',
          `只能发布当前最新模板修订:${latest?.revisionId ?? '无'}`
        );
      }
      const requestId = ids.next();
      const token = tokens.next();
      const request: MemoryPublishRequest = {
        requestId,
        templateId: command.templateId,
        revisionId: command.revisionId,
        confirmationUrl: urls.confirmation(requestId, token),
        requestedBy: context.actorId,
        status: 'pending',
        decidedBy: null,
        createdAt: clock.now().toISOString(),
        decidedAt: null,
        tokenHash: hash(token)
      };
      requests.set(requestId, request);
      const result: TemplatePublishRequestResult = {
        ok: true,
        request: publicRequest(request)
      };
      idempotency.set(key, result);
      return clone(result);
    },

    async getPublishRequest({ requestId }, context) {
      if (!isAdmin(context)) return forbidden('查看模板发布请求需要 admin 权限');
      const request = requests.get(requestId);
      return request
        ? { ok: true, request: clone(publicRequest(request)) }
        : failure(
            'TEMPLATE_PUBLISH_REQUEST_NOT_FOUND',
            `模板发布请求不存在:${requestId}`
          );
    },

    async confirmPublish(command, context) {
      if (!isAdmin(context)) return forbidden('确认发布页面模板需要 admin 权限');
      const request = requests.get(command.requestId);
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
      if (hash(command.token) !== request.tokenHash) {
        return failure(
          'INVALID_TEMPLATE_CONFIRMATION_TOKEN',
          '模板发布确认 token 无效'
        );
      }
      const template = templates.get(request.templateId);
      const latest = template?.revisions.at(-1);
      if (!template || latest?.revisionId !== request.revisionId) {
        return failure(
          'TEMPLATE_REVISION_NOT_LATEST',
          '模板发布请求不再绑定当前最新模板修订'
        );
      }
      template.publishedRevisionId = request.revisionId;
      request.status = 'published';
      request.decidedBy = context.actorId;
      request.decidedAt = clock.now().toISOString();
      return { ok: true, revision: clone(latest) };
    },

    async list(context) {
      if (!isAdmin(context)) return { templates: [] };
      return {
        templates: [...templates.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([templateId, template]) => ({
            templateId,
            latestRevision: clone(template.revisions.at(-1)!),
            publishedRevision: template.publishedRevisionId
              ? clone(
                  template.revisions.find(
                    (revision) =>
                      revision.revisionId === template.publishedRevisionId
                  ) ?? null
                )
              : null
          }))
      };
    },

    async search(query, context) {
      const needle = query.query.trim().toLocaleLowerCase();
      const subjectIds = new Set([context.actorId, ...(context.subjectIds ?? [])]);
      const limit = Math.max(1, Math.min(query.limit ?? 5, 20));
      const candidates = [...templates.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .flatMap(([templateId, template]) => {
          const revision = template.publishedRevisionId
            ? template.revisions.find(
                (candidate) =>
                  candidate.revisionId === template.publishedRevisionId
              )
            : undefined;
          if (!revision) return [];
          if (!revision.viewerSubjectIds.some((id) => subjectIds.has(id))) return [];
          const haystack = [
            templateId,
            revision.title,
            revision.description,
            ...revision.tags
          ]
            .join(' ')
            .toLocaleLowerCase();
          return !needle || haystack.includes(needle)
            ? [{ templateId, revision }]
            : [];
        })
        .slice(0, limit);

      const matches: TemplateMatch[] = [];
      for (const candidate of candidates) {
        const source = await options.pageLifecycle.getPublishedRevision(
          candidate.revision.source
        );
        if (!source.ok) continue;
        matches.push({
          templateId: candidate.templateId,
          revision: clone(candidate.revision),
          sourcePageRevision: clone(source.revision)
        });
      }
      return { matches };
    },

    async close() {}
  };
  return library;
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

export async function createPostgresTemplateLibrary(
  options: PostgresTemplateLibraryOptions
): Promise<TemplateLibrary> {
  const sql = postgres(options.databaseUrl, { max: 5, onnotice: () => {} });
  await ensureTemplateSchema(sql);
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
      const replay = await templateIdempotentResult<TemplateRevisionResult>(
        sql,
        'save_revision',
        context.clientId,
        command.idempotencyKey
      );
      if (replay) return replay;
      const invalid = validateCommand(command);
      if (invalid) return invalid;
      const source = await options.pageLifecycle.getPublishedRevision(command.source);
      if (!source.ok) {
        return failure(
          'SOURCE_REVISION_NOT_PUBLISHED',
          `模板来源必须是已发布页面修订:${command.source.revisionId}`
        );
      }

      return sql.begin(async (tx) => {
        await lockTemplate(tx, command.templateId);
        const completed = await templateIdempotentResult<TemplateRevisionResult>(
          tx,
          'save_revision',
          context.clientId,
          command.idempotencyKey
        );
        if (completed) return completed;
        const rows = (await tx`
          SELECT latest_revision_id
          FROM page_templates
          WHERE template_id = ${command.templateId}
          FOR UPDATE
        `) as unknown as Array<{ latest_revision_id: string | null }>;
        const template = rows[0];
        const latest = template?.latest_revision_id
          ? await selectTemplateRevision(tx, template.latest_revision_id)
          : null;
        if (!template && command.baseRevisionId !== null) {
          return conflict('首次保存的 baseRevisionId 必须为 null', null);
        }
        if (template && command.baseRevisionId !== latest?.revisionId) {
          return conflict(
            `保存基线不是当前最新模板修订:${latest?.revisionId ?? '无'}`,
            latest
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
          await tx`
            INSERT INTO page_templates (
              template_id,
              latest_revision_id,
              published_revision_id,
              created_by,
              created_at
            )
            VALUES (
              ${command.templateId},
              NULL,
              NULL,
              ${context.actorId},
              ${createdAt}
            )
          `;
        }
        await tx`
          INSERT INTO template_revisions (
            revision_id,
            revision_number,
            template_id,
            base_revision_id,
            title,
            description,
            tags,
            viewer_subject_ids,
            source_page_id,
            source_revision_id,
            created_by,
            created_at
          )
          VALUES (
            ${revision.revisionId},
            ${revision.revisionNumber},
            ${revision.templateId},
            ${revision.baseRevisionId},
            ${revision.title},
            ${revision.description},
            ${tx.array(revision.tags)},
            ${tx.array(revision.viewerSubjectIds)},
            ${revision.source.pageId},
            ${revision.source.revisionId},
            ${revision.createdBy},
            ${createdAt}
          )
        `;
        await tx`
          UPDATE page_templates
          SET latest_revision_id = ${revision.revisionId}
          WHERE template_id = ${revision.templateId}
        `;
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
      const replay = await templateIdempotentResult<TemplatePublishRequestResult>(
        sql,
        'request_publish',
        context.clientId,
        command.idempotencyKey
      );
      if (replay) return replay;
      return sql.begin(async (tx) => {
        await lockTemplate(tx, command.templateId);
        const completed =
          await templateIdempotentResult<TemplatePublishRequestResult>(
            tx,
            'request_publish',
            context.clientId,
            command.idempotencyKey
          );
        if (completed) return completed;
        const rows = (await tx`
          SELECT latest_revision_id
          FROM page_templates
          WHERE template_id = ${command.templateId}
          FOR UPDATE
        `) as unknown as Array<{ latest_revision_id: string | null }>;
        if (!rows[0]) {
          return failure(
            'TEMPLATE_NOT_FOUND',
            `页面模板不存在:${command.templateId}`
          );
        }
        if (rows[0].latest_revision_id !== command.revisionId) {
          return failure(
            'TEMPLATE_REVISION_NOT_LATEST',
            `只能发布当前最新模板修订:${rows[0].latest_revision_id ?? '无'}`
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
        await tx`
          INSERT INTO template_publish_requests (
            request_id,
            template_id,
            revision_id,
            confirmation_url,
            requested_by,
            status,
            token_hash,
            created_at,
            decided_by,
            decided_at
          )
          VALUES (
            ${request.requestId},
            ${request.templateId},
            ${request.revisionId},
            ${request.confirmationUrl},
            ${request.requestedBy},
            ${request.status},
            ${hash(token)},
            ${createdAt},
            NULL,
            NULL
          )
        `;
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
      const row = await selectTemplatePublishRequest(sql, requestId);
      return row
        ? { ok: true, request: toTemplatePublishRequest(row) }
        : failure(
            'TEMPLATE_PUBLISH_REQUEST_NOT_FOUND',
            `模板发布请求不存在:${requestId}`
          );
    },

    async confirmPublish(command, context) {
      if (!isAdmin(context)) return forbidden('确认发布页面模板需要 admin 权限');
      const existing = await selectTemplatePublishRequest(sql, command.requestId);
      if (!existing) {
        return failure(
          'TEMPLATE_PUBLISH_REQUEST_NOT_FOUND',
          `模板发布请求不存在:${command.requestId}`
        );
      }
      return sql.begin(async (tx) => {
        await lockTemplate(tx, existing.template_id);
        const request = await selectTemplatePublishRequest(
          tx,
          command.requestId,
          true
        );
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
          return failure(
            'INVALID_TEMPLATE_CONFIRMATION_TOKEN',
            '模板发布确认 token 无效'
          );
        }
        const templates = (await tx`
          SELECT latest_revision_id
          FROM page_templates
          WHERE template_id = ${request.template_id}
          FOR UPDATE
        `) as unknown as Array<{ latest_revision_id: string | null }>;
        if (templates[0]?.latest_revision_id !== request.revision_id) {
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
        await tx`
          UPDATE page_templates
          SET published_revision_id = ${request.revision_id}
          WHERE template_id = ${request.template_id}
        `;
        await tx`
          UPDATE template_publish_requests
          SET
            status = 'published',
            decided_by = ${context.actorId},
            decided_at = ${decidedAt}
          WHERE request_id = ${request.request_id}
        `;
        return { ok: true, revision };
      });
    },

    async list(context) {
      if (!isAdmin(context)) return { templates: [] };
      const rows = (await sql`
        SELECT
          template.template_id,
          latest.revision_id AS latest_revision_id,
          published.revision_id AS published_revision_id
        FROM page_templates AS template
        JOIN template_revisions AS latest
          ON latest.revision_id = template.latest_revision_id
        LEFT JOIN template_revisions AS published
          ON published.revision_id = template.published_revision_id
        ORDER BY template.template_id
      `) as unknown as Array<{
        template_id: string;
        latest_revision_id: string;
        published_revision_id: string | null;
      }>;
      const templates: TemplateListItem[] = [];
      for (const row of rows) {
        const latest = await selectTemplateRevision(sql, row.latest_revision_id);
        const published = row.published_revision_id
          ? await selectTemplateRevision(sql, row.published_revision_id)
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
      const rows = (await sql`
        SELECT revision.*
        FROM page_templates AS template
        JOIN template_revisions AS revision
          ON revision.revision_id = template.published_revision_id
        ORDER BY template.template_id
      `) as unknown as TemplateRevisionRow[];
      const needle = query.query.trim().toLocaleLowerCase();
      const subjectIds = new Set([context.actorId, ...(context.subjectIds ?? [])]);
      const limit = Math.max(1, Math.min(query.limit ?? 5, 20));
      const revisions = rows
        .map(toTemplateRevision)
        .filter((revision) =>
          revision.viewerSubjectIds.some((id) => subjectIds.has(id))
        )
        .filter((revision) =>
          [
            revision.templateId,
            revision.title,
            revision.description,
            ...revision.tags
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(needle)
        )
        .slice(0, limit);
      const matches: TemplateMatch[] = [];
      for (const revision of revisions) {
        const source = await options.pageLifecycle.getPublishedRevision(
          revision.source
        );
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
      await sql.end();
    }
  };
  return library;
}

async function ensureTemplateSchema(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS page_templates (
      template_id text PRIMARY KEY,
      latest_revision_id uuid,
      published_revision_id uuid,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS template_revisions (
      revision_id uuid PRIMARY KEY,
      revision_number integer NOT NULL,
      template_id text NOT NULL REFERENCES page_templates(template_id),
      base_revision_id uuid,
      title text NOT NULL,
      description text NOT NULL,
      tags text[] NOT NULL,
      viewer_subject_ids text[] NOT NULL,
      source_page_id text NOT NULL,
      source_revision_id uuid NOT NULL,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL,
      UNIQUE (template_id, revision_number)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS template_publish_requests (
      request_id uuid PRIMARY KEY,
      template_id text NOT NULL REFERENCES page_templates(template_id),
      revision_id uuid NOT NULL REFERENCES template_revisions(revision_id),
      confirmation_url text NOT NULL,
      requested_by text NOT NULL,
      status text NOT NULL,
      token_hash text NOT NULL,
      created_at timestamptz NOT NULL,
      decided_by text,
      decided_at timestamptz
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS template_idempotency (
      operation text NOT NULL,
      client_id text NOT NULL,
      idempotency_key text NOT NULL,
      result jsonb NOT NULL,
      created_at timestamptz NOT NULL,
      PRIMARY KEY (operation, client_id, idempotency_key)
    )
  `;
}

async function lockTemplate(
  sql: TransactionSql,
  templateId: string
): Promise<void> {
  await sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`page_template:${templateId}`}, 0)
    )
  `;
}

async function selectTemplateRevision(
  sql: Sql | TransactionSql,
  revisionId: string
): Promise<TemplateRevision | null> {
  const rows = (await sql`
    SELECT *
    FROM template_revisions
    WHERE revision_id = ${revisionId}
  `) as unknown as TemplateRevisionRow[];
  return rows[0] ? toTemplateRevision(rows[0]) : null;
}

async function selectTemplatePublishRequest(
  sql: Sql | TransactionSql,
  requestId: string,
  forUpdate = false
): Promise<TemplatePublishRequestRow | null> {
  const rows = forUpdate
    ? ((await sql`
        SELECT *
        FROM template_publish_requests
        WHERE request_id = ${requestId}
        FOR UPDATE
      `) as unknown as TemplatePublishRequestRow[])
    : ((await sql`
        SELECT *
        FROM template_publish_requests
        WHERE request_id = ${requestId}
      `) as unknown as TemplatePublishRequestRow[]);
  return rows[0] ?? null;
}

function toTemplateRevision(row: TemplateRevisionRow): TemplateRevision {
  return {
    revisionId: row.revision_id,
    revisionNumber: row.revision_number,
    templateId: row.template_id,
    baseRevisionId: row.base_revision_id,
    title: row.title,
    description: row.description,
    tags: row.tags,
    viewerSubjectIds: row.viewer_subject_ids,
    source: {
      pageId: row.source_page_id,
      revisionId: row.source_revision_id
    },
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString()
  };
}

function toTemplatePublishRequest(
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
    createdAt: new Date(row.created_at).toISOString(),
    decidedAt: row.decided_at ? new Date(row.decided_at).toISOString() : null
  };
}

async function templateIdempotentResult<T>(
  sql: Sql | TransactionSql,
  operation: string,
  clientId: string,
  idempotencyKey: string
): Promise<T | null> {
  const rows = (await sql`
    SELECT result
    FROM template_idempotency
    WHERE operation = ${operation}
      AND client_id = ${clientId}
      AND idempotency_key = ${idempotencyKey}
  `) as unknown as Array<{ result: T }>;
  return rows[0]?.result ?? null;
}

async function storeTemplateIdempotentResult(
  sql: TransactionSql,
  operation: string,
  clientId: string,
  idempotencyKey: string,
  result: TemplateRevisionResult | TemplatePublishRequestResult,
  createdAt: Date
): Promise<void> {
  await sql`
    INSERT INTO template_idempotency (
      operation,
      client_id,
      idempotency_key,
      result,
      created_at
    )
    VALUES (
      ${operation},
      ${clientId},
      ${idempotencyKey},
      ${sql.json(result as unknown as JSONValue)},
      ${createdAt}
    )
  `;
}

function validateCommand(
  command: SaveTemplateRevisionCommand
): TemplateRevisionResult | null {
  if (!command.templateId.trim() || !command.title.trim()) {
    return failure('INVALID_TEMPLATE', 'templateId 和标题不能为空');
  }
  if (normalizeStrings(command.viewerSubjectIds).length === 0) {
    return failure('INVALID_TEMPLATE', '页面模板至少需要一个可使用主体');
  }
  return null;
}

function normalizeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isAdmin(context: TemplateContext): boolean {
  return context.roles?.includes('admin') === true;
}

function operationKey(
  operation: string,
  context: TemplateContext,
  idempotencyKey: string
): string {
  return `${operation}:${context.clientId}:${idempotencyKey}`;
}

function publicRequest(request: MemoryPublishRequest): TemplatePublishRequest {
  const { tokenHash: _tokenHash, ...result } = request;
  return result;
}

function conflict(
  message: string,
  currentLatestRevision: TemplateRevision | null
): TemplateRevisionResult {
  return {
    ok: false,
    error: {
      code: 'TEMPLATE_REVISION_CONFLICT',
      message,
      currentLatestRevision: clone(currentLatestRevision)
    }
  };
}

function forbidden(
  message: string
): { ok: false; error: TemplateError } {
  return failure('TEMPLATE_FORBIDDEN', message);
}

function failure(
  code: TemplateErrorCode,
  message: string
): { ok: false; error: TemplateError } {
  return { ok: false, error: { code, message } };
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
