import type { SpecProvider } from '@metriccanvas/runtime';

/**
 * SpecProvider 静态文件实现(一期,ADR-0004):规格来自仓库根 specs/ 目录。
 * dev 模式下 Vite 监听 JSON 模块,改规格即热刷新;二期换平台 API 实现,运行时零改动。
 */
const modules = import.meta.glob<{ default: unknown }>('../../../../specs/*.json');

export function createStaticSpecProvider(): SpecProvider {
  const loaders = new Map<string, () => Promise<{ default: unknown }>>();
  for (const [path, loader] of Object.entries(modules)) {
    const id = path.split('/').pop()!.replace(/\.json$/, '');
    loaders.set(id, loader);
  }

  return {
    async load(pageId: string): Promise<unknown> {
      const loader = loaders.get(pageId);
      if (!loader) throw new Error(`页面规格不存在:${pageId}`);
      return (await loader()).default;
    },

    async list() {
      const entries: Array<{ id: string; title: string; description?: string }> = [];
      for (const [id, loader] of loaders) {
        const raw = (await loader()).default as { title?: string; description?: string } | null;
        entries.push({
          id,
          title: typeof raw?.title === 'string' ? raw.title : id,
          ...(typeof raw?.description === 'string' ? { description: raw.description } : {})
        });
      }
      return entries;
    }
  };
}
