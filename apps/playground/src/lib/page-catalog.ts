import catalog from '../../page-catalog.json';
import type { PlaygroundPageEntry } from './page-catalog-entry';

export const catalogCapabilities = catalog.capabilities;
export const catalogRuntimes = [
  { id: 'none', title: '无需额外服务', startup: 'pnpm dev:playground' },
  { id: 'sim', title: '本地 DQE Sim', startup: '已有试验场时运行 pnpm sim:dqe；一起启动用 pnpm dev:dqe' },
  { id: 'service', title: '对应业务服务', startup: '启动试验场，并在集成环境接入匹配的数据网关、数据集与权限' },
  { id: 'platform', title: 'Platform 页面搭建', startup: 'pnpm dev:platform；在页面搭建工作台加载此页面资产' }
] as const;

export function pageCatalogGuide(id: string) {
  return catalog.pages.find((entry) => entry.id === id);
}

export function runtimeInfo(id: string) {
  return catalogRuntimes.find((entry) => entry.id === id);
}

type CatalogDefinition = typeof catalog.pages[number];
interface CatalogPage extends PlaygroundPageEntry {
  scenario?: string;
  displayTitle: string;
  summary: string;
  tags: string[];
  capabilities: string[];
  environment: CatalogDefinition['environment'] | null;
  guide: CatalogDefinition['guide'] | null;
}

function describePage(page: PlaygroundPageEntry, entry?: CatalogDefinition): CatalogPage {
  return {
    ...page,
    scenario: entry?.scenario,
    displayTitle: entry?.displayTitle ?? page.title,
    summary: entry?.summary ?? page.description ?? '打开预览查看页面内容。',
    tags: entry?.tags ?? [],
    capabilities: entry?.capabilities ?? [],
    environment: entry?.environment ?? null,
    guide: entry?.guide ?? null
  };
}

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
      return [describePage(page, entry)];
    })
  }));
  const remaining = pages.filter((page) => !assigned.has(page.id));
  if (remaining.length) {
    groups.push({
      id: 'unclassified', category: 'unclassified', title: '待归类',
      description: '新加入的页面会自动出现在这里。',
      pages: remaining.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')).map((page) => describePage(page))
    });
  }
  return groups.filter((group) => group.pages.length > 0);
}

export function filterPageCatalog(
  groups: ReturnType<typeof organizePageCatalog>, query: string, category = 'all', layoutForm = 'all',
  capability = 'all', runtime = 'all'
) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return groups.filter((group) => category === 'all' || group.category === category).map((group) => ({
    ...group,
    pages: group.pages.filter((page) => {
      if (layoutForm !== 'all' && page.layoutForm !== layoutForm) return false;
      if (capability !== 'all' && !page.capabilities.includes(capability)) return false;
      if (runtime !== 'all' && page.environment?.runtime !== runtime) return false;
      const layoutTitle = catalogLayouts.find((layout) => layout.id === page.layoutForm)?.title;
      const capabilities = catalogCapabilities.filter((item) => page.capabilities.includes(item.id));
      const text = [page.id, page.title, page.displayTitle, page.description, page.summary, ...page.tags,
        group.title, layoutTitle, ...capabilities.flatMap((item) => [item.title, item.question]),
        page.environment?.data, page.environment?.scope, runtimeInfo(page.environment?.runtime ?? '')?.title]
        .join(' ').toLocaleLowerCase();
      return words.every((word) => text.includes(word));
    })
  })).filter((group) => group.pages.length > 0);
}

/** Optional development-only inputs are configured outside Page metadata. */
export function pageExternalInputs(id: string | undefined): 'visibility' | 'ioc-header' | 'selection' | undefined {
  const input = catalog.pages.find(entry => entry.id === id)?.externalInputs;
  return input === 'visibility' || input === 'ioc-header' || input === 'selection' ? input : undefined;
}
