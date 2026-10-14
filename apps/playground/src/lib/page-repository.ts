import type { PageRepository } from '@metriccanvas/engine';
import { normalizePageDocument } from '@metriccanvas/page';
import { catalogPageEntry, type PlaygroundPageEntry } from './page-catalog-entry';

/**
 * PageRepository 静态文件实现(一期,ADR-0004):页面文档来自仓库根 pages/ 目录($pages 别名)。
 * 开发工具只消费仓库页面。pages/ 在 Vite root 之外，dev 下的监听由
 * vite.config.ts 的 watch-page-assets 插件补齐，修改页面即热刷新。
 */
const modules = import.meta.glob<{ default: unknown }>('$pages/*.json');

interface StaticPageRepository extends PageRepository {
  list(): Promise<PlaygroundPageEntry[]>;
}

export function createStaticPageRepository(): StaticPageRepository {
  const loaders = new Map<string, () => Promise<{ default: unknown }>>();
  for (const [path, loader] of Object.entries(modules)) {
    const id = path.split('/').pop()!.replace(/\.json$/, '');
    loaders.set(id, loader);
  }

  return {
    async load(pageId: string): Promise<unknown> {
      const loader = loaders.get(pageId);
      if (!loader) throw new Error(`页面不存在:${pageId}`);
      const raw = (await loader()).default;
      const normalized = normalizePageDocument(raw);
      // 无效页面保留原文给统一运行时呈现准确错误。
      return normalized.ok ? normalized.document : raw;
    },

    async list() {
      const entries: PlaygroundPageEntry[] = [];
      for (const [id, loader] of loaders) {
        entries.push(catalogPageEntry((await loader()).default, id));
      }
      return entries;
    }
  };
}
