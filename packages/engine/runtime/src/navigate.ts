import { isNavigationHref, type NavigationTarget, type Row } from '@metriccanvas/page/internal';
import type { FilterValue, FilterValues } from './filter-state';
import type { PageParamValues } from './page-params';

/** 只按显式绑定构造普通 URL；相对路径留给承载文档解析。 */
export function navigationHref(target: NavigationTarget, filters: FilterValues, params: PageParamValues, row: Row = {}): string {
  if (!isNavigationHref(target.href)) throw new Error('导航只允许 HTTP(S) 或相对 URL');
  const hashIndex = target.href.indexOf('#');
  const hash = hashIndex < 0 ? '' : target.href.slice(hashIndex);
  const address = hashIndex < 0 ? target.href : target.href.slice(0, hashIndex);
  const queryIndex = address.indexOf('?');
  const path = queryIndex < 0 ? address : address.slice(0, queryIndex);
  const query = new URLSearchParams(queryIndex < 0 ? '' : address.slice(queryIndex + 1));
  for (const [key, binding] of Object.entries(target.query ?? {})) {
    const value = binding.source === 'row' ? row[binding.field]
      : binding.source === 'param' ? params.get(binding.id)
      : filterPart(filters.get(binding.id), binding.part ?? 'value');
    const values = (Array.isArray(value) ? value : [value]).filter(isQueryValue);
    if (!values.length) continue;
    query.delete(key);
    for (const item of values) query.append(key, String(item));
  }
  const search = query.toString();
  return `${path}${search ? `?${search}` : ''}${hash}`;
}
function isQueryValue(value: unknown): value is string | number | boolean {
  return (typeof value === 'string' && value !== '') || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}
function filterPart(value: FilterValue | undefined, part: string): unknown {
  if (!value) return undefined;
  if (part === 'from' || part === 'to') return value.type === 'timeRange' || value.type === 'numberRange' ? value[part] : undefined;
  if (part === 'level') return value.type === 'dimension' ? value.level : undefined;
  if (value.type === 'dimension') return value.values;
  if (value.type === 'search') return value.query;
  if (value.type === 'timePoint' || value.type === 'boolean') return value.value;
  return undefined;
}
