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
} from './invariants';
import type {
  TemplateContext,
  TemplateLibrary,
  TemplateMatch,
  TemplatePublishRequest,
  TemplatePublishRequestResult,
  TemplateRevision,
  TemplateRevisionResult
} from './contracts';

export interface MemoryTemplateLibraryOptions {
  pageLifecycle: PageLifecycle;
  clock?: { now(): Date };
  ids?: { next(): string };
  tokens?: { next(): string };
  urls?: { confirmation(requestId: string, token: string): string };
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
