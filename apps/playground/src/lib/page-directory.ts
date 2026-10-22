import { pageComponentTypes, type PlaygroundPageEntry } from './page-entry';

export { pageComponentTypes } from './page-entry';
export const pageLayouts = [{ id: 'dashboard', title: 'Dashboard · 看板' }, { id: 'report', title: 'Report · 报表' }] as const;
export const pageDataKinds = [{ id: 'inline', title: '内联／静态' }, { id: 'query', title: '包含查询' }, { id: 'unknown', title: '未知（文档无效）' }] as const;

function pageFolder(page: PlaygroundPageEntry): string {
  return page.filePath?.split('/').slice(0, -1).join('/') || '.';
}

export function folderIncludes(path: string, folder: string): boolean {
  return folder === 'all' || path === folder || path.startsWith(`${folder}/`);
}

export function folderTitle(path: string): string {
  return path === '.' ? '根目录' : path;
}

export function pageFolders(pages: PlaygroundPageEntry[]) {
  const paths = new Set<string>();
  for (const page of pages) {
    const parts = pageFolder(page).split('/');
    for (let index = 1; index <= parts.length; index++) paths.add(parts.slice(0, index).join('/'));
  }
  return [...paths].sort((a, b) => a.localeCompare(b, 'zh-CN')).map(path => ({
    path, title: folderTitle(path), depth: path === '.' ? 0 : path.split('/').length - 1,
    count: pages.filter(page => folderIncludes(pageFolder(page), path)).length
  }));
}

export function organizePageDirectory(pages: PlaygroundPageEntry[]) {
  const groups = new Map<string, { id: string; title: string; pages: PlaygroundPageEntry[] }>();
  for (const page of pages) {
    const path = pageFolder(page);
    if (!groups.has(path)) groups.set(path, { id: path, title: folderTitle(path), pages: [] });
    groups.get(path)!.pages.push(page);
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id, 'zh-CN')).map(group => ({
    ...group, pages: group.pages.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  }));
}

export function filterPageDirectory(
  groups: ReturnType<typeof organizePageDirectory>, query: string, layout = 'all', component = 'all', dataKind = 'all', folder = 'all'
) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return groups.filter(group => folderIncludes(group.id, folder)).map(group => ({
    ...group, pages: group.pages.filter(page => {
      if (layout !== 'all' && page.layoutForm !== layout) return false;
      if (component !== 'all' && !page.componentTypes.includes(component)) return false;
      if (dataKind !== 'all' && page.dataKind !== dataKind) return false;
      const components = pageComponentTypes.filter(item => page.componentTypes.includes(item.id));
      const text = [page.id, page.title, page.description, page.filePath, page.layoutForm,
        ...page.componentTypes, ...components.map(item => item.title)].join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word));
    })
  })).filter(group => group.pages.length > 0);
}
