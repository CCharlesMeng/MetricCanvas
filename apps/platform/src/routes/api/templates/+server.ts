import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

const managementContext = {
  actorId: 'developer-1',
  clientId: 'management-console',
  roles: ['admin'] as const
};

export const GET: RequestHandler = async () => {
  const { templates } = await getPlatformServices();
  return json(await templates.list(managementContext), {
    headers: { 'cache-control': 'no-store' }
  });
};

export const POST: RequestHandler = async ({ request }) => {
  const body: unknown = await request.json().catch(() => null);
  if (!isTemplateCommand(body)) {
    return json(
      {
        error: {
          code: 'INVALID_TEMPLATE_COMMAND',
          message:
            'templateId、标题、模板 ACL、来源页面修订和幂等键不能为空'
        }
      },
      { status: 400 }
    );
  }
  const { templates } = await getPlatformServices();
  const result = await templates.saveRevision(body, managementContext);
  return json(result, {
    status: result.ok
      ? 200
      : result.error.code === 'TEMPLATE_FORBIDDEN'
        ? 403
        : result.error.code === 'TEMPLATE_REVISION_CONFLICT'
          ? 409
          : 400,
    headers: { 'cache-control': 'no-store' }
  });
};

function isTemplateCommand(value: unknown): value is {
  templateId: string;
  baseRevisionId: string | null;
  title: string;
  description?: string;
  tags?: string[];
  viewerSubjectIds: string[];
  source: { pageId: string; revisionId: string };
  idempotencyKey: string;
} {
  if (!isRecord(value) || !isRecord(value.source)) return false;
  return (
    nonEmpty(value.templateId) &&
    (value.baseRevisionId === null || nonEmpty(value.baseRevisionId)) &&
    nonEmpty(value.title) &&
    (value.description === undefined || typeof value.description === 'string') &&
    stringArray(value.tags, true) &&
    stringArray(value.viewerSubjectIds, false) &&
    nonEmpty(value.source.pageId) &&
    nonEmpty(value.source.revisionId) &&
    nonEmpty(value.idempotencyKey)
  );
}

function stringArray(value: unknown, optional: boolean): value is string[] | undefined {
  return (
    (optional && value === undefined) ||
    (Array.isArray(value) && value.every(nonEmpty) && (optional || value.length > 0))
  );
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
