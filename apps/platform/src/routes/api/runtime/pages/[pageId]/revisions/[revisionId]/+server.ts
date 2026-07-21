import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { lifecycle } = await getPlatformServices();
  const result = await lifecycle.getRevision({
    pageId: params.pageId,
    revisionId: params.revisionId
  });
  if (!result.ok) {
    return json(
      { error: result.error },
      { status: 404, headers: runtimeHeaders() }
    );
  }
  return json(result.revision.document, { headers: runtimeHeaders() });
};

function runtimeHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'cache-control': 'no-store'
  };
}
