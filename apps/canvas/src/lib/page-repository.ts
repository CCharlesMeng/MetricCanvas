import type { PageRepository } from '@metriccanvas/runtime';

/**
 * PageRepository 静态文件实现(一期,ADR-0004):页面文档来自仓库根 pages/ 目录($pages 别名)。
 * dev 模式下 Vite 监听 JSON 模块,改页面即热刷新;二期换平台 API 实现,运行时零改动。
 */
const modules = import.meta.glob<{ default: unknown }>('$pages/*.json');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pageMetadata(raw: unknown, fallbackId: string) {
  const document = isRecord(raw) ? raw : {};
  const id = typeof document.id === 'string' ? document.id : fallbackId;
  const meta = isRecord(document.meta) ? document.meta : {};
  let title = id;
  if (Array.isArray(document.sections)) {
    for (const section of document.sections) {
      if (!isRecord(section) || !Array.isArray(section.components)) continue;
      const header = section.components.find(
        (component) => isRecord(component) && component.type === 'reportHeader'
      );
      if (!isRecord(header) || !isRecord(header.props)) continue;
      if (typeof header.props.title === 'string') title = header.props.title;
      break;
    }
  }
  return {
    id,
    title,
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
