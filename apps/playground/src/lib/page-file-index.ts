/** Keep storage paths out of the Page document and keep routes addressed by ID. */
export function indexPagePaths(paths: string[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const path of paths.sort()) {
    const relative = relativePagePath(path);
    const id = relative.split('/').at(-1)!.replace(/\.json$/, '');
    if (index.has(id)) throw new Error(`重复页面 ID ${id}: ${index.get(id)} / ${path}`);
    index.set(id, path);
  }
  return index;
}

export function relativePagePath(path: string): string {
  const normalized = path.replaceAll('\\', '/');
  const marker = normalized.indexOf('/pages/');
  return normalized.startsWith('$pages/') ? normalized.slice(7)
    : marker >= 0 ? normalized.slice(marker + 7) : normalized;
}
