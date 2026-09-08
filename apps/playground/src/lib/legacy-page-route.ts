import legacyPageRoutes from '../../legacy-page-routes.json';

const routes: Readonly<Record<string, string>> = legacyPageRoutes;

/** 只翻译声明式登记的精确旧入口；其他路径不受影响。 */
export function legacyPageHref(pathname: string, search = ''): string | undefined {
  const canonicalPath = routes[pathname];
  if (!canonicalPath) return undefined;
  if (search === '') return canonicalPath;
  return `${canonicalPath}${search.startsWith('?') ? search : `?${search}`}`;
}
