import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { lifecycle } = await getPlatformServices();
  const result = await lifecycle.getPublishRequest(
    { requestId: params.requestId },
    { actorId: 'developer-1', clientId: 'workbench' }
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

  return json(
    { request: result.request },
    { headers: { 'cache-control': 'no-store' } }
  );
};
