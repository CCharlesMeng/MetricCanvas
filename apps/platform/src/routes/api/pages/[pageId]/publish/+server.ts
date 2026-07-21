import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const body = (await request.json()) as {
    revisionId?: unknown;
    idempotencyKey?: unknown;
  };
  if (
    typeof body.revisionId !== 'string' ||
    !body.revisionId ||
    typeof body.idempotencyKey !== 'string' ||
    !body.idempotencyKey
  ) {
    return json(
      {
        error: {
          code: 'INVALID_PUBLISH_COMMAND',
          message: 'revisionId 和 idempotencyKey 不能为空'
        }
      },
      { status: 400 }
    );
  }

  const { lifecycle } = await getPlatformServices();
  const result = await lifecycle.requestPublish(
    {
      pageId: params.pageId,
      revisionId: body.revisionId,
      idempotencyKey: body.idempotencyKey
    },
    { actorId: 'developer-1', clientId: 'management-console', roles: ['publisher'] }
  );
  return json(result, {
    status: result.ok ? 200 : result.error.code === 'PAGE_NOT_FOUND' ? 404 : 409,
    headers: { 'cache-control': 'no-store' }
  });
};
