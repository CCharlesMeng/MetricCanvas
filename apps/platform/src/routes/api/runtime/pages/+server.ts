import { json } from '@sveltejs/kit';
import { pageListEntry } from '@metriccanvas/page';
import { getRuntimePlatformServices } from '$lib/server/services.server';
import type { RequestHandler } from './$types';

/**
 * @deprecated 已发布页面目录(ADR-0062):`apps/canvas` 改为只读静态 `pages/`,不再从这里取目录;
 * Java 页面资产首批没有"已发布"概念,在 `METRICCANVAS_PAGE_ASSETS=java` 下本端点恒为空列表。
 * 保留只为既有 reader 部署平滑过渡,响应带 `Deprecation` 头;新消费者不要接。
 */
const PUBLIC_HEADERS = {
  'cache-control': 'no-store',
  deprecation: 'true',
  link: '</manage>; rel="successor-version"'
};

export const GET: RequestHandler = async () => {
  const { lifecycle } = await getRuntimePlatformServices();
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
