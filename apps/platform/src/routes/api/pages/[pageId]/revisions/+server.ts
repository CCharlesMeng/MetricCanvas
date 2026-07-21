import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { lifecycle } = await getPlatformServices();
  const result = await lifecycle.listRevisionHistory({ pageId: params.pageId });
  if (!result.ok) {
    return json(
      { error: result.error },
      { status: 404, headers: { 'cache-control': 'no-store' } }
    );
  }

  return json(result.history, { headers: { 'cache-control': 'no-store' } });
};

export const POST: RequestHandler = async ({ params, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return commandError('请求体不是合法 JSON');
  }
  if (!isSaveCommand(body)) {
    return commandError('baseRevisionId、document 和 idempotencyKey 不能为空');
  }

  const { lifecycle } = await getPlatformServices();
  const result = await lifecycle.saveRevision(
    {
      pageId: params.pageId,
      baseRevisionId: body.baseRevisionId,
      document: body.document,
      idempotencyKey: body.idempotencyKey
    },
    { actorId: 'developer-1', clientId: 'page-editor' }
  );
  return json(result, {
    status: result.ok ? 201 : saveFailureStatus(result.error.code),
    headers: { 'cache-control': 'no-store' }
  });
};

function isSaveCommand(value: unknown): value is {
  baseRevisionId: string;
  document: Record<string, unknown>;
  idempotencyKey: string;
} {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.baseRevisionId === 'string' &&
    body.baseRevisionId.length > 0 &&
    typeof body.document === 'object' &&
    body.document !== null &&
    !Array.isArray(body.document) &&
    typeof body.idempotencyKey === 'string' &&
    body.idempotencyKey.length > 0 &&
    body.idempotencyKey.length <= 200
  );
}

function commandError(message: string) {
  return json(
    { error: { code: 'INVALID_SAVE_COMMAND', message } },
    { status: 400, headers: { 'cache-control': 'no-store' } }
  );
}

function saveFailureStatus(code: string): number {
  if (code === 'PAGE_NOT_FOUND') return 404;
  if (
    code === 'INVALID_PAGE' ||
    code === 'METRIC_GAP' ||
    code === 'PAGE_ID_MISMATCH'
  ) {
    return 422;
  }
  return 409;
}
