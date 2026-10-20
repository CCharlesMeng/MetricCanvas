import { filterDependencies } from '@metriccanvas/page/internal';
import { candidateContextKey } from '../../../runtime/src/filter-candidates';
import {
  dimensionOfLevel,
  type DimensionFilterDeclaration,
  type FilterDeclaration
} from '@metriccanvas/page/internal';
import type { FilterValue, FilterValues } from '../../../runtime/src';

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
  const result = new Set<string>();
  const queue = [parentId];
  for (const parent of queue) for (const declaration of declarations) {
    if (!filterDependencies(declaration).includes(parent) || declaration.id === parentId || result.has(declaration.id)) continue;
    result.add(declaration.id); queue.push(declaration.id);
  }
  return [...result];
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

/** Identity includes the full ancestry even though the legacy port accepts direct-parent constraints only. */
export function cascadeContext(declaration: DimensionFilterDeclaration, declarations: readonly FilterDeclaration[], values: FilterValues,context:{displayInputs?:import('@metriccanvas/page/internal').DisplayInputsSnapshot;filterRevision?:number;now?:Date}={}): string {
  return candidateContextKey(declaration,declarations,values,context);
}
