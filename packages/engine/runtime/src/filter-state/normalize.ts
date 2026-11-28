import type { FilterValue, FilterValues } from '@metriccanvas/data-execution/runtime';
import {
  dimensionOfLevel,
  dimensionSelectionIssue,
  type FilterDeclaration,
  finalizationMonthIssue,
  isPeriodSelection,
  matchingDimensionDefault,
  modeRangeIssue,
  numberRangeIssue,
  rangeContextIssue,
  resolvePeriodSelection,
  timeFilterBoundaryError,
  validateCalendarTimeRange,
  validateTimePointValue,
} from '@metriccanvas/page/internal';
import type { FilterStateEditingOptions } from './types';

export type ConditionalDimensionFilter = Extract<FilterDeclaration, { type: 'dimension' }> & {
  defaultWhen: NonNullable<Extract<FilterDeclaration, { type: 'dimension' }>['defaultWhen']>;
};

export function isConditionalDimension(
  filter: FilterDeclaration | undefined,
): filter is ConditionalDimensionFilter {
  return filter?.type === 'dimension' && filter.defaultWhen !== undefined;
}

export function explicitDimensionClear(
  value: FilterValue | null,
  declaration: FilterDeclaration | undefined,
): FilterValue | null {
  if (value === null && isConditionalDimension(declaration)) {
    return { type: 'dimension', dimension: declaration.dimension, values: [] };
  }
  return value;
}

export function acceptedDimensionOption(
  dimensionOptions: ReadonlyMap<string, readonly string[]>,
  id: string,
  value: FilterValue | null | undefined,
): boolean {
  const options = dimensionOptions.get(id);
  return (
    !options ||
    (!!value &&
      value.type === 'dimension' &&
      value.values.length === 1 &&
      options.includes(value.values[0]!))
  );
}

export function finalizationIssue(
  editing: FilterStateEditingOptions,
  declaration: FilterDeclaration | undefined,
  value: FilterValue | null | undefined,
  now?: Date,
): string | undefined {
  if (!editing.finalizationDates || value?.type !== 'timeRange') return;
  return finalizationMonthIssue(declaration, value.selection, editing.finalizationDates(), now);
}

export function normalizeWithFinalization(
  editing: FilterStateEditingOptions,
  value: FilterValue | null,
  declaration: FilterDeclaration | undefined,
  now?: Date,
): FilterValue | null | undefined {
  const normalized = normalizeFilterValue(value, declaration, now);
  return finalizationIssue(editing, declaration, normalized, now) ? undefined : normalized;
}

/** 空值集合等同不筛选,归一为清除,保持 URL 与状态干净 */
export function normalizeFilterValue(
  value: FilterValue | null,
  declaration?: FilterDeclaration,
  now = new Date(),
): FilterValue | null | undefined {
  if (invalidDeclaredValue(value, declaration)) return undefined;
  if (declaration?.type === 'timeRange' && declaration.display === 'modes') {
    return normalizeMode(value, declaration, now);
  }
  if (declaration?.type === 'timeRange' && declaration.display === 'period') {
    return normalizePeriod(value, declaration, now);
  }
  const accepted = normalizeDeclaredDate(value, declaration, now);
  if (accepted === undefined || accepted === null) return accepted;
  if (accepted.type === 'dimension' && declaration?.type === 'dimension') {
    return normalizeDimension(accepted, declaration);
  }
  return normalizeValue(accepted);
}

export function initializeFilterValues(
  initial: FilterValues | undefined,
  declarations: readonly FilterDeclaration[],
  byId: ReadonlyMap<string, FilterDeclaration>,
  dimensionOptions: ReadonlyMap<string, readonly string[]>,
  editing: FilterStateEditingOptions,
): Map<string, FilterValue> {
  const current = new Map<string, FilterValue>();
  for (const [id, value] of initial ?? []) {
    const declaration = byId.get(id);
    const timed = declaration?.type === 'timeRange' || declaration?.type === 'timePoint';
    if (declarations.length && (!declaration || !matchesDeclaration(value, declaration))) {
      throw new Error(`筛选器 ${id} 初值不符合声明`);
    }
    const valid = normalizeWithFinalization(editing, value, declaration, editing.now?.());
    if (valid === undefined || (timed && !valid)) {
      throw new Error(`筛选器 ${id} 初值不符合时间边界`);
    }
    if (!acceptedDimensionOption(dimensionOptions, id, valid)) {
      throw new Error(`筛选按钮组器 ${id} 初值不在候选项中`);
    }
    if (valid) current.set(id, valid);
  }
  validateInitialRanges(declarations, current);
  return current;
}

export function applyLinkedDefaults(
  declarations: readonly FilterDeclaration[],
  current: FilterValues,
  normalized: Map<string, FilterValue | null>,
): void {
  for (const declaration of declarations) {
    if (!isConditionalDimension(declaration) || normalized.has(declaration.id)) continue;
    const driver = declaration.defaultWhen.filter;
    const next = normalized.get(driver);
    if (next === undefined || sameFilterValue(current.get(driver), next)) continue;
    const defaults = matchingDimensionDefault(
      declaration,
      next?.type === 'dimension' ? next.values : undefined,
    );
    normalized.set(
      declaration.id,
      defaults
        ? { type: 'dimension', dimension: declaration.dimension, values: [...defaults] }
        : null,
    );
  }
}

export function sameFilterValue(a: FilterValue | undefined, b: FilterValue | null): boolean {
  if (!a || !b) return !a && !b;
  if (a.type !== b.type) return false;
  if (a.type === 'dimension' && b.type === 'dimension') {
    return (
      a.dimension === b.dimension &&
      a.level === b.level &&
      a.values.length === b.values.length &&
      a.values.every((v, i) => v === b.values[i])
    );
  }
  return sameScalarValue(a, b);
}

export function matchesDeclaration(value: FilterValue, declaration: FilterDeclaration): boolean {
  if (value.type !== declaration.type) return false;
  if (value.type === 'dimension' && declaration.type === 'dimension') {
    return dimensionMatchesDeclaration(value, declaration);
  }
  if (value.type === 'timePoint' && declaration.type === 'timePoint') {
    return value.granularity === declaration.granularity;
  }
  if (value.type === 'boolean') return typeof value.value === 'boolean';
  if (value.type === 'search') return typeof value.query === 'string';
  if (value.type === 'numberRange') {
    return (
      (value.from === undefined || typeof value.from === 'number') &&
      (value.to === undefined || typeof value.to === 'number')
    );
  }
  return true;
}

function validateInitialRanges(
  declarations: readonly FilterDeclaration[],
  current: ReadonlyMap<string, FilterValue>,
): void {
  for (const declaration of declarations) {
    if (
      declaration.type === 'numberRange' &&
      current.has(declaration.id) &&
      rangeContextIssue(declaration, current)
    ) {
      throw new Error('金额币种初值未通过校验');
    }
  }
}

function normalizePeriod(
  value: FilterValue | null,
  declaration: Extract<FilterDeclaration, { type: 'timeRange' }>,
  now: Date,
): FilterValue | undefined {
  if (value?.type !== 'timeRange' || !isPeriodSelection(value.selection)) return undefined;
  if (timeFilterBoundaryError(declaration, value, now)) return undefined;
  try {
    const resolved = resolvePeriodSelection(
      value.selection,
      now,
      declaration.precision === 'month' ? 'month' : 'date',
    );
    if (
      value.selection.mode !== 'last12Months' &&
      (resolved.from !== value.from || resolved.to !== value.to)
    ) {
      return undefined;
    }
    return { type: 'timeRange', ...resolved };
  } catch {
    return undefined;
  }
}

function normalizeDeclaredDate(
  value: FilterValue | null,
  declaration: FilterDeclaration | undefined,
  now: Date,
): FilterValue | null | undefined {
  if (declaration?.type === 'timePoint') return normalizeBoundedPoint(value, declaration, now);
  if (declaration?.type === 'timeRange') return normalizeDeclaredRange(value, declaration, now);
  return value;
}

function normalizeBoundedPoint(
  value: FilterValue | null,
  declaration: Extract<FilterDeclaration, { type: 'timePoint' }>,
  now: Date,
): FilterValue | null | undefined {
  if (!value) return declaration.required ? undefined : null;
  if (value.type !== 'timePoint' || value.granularity !== declaration.granularity) return undefined;
  return validateTimePointValue(
    value.value,
    declaration.granularity,
    declaration.min,
    declaration.disableFuture !== false,
    now,
  )
    ? undefined
    : value;
}

function normalizeDeclaredRange(
  value: FilterValue | null,
  declaration: Extract<FilterDeclaration, { type: 'timeRange' }>,
  now: Date,
): FilterValue | null | undefined {
  if (!value) return declaration.required ? undefined : null;
  if (
    value.type !== 'timeRange' ||
    validateCalendarTimeRange(value, declaration.precision).length ||
    timeFilterBoundaryError(declaration, value, now)
  ) {
    return undefined;
  }
  return value;
}

function normalizeValue(value: FilterValue): FilterValue | null | undefined {
  if (value.type === 'dimension' && value.values.length === 0) return null;
  if (value.type === 'timeRange' && validateCalendarTimeRange(value).length > 0) return undefined;
  if (value.type === 'timePoint') {
    return validateTimePointValue(value.value, value.granularity) ? undefined : value;
  }
  if (value.type === 'search') return value.query.trim() === '' ? null : value;
  if (value.type === 'numberRange') return normalizeNumberRange(value);
  return value;
}

function normalizeNumberRange(
  value: Extract<FilterValue, { type: 'numberRange' }>,
): FilterValue | null | undefined {
  if (value.from === undefined && value.to === undefined) return null;
  if (
    value.from !== undefined &&
    value.to !== undefined &&
    (value.from > value.to || !Number.isFinite(value.from) || !Number.isFinite(value.to))
  ) {
    return undefined;
  }
  if (value.from !== undefined && !Number.isFinite(value.from)) return undefined;
  if (value.to !== undefined && !Number.isFinite(value.to)) return undefined;
  return value;
}

function normalizeMode(
  value: FilterValue | null,
  declaration: Extract<FilterDeclaration, { type: 'timeRange' }>,
  now: Date,
): FilterValue | undefined {
  if (
    value?.type !== 'timeRange' ||
    modeRangeIssue(declaration, value) ||
    timeFilterBoundaryError(declaration, value, now)
  ) {
    return undefined;
  }
  return value;
}

function normalizeDimension(
  value: Extract<FilterValue, { type: 'dimension' }>,
  declaration: Extract<FilterDeclaration, { type: 'dimension' }>,
): FilterValue | null | undefined {
  if (declaration.hierarchy) {
    const level = value.level ?? declaration.defaultLevel ?? declaration.hierarchy[0]?.id;
    if (!declaration.hierarchy.some((item) => item.id === level)) return undefined;
    return { ...value, level, dimension: dimensionOfLevel(declaration, level) };
  }
  if (value.level !== undefined) return undefined;
  return !value.values.length && declaration.treeSelection !== 'level' && !declaration.defaultWhen
    ? null
    : value;
}

function invalidDeclaredValue(
  value: FilterValue | null,
  declaration: FilterDeclaration | undefined,
): boolean {
  if (value && !validShape(value)) return true;
  if (
    declaration?.type === 'numberRange' &&
    value?.type === 'numberRange' &&
    numberRangeIssue(declaration, value)
  ) {
    return true;
  }
  return (
    declaration?.type === 'dimension' &&
    !!dimensionSelectionIssue(declaration, value?.type === 'dimension' ? value.values : [])
  );
}

function validShape(value: FilterValue): boolean {
  switch (value.type) {
    case 'dimension':
      return validDimensionShape(value);
    case 'timeRange':
      return (
        typeof value.from === 'string' &&
        typeof value.to === 'string' &&
        (value.selection === undefined || isPeriodSelection(value.selection))
      );
    case 'timePoint':
      return typeof value.value === 'string' && ['date', 'month'].includes(value.granularity);
    case 'boolean':
      return typeof value.value === 'boolean';
    case 'search':
      return typeof value.query === 'string';
    case 'numberRange':
      return (
        (value.from === undefined || typeof value.from === 'number') &&
        (value.to === undefined || typeof value.to === 'number')
      );
    default:
      return false;
  }
}

function validDimensionShape(value: Extract<FilterValue, { type: 'dimension' }>): boolean {
  return (
    typeof value.dimension === 'string' &&
    Array.isArray(value.values) &&
    value.values.every((item) => typeof item === 'string') &&
    (value.level === undefined || typeof value.level === 'string')
  );
}

function dimensionMatchesDeclaration(
  value: Extract<FilterValue, { type: 'dimension' }>,
  declaration: Extract<FilterDeclaration, { type: 'dimension' }>,
): boolean {
  if (!Array.isArray(value.values) || !value.values.every((item) => typeof item === 'string')) {
    return false;
  }
  if (declaration.hierarchy) {
    const level = declaration.hierarchy.find((item) => item.id === value.level);
    return !!level && level.dimension === value.dimension;
  }
  return value.dimension === declaration.dimension && value.level === undefined;
}

function sameScalarValue(a: FilterValue, b: FilterValue): boolean {
  if (a.type === 'timeRange' && b.type === 'timeRange') return sameTimeRange(a, b);
  if (a.type === 'timePoint' && b.type === 'timePoint') {
    return a.granularity === b.granularity && a.value === b.value;
  }
  if (a.type === 'boolean' && b.type === 'boolean') return a.value === b.value;
  if (a.type === 'search' && b.type === 'search') return a.query === b.query;
  if (a.type === 'numberRange' && b.type === 'numberRange') {
    return a.from === b.from && a.to === b.to;
  }
  return false;
}

function sameTimeRange(
  a: Extract<FilterValue, { type: 'timeRange' }>,
  b: Extract<FilterValue, { type: 'timeRange' }>,
): boolean {
  return (
    a.from === b.from &&
    a.to === b.to &&
    JSON.stringify(a.selection) === JSON.stringify(b.selection) &&
    a.mode === b.mode
  );
}
