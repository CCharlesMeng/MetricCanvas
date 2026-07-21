import type { PageRepository } from '@metriccanvas/runtime';

export function createPlatformPageRepository(baseUrl: string): PageRepository {
  const origin = baseUrl.replace(/\/+$/, '');

  return {
    async load(pageId) {
      const revisionId = new URLSearchParams(location.search).get('revision');
      const path = revisionId
        ? `/api/runtime/pages/${encodeURIComponent(pageId)}/revisions/${encodeURIComponent(revisionId)}`
        : `/api/runtime/pages/${encodeURIComponent(pageId)}`;
      const response = await fetch(`${origin}${path}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `页面加载失败:HTTP ${response.status}`);
      }
      return response.json();
    },

    async list() {
      return [];
    }
  };
}
