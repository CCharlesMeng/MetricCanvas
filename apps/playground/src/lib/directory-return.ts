const key = 'metriccanvas:directory-return:v1';
let remembered = '/';

export function isDirectoryHref(href: string): boolean {
  const path = href.split('?')[0];
  return path === '/' || path === '/files' || /^\/catalog\/(components|data|layouts)\/[^/?#]+$/.test(path ?? '');
}

export function rememberDirectoryHref(href: string) {
  if (!isDirectoryHref(href)) return;
  remembered = href;
  try { sessionStorage.setItem(key, href); } catch { /* In-memory return remains available. */ }
}

export function readDirectoryHref(): string {
  try {
    const href = sessionStorage.getItem(key);
    if (href && isDirectoryHref(href)) return href;
  } catch { /* Storage can be disabled. */ }
  return remembered;
}
