import { filterURLKeys, usesIocRegion, type Page, type DimensionFilterDeclaration } from '@metriccanvas/page/internal';
import { candidateScopeKey, type DimensionValuesSnapshots } from '../../runtime/src/dimension-values';
import type { FilterValues, FilterValue } from '../../runtime/src/filter-state';
import { hierarchyTreeSnapshot } from './filters/hierarchy-tree';

/** Initialize once from a complete authorized tree; later clear/refresh never reseeds it. */
export function createIocRegionDefault(page: Page, search: string, initial: FilterValues, restored: boolean) {
  const declaration = page.filters?.find((filter): filter is DimensionFilterDeclaration => filter.id === 'region' && filter.type === 'dimension');
  const query = new URLSearchParams(search);
  let pending = usesIocRegion(page) && !restored && declaration?.default === undefined && !initial.has('region') &&
    !!declaration?.hierarchy && !Object.values(filterURLKeys(declaration, true)).some(key => query.has(key));
  return {
    take(snapshots: DimensionValuesSnapshots, context: string): FilterValue | undefined {
      if (!pending || !declaration?.hierarchy) return;
      const receipts = Object.fromEntries(declaration.hierarchy.map(level => [level.id,
        snapshots.get(candidateScopeKey(declaration.id, level.dimension, level.id, context)) ?? { status: 'loading' as const }]));
      const tree = hierarchyTreeSnapshot(declaration.hierarchy, receipts, declaration.treeSelection === 'level');
      if (tree.status !== 'ready') return;
      const available = tree.candidates.filter(candidate => !candidate.disabled);
      const node = available.find(candidate => candidate.value === '全球') ?? available[0];
      const level = declaration.hierarchy.find(level => level.id === node?.level);
      if (!node || !level) return;
      pending = false;
      return { type: 'dimension', dimension: level.dimension, level: level.id, values: [node.value] };
    },
    cancel(initialized: boolean, changed: boolean) { if (initialized && changed) pending = false; }
  };
}
