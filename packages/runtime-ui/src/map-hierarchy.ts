import {
  fieldName,
  hierarchyLevelOf,
  type FilterDeclaration,
  type MapChartProps,
  type Row
} from '@metriccanvas/page';
import type { DimensionFilterValue, FilterValue } from '@metriccanvas/runtime';

export type MapClickDecision =
  | { kind: 'drill'; filterId: string; value: DimensionFilterValue }
  | { kind: 'navigate' }
  | { kind: 'ignore' };

type HierarchyDeclaration = Extract<FilterDeclaration, { type: 'dimension' }> & {
  hierarchy: NonNullable<Extract<FilterDeclaration, { type: 'dimension' }>['hierarchy']>;
};

export function isHierarchyDeclaration(
  declaration: FilterDeclaration | undefined
): declaration is HierarchyDeclaration {
  return (
    declaration?.type === 'dimension' &&
    Array.isArray(declaration.hierarchy) &&
    declaration.hierarchy.length > 0
  );
}

export function currentHierarchyLevelId(
  declaration: HierarchyDeclaration,
  value: FilterValue | undefined
): string {
  const level = hierarchyLevelOf(
    declaration,
    value?.type === 'dimension' ? value.level : undefined
  );
  return level?.id ?? declaration.defaultLevel ?? declaration.hierarchy[0]!.id;
}

export function resolveMapBasemap(
  props: Pick<MapChartProps, 'map' | 'levelMaps'>,
  declaration: HierarchyDeclaration | undefined,
  value: FilterValue | undefined
): 'china' | 'world' {
  if (!declaration) return props.map;
  const levelId = currentHierarchyLevelId(declaration, value);
  return props.levelMaps?.[levelId] ?? props.map;
}

export function filterMapRows(
  rows: readonly Row[],
  props: Pick<MapChartProps, 'levelField' | 'parentField' | 'codeField'>,
  declaration: HierarchyDeclaration,
  value: FilterValue | undefined
): Row[] {
  const levelId = currentHierarchyLevelId(declaration, value);
  const firstLevel = declaration.hierarchy[0]!.id;
  const levelField = props.levelField ? fieldName(props.levelField) : undefined;
  const parentField = props.parentField ? fieldName(props.parentField) : undefined;
  const codeField = props.codeField ? fieldName(props.codeField) : undefined;
  const selected = value?.type === 'dimension' ? value.values : [];

  return rows.filter((row) => {
    if (levelField && String(row[levelField] ?? '') !== levelId) return false;
    if (levelId === firstLevel || selected.length === 0 || !parentField) return true;
    const parent = String(row[parentField] ?? '');
    const code = codeField ? String(row[codeField] ?? '') : '';
    return selected.includes(parent) || (code !== '' && selected.includes(code));
  });
}

export function resolveMapClick(
  props: Pick<MapChartProps, 'codeField' | 'nameField'>,
  declaration: HierarchyDeclaration,
  value: FilterValue | undefined,
  row: Row
): MapClickDecision {
  const levelId = currentHierarchyLevelId(declaration, value);
  const index = declaration.hierarchy.findIndex((level) => level.id === levelId);
  const next = index >= 0 ? declaration.hierarchy[index + 1] : undefined;
  if (!next) return { kind: 'navigate' };
  const code = row[fieldName(props.codeField ?? props.nameField)];
  if (code == null) return { kind: 'ignore' };
  return {
    kind: 'drill',
    filterId: declaration.id,
    value: {
      type: 'dimension',
      dimension: next.dimension,
      values: [String(code)],
      level: next.id
    }
  };
}
