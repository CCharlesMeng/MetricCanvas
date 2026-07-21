import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { lifecycle } = await getPlatformServices();
  const result = await lifecycle.listRevisionHistory({ pageId: params.pageId });
  if (!result.ok) {
    return json(
      { error: result.error },
      { status: 404, headers: { 'cache-control': 'no-store' } }
    );
  }

  return json(result.history, { headers: { 'cache-control': 'no-store' } });
};
