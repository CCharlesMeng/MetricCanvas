import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const fromRevisionId = url.searchParams.get('fromRevisionId');
  const toRevisionId = url.searchParams.get('toRevisionId');
  if (!fromRevisionId || !toRevisionId) {
    return json(
      {
        error: {
          code: 'INVALID_DIFF_REFERENCE',
          message: 'fromRevisionId 和 toRevisionId 为必填项'
        }
      },
      { status: 400, headers: { 'cache-control': 'no-store' } }
    );
  }

  const { lifecycle } = await getPlatformServices();
  const result = await lifecycle.diffRevisions({
    pageId: params.pageId,
    fromRevisionId,
    toRevisionId
  });
  if (!result.ok) {
    return json(
      { error: result.error },
      { status: 404, headers: { 'cache-control': 'no-store' } }
    );
  }

  return json({ diff: result.diff }, { headers: { 'cache-control': 'no-store' } });
};
