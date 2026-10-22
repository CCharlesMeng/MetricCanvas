import type { PageRepository } from '@metriccanvas/engine';
import { normalizePageDocument } from '@metriccanvas/page';
import { pageEntry, type PlaygroundPageEntry } from './page-entry';
import { indexPagePaths, relativePagePath } from './page-file-index';

/**
 * PageRepository 静态文件实现(一期,ADR-0004):页面文档来自仓库根 pages/ 目录($pages 别名)。
 * 开发工具只消费仓库页面。pages/ 在 Vite root 之外，dev 下的监听由
 * vite.config.ts 的 watch-page-assets 插件补齐，修改页面即热刷新。
 */
const modules = import.meta.glob<{ default: unknown }>('$pages/**/*.json');

interface StaticPageRepository extends PageRepository {
  list(): Promise<PlaygroundPageEntry[]>;
}

export function createStaticPageRepository(): StaticPageRepository {
  const paths = indexPagePaths(Object.keys(modules));

  return {
    async load(pageId: string): Promise<unknown> {
      const path = paths.get(pageId);
      const loader = path ? modules[path] : undefined;
      if (!loader) throw new Error(`页面不存在:${pageId}`);
      const raw = (await loader()).default;
      if (typeof raw === 'object' && raw !== null && 'id' in raw && typeof raw.id === 'string' && raw.id !== pageId) {
        throw new Error(`页面文件名与 ID 不一致: ${path} / ${raw.id}`);
      }
      const normalized = normalizePageDocument(raw);
      // 无效页面保留原文给统一运行时呈现准确错误。
      return normalized.ok ? normalized.document : raw;
    },

    async list() {
      const entries: PlaygroundPageEntry[] = [];
      for (const [id, path] of paths) {
        const entry = pageEntry((await modules[path]!()).default, id);
        if (entry.id !== id) throw new Error(`页面文件名与 ID 不一致: ${path} / ${entry.id}`);
        entries.push({ ...entry, filePath: relativePagePath(path) });
      }
      return entries;
    }
  };
}
