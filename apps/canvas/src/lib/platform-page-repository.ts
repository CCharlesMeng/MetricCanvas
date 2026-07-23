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
      const response = await fetch(`${origin}/api/runtime/pages`);
      if (!response.ok) {
        throw new Error(`页面目录加载失败:HTTP ${response.status}`);
      }
      const body = (await response.json()) as { pages?: unknown };
      return Array.isArray(body.pages)
        ? body.pages.filter(isPageMetadata)
        : [];
    }
  };
}

function isPageMetadata(value: unknown): value is {
  id: string;
  title: string;
  description?: string;
} {
  if (typeof value !== 'object' || value === null) return false;
  const page = value as Record<string, unknown>;
  return (
    typeof page.id === 'string' &&
    typeof page.title === 'string' &&
    (page.description === undefined || typeof page.description === 'string')
  );
}
