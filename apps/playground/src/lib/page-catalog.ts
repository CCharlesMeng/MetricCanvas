import catalog from '../../page-catalog.json';
import type { PlaygroundPageEntry } from './page-catalog-entry';

export const catalogLayouts = [
  { id: 'dashboard', title: 'Dashboard · 看板' },
  { id: 'report', title: 'Report · 报表' }
] as const;

export const catalogCategories = [
  { id: 'business', title: '业务示例' },
  { id: 'features', title: '功能演示' },
  { id: 'verification', title: '验收样例' },
  { id: 'unclassified', title: '待归类' }
] as const;

export function organizePageCatalog(pages: PlaygroundPageEntry[]) {
  const entries = new Map(pages.map((page) => [page.id, page]));
  const assigned = new Set<string>();
  const groups = catalog.groups.map((group) => ({
    ...group,
    pages: catalog.pages.filter((entry) => entry.group === group.id).flatMap((entry) => {
      const page = entries.get(entry.id);
      if (!page) return [];
      assigned.add(page.id);
      return [{ ...page, summary: entry.summary, tags: entry.tags }];
    })
  }));
  const remaining = pages.filter((page) => !assigned.has(page.id));
  if (remaining.length) {
    groups.push({
      id: 'unclassified', category: 'unclassified', title: '待归类',
      description: '新加入的页面会自动出现在这里。',
      pages: remaining.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')).map((page) => ({
        ...page, summary: page.description ?? '打开预览查看页面内容。', tags: []
      }))
    });
  }
  return groups.filter((group) => group.pages.length > 0);
}

export function filterPageCatalog(
  groups: ReturnType<typeof organizePageCatalog>, query: string, category = 'all', layoutForm = 'all'
) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return groups.filter((group) => category === 'all' || group.category === category).map((group) => ({
    ...group,
    pages: group.pages.filter((page) => {
      if (layoutForm !== 'all' && page.layoutForm !== layoutForm) return false;
      const layoutTitle = catalogLayouts.find((layout) => layout.id === page.layoutForm)?.title;
      const text = [page.id, page.title, page.description, page.summary, ...page.tags, group.title, layoutTitle]
        .join(' ').toLocaleLowerCase();
      return words.every((word) => text.includes(word));
    })
  })).filter((group) => group.pages.length > 0);
}

/** Optional development-only inputs are configured outside Page metadata. */
export function pageExternalInputs(id: string | undefined): 'visibility' | undefined {
  return catalog.pages.find(entry => entry.id === id)?.externalInputs === 'visibility' ? 'visibility' : undefined;
}
