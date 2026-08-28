import { json } from '@sveltejs/kit';
import { readRuntimeRevision } from '$lib/server/runtime-revision.server';
import { getRuntimePlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const services = await getRuntimePlatformServices();
  const reference = {
    pageId: params.pageId,
    revisionId: params.revisionId
  };
  const result = await readRuntimeRevision(services, reference);
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
    'cache-control': 'no-store'
  };
}
