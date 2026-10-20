import type { Page } from './page';
import type { TypedError } from './errors';
import { walkPageComponents } from './component-walk';

/** Root placement is validated once for every serialized consumer. */
export function iocHeaderErrors(page: Page): TypedError[] {
  const header = page.iocHeader;
  if (!header) return [];
  const errors: TypedError[] = [];
  const issue = (path: string, message: string) => errors.push({type:'SCHEMA_ERROR', path, message});
  const identity = header.identity;
  if (page.layout === 'dashboard' && page.dashboardToolbar !== undefined && page.dashboardToolbar !== 'hidden') issue('/dashboardToolbar', 'IOC 看板必须显式关闭通用工具栏');
  for (const key of ['tags', 'facts'] as const) {
    const ids = new Set<string>();
    identity?.[key]?.forEach((item, index) => {
      if (ids.has(item.id)) issue(`/iocHeader/identity/${key}/${index}/id`, '身份项 id 重复');
      ids.add(item.id);
    });
  }
  const placed = new Set(header.filterIds ?? []);
  header.filterIds?.forEach((id, index) => {
    const filter = page.filters?.find(f => f.id === id);
    if (!filter || filter.visible === false) issue(`/iocHeader/filterIds/${index}`, 'IOC 页头只能认领静态可见的页级筛选');
  });
  walkPageComponents(page, (component, path) => {
    if ('filter' in component.props && component.props.filter && placed.has(component.props.filter.filterId)) issue('/iocHeader/filterIds', '图表独立筛选不能被 IOC 页头认领');
    if (component.type !== 'reportHeader') return;
    if (component.props.variant === 'projectDetail' || path === '/sections/0/components/0') issue(path, 'IOC 页头不能与首个业务 reportHeader 重复承担页面身份');
    if (component.props.filterIds?.some(id => placed.has(id))) issue(`${path}/props/filterIds`, '筛选不能被多个页头认领');
  });
  return errors;
}
