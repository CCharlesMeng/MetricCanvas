import { json } from '@sveltejs/kit';
import { getRuntimePlatformServices } from '$lib/server/services.server';
import { lifecycleErrorStatus } from '$lib/server/lifecycle-http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { lifecycle } = await getRuntimePlatformServices();
  const result = await lifecycle.getPublished({ pageId: params.pageId });
  if (!result.ok) {
    return json(
      { error: result.error },
      {
        status: lifecycleErrorStatus(
          result.error.code,
          result.error.code === 'PAGE_NOT_FOUND' ? 404 : 409
        ),
        headers: runtimeHeaders()
      }
    );
  }
  return json(result.revision.document, { headers: runtimeHeaders() });
};

function runtimeHeaders(): Record<string, string> {
  return {
    'cache-control': 'no-cache'
  };
}
