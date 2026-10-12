import type { DataSource, DataSources } from './data-source';
import { computeDependencies } from './compute';

export function queryResultDependencies(source: DataSource | undefined): string[] {
  return source?.source.type === 'query'
    ? [...new Set((source.source.query.resultBindings ?? []).map(binding => binding.source))] : [];
}

/** A declared selection is distinct from a complete business population. */
export function isBoundedResultSource(sources: DataSources, id: string): boolean {
  const source = sources[id];
  if (source?.source.type !== 'query') return false;
  const order = source.source.query.body.dsl_list[0]?.order;
  return typeof order === 'object' && order !== null && !Array.isArray(order) &&
    Number.isSafeInteger(order.limit) && Number(order.limit) > 0 && !('offset' in order) &&
    Object.values(sources).some(candidate => queryResultDependencies(candidate).includes(id));
}

/** Connected query/compute chains cannot reuse unproven initial snapshots. */
export function cascadeSourceIds(sources: DataSources): Set<string> {
  const ids = new Set<string>();
  for (const [id, source] of Object.entries(sources)) {
    const dependencies = queryResultDependencies(source);
    if (dependencies.length) { ids.add(id); dependencies.forEach(value => ids.add(value)); }
  }
  let changed = true;
  while (changed) {
    const size = ids.size;
    for (const [id, source] of Object.entries(sources)) {
      const dependencies = [...queryResultDependencies(source), ...computeDependencies(source.compute ?? [])];
      if (ids.has(id) || dependencies.some(dependency => ids.has(dependency))) {
        ids.add(id); dependencies.forEach(dependency => ids.add(dependency));
      }
    }
    changed = size !== ids.size;
  }
  return ids;
}
