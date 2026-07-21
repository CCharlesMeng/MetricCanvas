import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { lifecycle } = await getPlatformServices();
  const context = {
    actorId: 'developer-1',
    clientId: 'workbench',
    roles: ['publisher'] as const
  };
  const result = await lifecycle.getPublishRequest(
    { requestId: params.requestId },
    context
  );

  if (!result.ok) {
    const status =
      result.error.code === 'PUBLISH_REQUEST_NOT_FOUND'
        ? 404
        : result.error.code === 'PUBLISH_FORBIDDEN'
          ? 403
          : 409;
    return json(
      { error: result.error },
      { status, headers: { 'cache-control': 'no-store' } }
    );
  }

  const audit = await lifecycle.listPublishAudit({ requestId: params.requestId }, context);
  return json(
    { request: result.request, audit: audit.ok ? audit.events : [] },
    { headers: { 'cache-control': 'no-store' } }
  );
};

export const POST: RequestHandler = async ({ params, request }) => {
  const body = (await request.json()) as { action?: unknown; reason?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const { lifecycle } = await getPlatformServices();
  const result =
    body.action === 'cancel'
      ? await lifecycle.cancelPublish(
          { requestId: params.requestId, ...(reason ? { reason } : {}) },
          { actorId: 'developer-1', clientId: 'workbench', roles: ['publisher'] }
        )
      : body.action === 'force_release'
        ? await lifecycle.forceReleasePublish(
            { requestId: params.requestId, reason: reason || '管理员强制释放' },
            { actorId: 'developer-1', clientId: 'management-console', roles: ['admin'] }
          )
        : null;
  if (!result) {
    return json(
      { error: { code: 'INVALID_PUBLISH_ACTION', message: '仅支持 cancel 或 force_release' } },
      { status: 400 }
    );
  }
  return json(result, {
    status: result.ok ? 200 : result.error.code === 'PUBLISH_FORBIDDEN' ? 403 : 409,
    headers: { 'cache-control': 'no-store' }
  });
};
