import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import { withClient } from '$lib/server/identity.server';
import { lifecycleErrorStatus } from '$lib/server/lifecycle-http';
import type { LifecycleErrorCode } from '@metriccanvas/page-lifecycle';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { lifecycle } = await getPlatformServices();
  const result = await lifecycle.listRevisionHistory({ pageId: params.pageId });
  if (!result.ok) {
    return json(
      { error: result.error },
      { status: lifecycleErrorStatus(result.error.code, 404), headers: { 'cache-control': 'no-store' } }
    );
  }

  return json(result.history, { headers: { 'cache-control': 'no-store' } });
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return commandError('请求体不是合法 JSON');
  }
  if (!isSaveCommand(body)) {
    return commandError('baseRevisionId、document 和 idempotencyKey 不能为空');
  }

  const { lifecycle, runtimeOrigin } = await getPlatformServices();
  const result = await lifecycle.saveRevision(
    {
      pageId: params.pageId,
      baseRevisionId: body.baseRevisionId,
      document: body.document,
      idempotencyKey: body.idempotencyKey,
      pageIdConfirmed: body.pageIdConfirmed === true
    },
    withClient(locals.identity, 'page-editor')
  );
  return json({ ...result, runtimeOrigin }, {
    status: result.ok ? 201 : saveFailureStatus(result.error.code),
    headers: { 'cache-control': 'no-store' }
  });
};

function isSaveCommand(value: unknown): value is {
  baseRevisionId: string | null;
  document: Record<string, unknown>;
  idempotencyKey: string;
  pageIdConfirmed?: boolean;
} {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    (body.baseRevisionId === null ||
      (typeof body.baseRevisionId === 'string' && body.baseRevisionId.length > 0)) &&
    typeof body.document === 'object' &&
    body.document !== null &&
    !Array.isArray(body.document) &&
    typeof body.idempotencyKey === 'string' &&
    body.idempotencyKey.length > 0 &&
    body.idempotencyKey.length <= 200 &&
    (body.pageIdConfirmed === undefined || typeof body.pageIdConfirmed === 'boolean')
  );
}

function commandError(message: string) {
  return json(
    { error: { code: 'INVALID_SAVE_COMMAND', message } },
    { status: 400, headers: { 'cache-control': 'no-store' } }
  );
}

function saveFailureStatus(code: LifecycleErrorCode): number {
  if (code === 'PAGE_NOT_FOUND') return 404;
  if (code === 'NOT_SUPPORTED') return 501;
  if (
    code === 'INVALID_PAGE' ||
    code === 'PAGE_ID_MISMATCH'
  ) {
    return 422;
  }
  return 409;
}
