import { json } from '@sveltejs/kit';
import { getPlatformServices } from '$lib/server/services.server';
import type { PageRevisionSelector } from '@metriccanvas/page-lifecycle';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const selector = pageSelector(url);
  if (!selector) {
    return json(
      { error: { code: 'INVALID_REVISION_SELECTOR', message: 'revisionId 不能为空' } },
      { status: 400, headers: { 'cache-control': 'no-store' } }
    );
  }

  const { lifecycle, runtimeOrigin } = await getPlatformServices();
  const result = await lifecycle.getPage({ pageId: params.pageId, selector });
  if (!result.ok) {
    return json(
      { error: result.error },
      {
        status: result.error.code === 'PAGE_NOT_FOUND' ? 404 : 409,
        headers: { 'cache-control': 'no-store' }
      }
    );
  }

  return json(
    { revision: result.revision, runtimeOrigin },
    { headers: { 'cache-control': 'no-store' } }
  );
};

function pageSelector(url: URL): PageRevisionSelector | null {
  const revisionId = url.searchParams.get('revisionId');
  if (revisionId !== null) return revisionId ? { type: 'exact', revisionId } : null;
  return url.searchParams.get('selector') === 'published' ? { type: 'published' } : { type: 'latest' };
}
