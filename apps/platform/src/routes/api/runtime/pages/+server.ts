import { json } from '@sveltejs/kit';
import type { Page } from '@metriccanvas/page';
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
      .filter((page) => page.catalogVisibility === 'visible' && page.publishedRevision)
      .map(async ({ pageId }) => {
        const result = await lifecycle.getPublished({ pageId });
        return result.ok ? pageMetadata(result.revision.document) : null;
      })
  );
  return json(
    { pages: published.filter((page) => page !== null) },
    { headers: PUBLIC_HEADERS }
  );
};

function pageMetadata(document: Page): {
  id: string;
  title: string;
  description?: string;
} {
  let title = document.id;
  for (const section of document.sections) {
    const header = section.components.find((component) => component.type === 'reportHeader');
    if (header?.type === 'reportHeader') {
      title = header.props.title;
      break;
    }
  }
  return {
    id: document.id,
    title,
    ...(document.meta?.description ? { description: document.meta.description } : {})
  };
}
