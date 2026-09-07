import {
  dimensionOfLevel,
  type DimensionFilterDeclaration,
  type FilterDeclaration
} from '@metriccanvas/page';
import type { FilterValue, FilterValues } from '@metriccanvas/runtime';

/**
 * 级联只收窄候选值:按上游当前选中值构造下游候选值端口的约束。
 * 不改变下游绑定字段,也不让下游出现或消失。
 */
export function cascadeConstraints(
  declaration: DimensionFilterDeclaration,
  declarations: readonly FilterDeclaration[],
  values: FilterValues
): Readonly<Record<string, readonly string[]>> | undefined {
  if (!declaration.dependsOn) return undefined;
  const upstream = declarations.find((item) => item.id === declaration.dependsOn);
  if (upstream?.type !== 'dimension') return undefined;
  const current = values.get(upstream.id);
  if (current?.type !== 'dimension' || current.values.length === 0) return undefined;
  return { [dimensionOfLevel(upstream, current.level)]: current.values };
}

/** 上游筛选器变化时,依赖它的下游应被清掉——候选已经变了。 */
export function dependentFilterIds(
  declarations: readonly FilterDeclaration[],
  parentId: string
): string[] {
  return declarations
    .filter((item) => item.type === 'dimension' && item.dependsOn === parentId)
    .map((item) => item.id);
}

export function clearDependentUpdates(
  declarations: readonly FilterDeclaration[],
  parentId: string
): Array<readonly [string, null]> {
  return dependentFilterIds(declarations, parentId).map((id) => [id, null] as const);
}

export function dimensionValueOf(
  values: FilterValues,
  filterId: string
): { values: string[]; level?: string } {
  const value = values.get(filterId);
  if (value?.type !== 'dimension') return { values: [] };
  return { values: value.values, level: value.level };
}

export function filterValueOf(values: FilterValues, filterId: string): FilterValue | undefined {
  return values.get(filterId);
}
