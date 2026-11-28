import {
  type DimensionFilterDeclaration,
  filterURLKeys,
  findIocRegionFilter,
  hasIocRegionHeaderFilter,
  IOC_REGION_FILTER_ID,
  isIocGlobalRegionValue,
  type Page,
  readLevelURLSelection,
  usesIocRegion,
} from '@metriccanvas/page/internal';
import {
  candidateScopeKey,
  type DimensionValuesSnapshots,
} from '../../runtime/src/dimension-values';
import type { FilterValue, FilterValues } from '../../runtime/src/filter-state';
import { hierarchyTreeSnapshot } from './filters/hierarchy-tree';

/** Initialize once from a complete authorized tree; later clear/refresh never reseeds it. */
export function createIocRegionDefault(
  page: Page,
  search: string,
  initial: FilterValues,
  restored: boolean,
) {
  const declaration = findIocRegionFilter(page);
  const query = new URLSearchParams(search);
  let pending =
    usesIocRegion(page) &&
    !restored &&
    declaration?.default === undefined &&
    !initial.has(IOC_REGION_FILTER_ID) &&
    !!declaration?.hierarchy &&
    !Object.values(filterURLKeys(declaration, true)).some((key) => query.has(key));
  let initialReceipt = false;
  return {
    waiting: () => pending && !initialReceipt,
    take(snapshots: DimensionValuesSnapshots, context: string): FilterValue | undefined {
      if (!pending || !declaration?.hierarchy) return;
      const tree = regionTree(declaration, snapshots, context);
      if (tree.status === 'loading' || tree.status === 'idle') return;
      initialReceipt = true;
      if (tree.status !== 'ready') return;
      const available = tree.candidates.filter((candidate) => !candidate.disabled);
      const node =
        available.find((candidate) => isIocGlobalRegionValue(candidate.value)) ?? available[0];
      const level = declaration.hierarchy.find((level) => level.id === node?.level);
      if (!node || !level) return;
      pending = false;
      return {
        type: 'dimension',
        dimension: level.dimension,
        level: level.id,
        values: [node.value],
      };
    },
    cancel(initialized: boolean, changed: boolean) {
      if (initialized && changed) pending = false;
    },
  };
}

/** A value-only link has an explicit value and needs an authorized level before it can be applied. */
export function pendingIocRegionURL(page: Page, search: string) {
  if (!hasIocRegionHeaderFilter(page)) return;
  const declaration = findIocRegionFilter(page);
  if (!declaration || declaration.treeSelection !== 'level' || !declaration.hierarchy) return;
  const keys = filterURLKeys(declaration, true);
  const query = new URLSearchParams(search);
  if (!keys.value || query.has(keys.level!) || readLevelURLSelection(keys, query)) return;
  const values = query.getAll(keys.value).filter((value) => value !== '');
  if (values.length === 1 && values[0]?.trim()) return { declaration, value: values[0] };
}

export function resolveIocRegionURL(
  input: NonNullable<ReturnType<typeof pendingIocRegionURL>>,
  snapshots: DimensionValuesSnapshots,
  context: string,
): { issue: string } | { value: FilterValue } | undefined {
  const tree = regionTree(input.declaration, snapshots, context);
  if (tree.status === 'empty') return { issue: 'URL 指定的区域不在当前授权候选中' };
  if (tree.status !== 'ready') return;
  const matches = tree.candidates.filter((node) => !node.disabled && node.value === input.value);
  if (matches.length === 0) return { issue: 'URL 指定的区域不在当前授权候选中' };
  if (matches.length > 1) return { issue: 'URL 指定的区域匹配多个层级，请显式指定区域层级' };
  const level = input.declaration.hierarchy?.find((level) => level.id === matches[0]!.level);
  if (level)
    return {
      value: {
        type: 'dimension',
        dimension: level.dimension,
        level: level.id,
        values: [input.value],
      },
    };
}

function regionTree(
  declaration: DimensionFilterDeclaration,
  snapshots: DimensionValuesSnapshots,
  context: string,
) {
  const levels = declaration.hierarchy!;
  const receipts = Object.fromEntries(
    levels.map((level) => [
      level.id,
      snapshots.get(candidateScopeKey(declaration.id, level.dimension, level.id, context)) ?? {
        status: 'loading' as const,
      },
    ]),
  );
  return hierarchyTreeSnapshot(levels, receipts, declaration.treeSelection === 'level');
}
