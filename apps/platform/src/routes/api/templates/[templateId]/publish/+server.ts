import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const body = (await request.json().catch(() => null)) as {
    revisionId?: unknown;
    idempotencyKey?: unknown;
  } | null;
  if (
    typeof body?.revisionId !== 'string' ||
    !body.revisionId ||
    typeof body.idempotencyKey !== 'string' ||
    !body.idempotencyKey
  ) {
    return json(
      {
        error: {
          code: 'INVALID_TEMPLATE_PUBLISH_COMMAND',
          message: 'revisionId 和 idempotencyKey 不能为空'
        }
      },
      { status: 400 }
    );
  }
  const { templates } = await getPlatformServices();
  const result = await templates.requestPublish(
    {
      templateId: params.templateId,
      revisionId: body.revisionId,
      idempotencyKey: body.idempotencyKey
    },
    {
      actorId: 'developer-1',
      clientId: 'management-console',
      roles: ['admin']
    }
  );
  return json(result, {
    status: result.ok
      ? 200
      : result.error.code === 'TEMPLATE_FORBIDDEN'
        ? 403
        : 409,
    headers: { 'cache-control': 'no-store' }
  });
};
