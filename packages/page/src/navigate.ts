import { resolveDataSourceFields } from './data-source';
import { walkPageComponents } from './component-walk';
import type { Page } from './page';
import type { TypedError } from './errors';
import type { NavigationTarget } from './schema/navigation';

/** 静态地址边界；不请求目标，也不以本仓页面集合推断部署路径。 */
export function isNavigationHref(href: string): boolean {
  if (!href || href !== href.trim() || /[\u0000-\u001f\u007f\\]/.test(href)) return false;
  if (/^https?:(?!\/\/)/i.test(href)) return false;
  try {
    const url = new URL(href, 'https://metriccanvas.invalid/');
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch { return false; }
}

export function navigationErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const filters = new Map((page.filters ?? []).map(f => [f.id, f]));
  const params = new Set((page.params ?? []).map(p => p.id));
  const fail = (path: string, message: string) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  walkPageComponents(page, (component, path) => {
    const targets: Array<[NavigationTarget, string]> = [];
    if (component.type === 'text') {
      (component.props.links ?? []).forEach((link, i) => targets.push([link, `${path}/props/links/${i}`]));
    } else if ('actions' in component.props) {
      component.props.actions?.forEach((a, i) => {
        if ('navigate' in a) targets.push([a.navigate, `${path}/props/actions/${i}/navigate`]);
      });
    }
    for (const [target, targetPath] of targets) {
      if (!isNavigationHref(target.href)) fail(`${targetPath}/href`, '导航只允许 HTTP(S) 或相对 URL');
      for (const [key, binding] of Object.entries(target.query ?? {})) {
        const p = `${targetPath}/query/${key.replaceAll('~','~0').replaceAll('/','~1')}`;
        if (binding.source === 'param') {
          if (!params.has(binding.id)) fail(`${p}/id`, `未声明的页面参数:${binding.id}`);
        } else if (binding.source === 'filter') {
          const filter = filters.get(binding.id);
          if (!filter) { fail(`${p}/id`, `未声明的筛选器:${binding.id}`); continue; }
          const part = binding.part ?? 'value';
          const range = filter.type === 'timeRange' || filter.type === 'numberRange';
          if (range ? !['from','to'].includes(part) : part !== 'value' && !(part === 'level' && filter.type === 'dimension' && filter.hierarchy)) {
            fail(`${p}/part`, `筛选器 ${binding.id} 不支持分量 ${part}`);
          }
        } else {
          const linkedRows = component.type === 'metricCard'
            ? [...component.props.rows, ...(component.props.secondaryRows ?? [])].filter(row => row.link)
            : [];
          const slots = linkedRows.length
            ? linkedRows.map(row => typeof row.valueField === 'string' ? 'main' : row.valueField.data)
            : ['main'];
          const dataSlots: Readonly<Record<string, string | undefined>> = component.data ?? {};
          const invalid = slots.some(slot => {
            const sourceId = dataSlots[slot];
            const source = sourceId ? page.dataSources[sourceId] : undefined;
            const field = source && resolveDataSourceFields(source)[binding.field];
            return !field || !['string', 'number', 'money', 'boolean', 'date', 'datetime'].includes(field.type);
          });
          if (invalid) fail(`${p}/field`, `当前行缺少可传参的标量字段:${binding.field}`);
        }
      }
    }
  });
  return errors;
}

/** 同页 URL 名称不能指向两个不同输入。 */
export function filterURLKeys(filter: NonNullable<Page['filters']>[number]): Record<string, string> {
  const names = filter.urlParams ?? {};
  if (filter.type === 'timeRange' || filter.type === 'numberRange') return { from: names.from ?? `${filter.id}.from`, to: names.to ?? `${filter.id}.to` };
  return { value: names.value ?? filter.id, ...(filter.type === 'dimension' && filter.hierarchy ? { level: names.level ?? `${filter.id}.level` } : {}) };
}
export function urlInputErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const used = new Set((page.params ?? []).map(p => p.id));
  (page.filters ?? []).forEach((filter, i) => {
    const keys = filterURLKeys(filter);
    for (const part of Object.keys(filter.urlParams ?? {})) {
      if (!(part in keys)) errors.push({ type:'SCHEMA_ERROR', path:`/filters/${i}/urlParams/${part}`, message:'该筛选器不支持此 URL 分量' });
    }
    for (const [part, key] of Object.entries(keys)) {
      if (used.has(key)) errors.push({ type:'SCHEMA_ERROR', path:`/filters/${i}/urlParams/${part}`, message:`URL 参数名重复:${key}` });
      used.add(key);
    }
  });
  return errors;
}
