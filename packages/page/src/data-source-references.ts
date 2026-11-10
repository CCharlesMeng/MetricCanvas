import {queryFilterIds} from './amount-filter';
import type { DataSource, DataSources } from './data-source';
import type { Page } from './page';
import { computeDependencies } from './compute';
import { queryResultDependencies } from './query-dependencies';
import { flattenPageComponents } from './component-walk';

/** Definition references propagate conditions, never execution prerequisites. */
export function definitionSourceIds(source: DataSource | undefined): string[] {
  return (source?.source.type === 'pagedJoin' || source?.source.type === 'pagedUnion') ? [...new Set(Object.values(source.source.members).map(member => member.source))] : [];
}
export function resultSourceIds(source: DataSource | undefined): string[] {
  return [...new Set([...queryResultDependencies(source), ...computeDependencies(source?.compute ?? [])])];
}
export function conditionSourceIds(page: Pick<Page, 'dataSources'> & Partial<Pick<Page, 'sections' | 'detailViews'>>, sourceId: string): Set<string> {
  const ids = new Set([sourceId]);
  for (const id of ids) for (const dependency of [...resultSourceIds(page.dataSources[id]), ...definitionSourceIds(page.dataSources[id]), ...slotSearchSources(page, id)]) ids.add(dependency);
  return ids;
}

/** Search lookup conditions propagate to main without reversing result execution edges. */
function slotSearchSources(page: Partial<Pick<Page, 'sections' | 'detailViews'>>, sourceId: string): string[] {
  return flattenPageComponents({ sections: page.sections ?? [], detailViews: page.detailViews }).flatMap(component => {
    if (component.type !== 'table' || component.data.main !== sourceId) return [];
    const search = component.props.toolbar?.search;
    if (!search || !('options' in search)) return [];
    return search.options.flatMap(option => typeof option.field === 'string' ? [] : [component.data[option.field.data]]).filter((id): id is string => id !== undefined);
  });
}
export function affectedSourceIds(sources: DataSources, changed: Iterable<string>, includeCompute = true): Set<string> {
  const ids = new Set(changed);
  for (const dependency of ids) for (const [id, source] of Object.entries(sources)) {
    if ([...(includeCompute ? resultSourceIds(source) : queryResultDependencies(source)), ...definitionSourceIds(source)].includes(dependency)) ids.add(id);
  }
  return ids;
}

/** Filters consumed directly by a source, including local record-time predicates. */
export function sourceFilterIds(source: DataSource | undefined): string[] {
  if (source?.source.type === 'query') return queryFilterIds(source.source.query);
  return source?.source.type === 'pagedJoin' ? Object.keys(source.source.records?.timeFilters ?? {}) : [];
}
