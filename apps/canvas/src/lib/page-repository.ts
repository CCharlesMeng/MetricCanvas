import type { PageRepository } from '@metriccanvas/runtime';
import { pageListEntry, parsePage } from '@metriccanvas/page';

/**
 * PageRepository 静态文件实现(一期,ADR-0004):页面文档来自仓库根 pages/ 目录($pages 别名)。
 * 只在未配置 VITE_PLATFORM_URL 时生效(见 $lib/services);配了平台地址,页面文档由平台接口供给,
 * 本实现不参与。pages/ 在 Vite root 之外,dev 下的监听靠 vite.config.ts 的 watch-page-assets
 * 插件补齐,改页面即热刷新;二期换平台 API 实现,运行时零改动。
 */
const modules = import.meta.glob<{ default: unknown }>('$pages/*.json');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pageMetadata(raw: unknown, fallbackId: string) {
  const parsed = parsePage(raw);
  if (parsed.ok) return pageListEntry(parsed.page);

  const document = isRecord(raw) ? raw : {};
  const id = typeof document.id === 'string' ? document.id : fallbackId;
  const meta = isRecord(document.meta) ? document.meta : {};
  return {
    id,
    title: id,
    ...(typeof meta.description === 'string'
      ? { description: meta.description }
      : {})
  };
}

export function createStaticPageRepository(): PageRepository {
  const loaders = new Map<string, () => Promise<{ default: unknown }>>();
  for (const [path, loader] of Object.entries(modules)) {
    const id = path.split('/').pop()!.replace(/\.json$/, '');
    loaders.set(id, loader);
  }

  return {
    async load(pageId: string): Promise<unknown> {
      const loader = loaders.get(pageId);
      if (!loader) throw new Error(`页面不存在:${pageId}`);
      return (await loader()).default;
    },

    async list() {
      const entries: Array<{ id: string; title: string; description?: string }> = [];
      for (const [id, loader] of loaders) {
        entries.push(pageMetadata((await loader()).default, id));
      }
      return entries;
    }
  };
}
