import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { lifecycle } = await getPlatformServices();
  const result = await lifecycle.getPublished({ pageId: params.pageId });
  if (!result.ok) {
    return json(
      { error: result.error },
      {
        status: result.error.code === 'PAGE_NOT_FOUND' ? 404 : 409,
        headers: runtimeHeaders()
      }
    );
  }
  return json(result.revision.document, { headers: runtimeHeaders() });
};

function runtimeHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'cache-control': 'no-cache'
  };
}
