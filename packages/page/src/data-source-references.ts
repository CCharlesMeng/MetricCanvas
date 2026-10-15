import type { DataSource, DataSources } from './data-source';
import type { Page } from './page';
import { computeDependencies } from './compute';
import { queryResultDependencies } from './query-dependencies';

/** Definition references propagate conditions, never execution prerequisites. */
export function definitionSourceIds(source: DataSource | undefined): string[] {
  return source?.source.type === 'pagedJoin' ? [...new Set(Object.values(source.source.members).map(member => member.source))] : [];
}
export function resultSourceIds(source: DataSource | undefined): string[] {
  return [...new Set([...queryResultDependencies(source), ...computeDependencies(source?.compute ?? [])])];
}
export function conditionSourceIds(page: Pick<Page, 'dataSources'>, sourceId: string): Set<string> {
  const ids = new Set([sourceId]);
  for (const id of ids) for (const dependency of [...resultSourceIds(page.dataSources[id]), ...definitionSourceIds(page.dataSources[id])]) ids.add(dependency);
  return ids;
}
export function affectedSourceIds(sources: DataSources, changed: Iterable<string>, includeCompute = true): Set<string> {
  const ids = new Set(changed);
  for (const dependency of ids) for (const [id, source] of Object.entries(sources)) {
    if ([...(includeCompute ? resultSourceIds(source) : queryResultDependencies(source)), ...definitionSourceIds(source)].includes(dependency)) ids.add(id);
  }
  return ids;
}
