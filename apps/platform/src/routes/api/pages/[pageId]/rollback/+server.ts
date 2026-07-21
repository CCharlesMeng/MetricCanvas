import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const body = (await request.json()) as {
    targetRevisionId?: unknown;
    idempotencyKey?: unknown;
  };
  if (
    typeof body.targetRevisionId !== 'string' ||
    !body.targetRevisionId ||
    typeof body.idempotencyKey !== 'string' ||
    !body.idempotencyKey
  ) {
    return json(
      {
        error: {
          code: 'INVALID_ROLLBACK_COMMAND',
          message: 'targetRevisionId 和 idempotencyKey 不能为空'
        }
      },
      { status: 400 }
    );
  }
  const { lifecycle } = await getPlatformServices();
  const result = await lifecycle.rollbackRevision(
    {
      pageId: params.pageId,
      targetRevisionId: body.targetRevisionId,
      idempotencyKey: body.idempotencyKey
    },
    { actorId: 'developer-1', clientId: 'management-console', roles: [] }
  );
  return json(result, {
    status: result.ok ? 200 : result.error.code === 'REVISION_CONFLICT' ? 409 : 400,
    headers: { 'cache-control': 'no-store' }
  });
};
