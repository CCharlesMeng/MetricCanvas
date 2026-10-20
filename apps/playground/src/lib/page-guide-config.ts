/** 从当前加载的页面提取配置，目录说明不另存一份运行声明。支持数组 [] 和对象 *。 */
export function guideConfig(document: unknown, selector: string): { path: string; value: unknown }[] {
  const segments = selector.replaceAll('[]', '.*').split('.');
  function visit(value: unknown, index: number, path: string): { path: string; value: unknown }[] {
    if (index === segments.length) return [{ path, value }];
    if (value === null || typeof value !== 'object') return [];
    const segment = segments[index];
    return Object.entries(value).filter(([key]) => segment === '*' || key === segment).flatMap(([key, child]) => {
      const next = Array.isArray(value) ? `${path}[${key}]` : path ? `${path}.${key}` : key;
      return visit(child, index + 1, next);
    });
  }
  return visit(document, 0, '');
}
