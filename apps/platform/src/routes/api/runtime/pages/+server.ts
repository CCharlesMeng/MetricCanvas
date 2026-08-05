import { json } from '@sveltejs/kit';
import { pageListEntry } from '@metriccanvas/page';
import { getPlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

const PUBLIC_HEADERS = {
  'access-control-allow-origin': '*',
  'cache-control': 'no-store'
};

export const GET: RequestHandler = async () => {
  const { lifecycle } = await getPlatformServices();
  const listed = await lifecycle.listPages({ limit: 100 });
  const published = await Promise.all(
    listed.pages
      .filter((page) => page.visibility === 'visible' && page.publishedRevision)
      .map(async ({ pageId }) => {
        const result = await lifecycle.getPublished({ pageId });
        return result.ok ? pageListEntry(result.revision.document) : null;
      })
  );
  return json(
    { pages: published.filter((page) => page !== null) },
    { headers: PUBLIC_HEADERS }
  );
};
