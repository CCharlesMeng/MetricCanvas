import {
  type FilterValue,
  type FilterValues,
  initialFilterValues,
} from '@metriccanvas/data-execution/runtime';
import {
  dimensionOfLevel,
  type FilterDeclaration,
  filterURLKeys,
  isPeriodSelection,
  modeRangeIssue,
  type PeriodSelection,
  readLevelURLSelection,
  resolvePeriodSelection,
  rollingFinalizationName,
  type TimeMode,
  timeFilterBoundaryError,
  validateCalendarTimeRange,
  validateTimePointValue,
} from '@metriccanvas/page/internal';
import {
  acceptedDimensionOption,
  finalizationIssue,
  isConditionalDimension,
  normalizeFilterValue,
} from './normalize';
import type { FilterStoreContext } from './types';

type ReadURLPart = (part: string) => string | null;

/** 类型只来自接收页面声明，不从字符串前缀或参数内容猜测。 */
export function parseFilterSearch(
  search: string,
  declarations: readonly FilterDeclaration[],
  now = new Date(),
  iocRegion = false,
): FilterValues {
  const query = new URLSearchParams(stripQuestionMark(search));
  const result = new Map<string, FilterValue>();
  for (const declaration of declarations) {
    const keys = filterURLKeys(declaration, iocRegion);
    const read: ReadURLPart = (part) => (keys[part] ? query.get(keys[part]!) : null);
    if (declaration.type === 'timeRange' && declaration.display === 'modes') {
      const value = readModeFilter(declaration, query, keys, read);
      if (value) result.set(declaration.id, value);
      continue;
    }
    if (declaration.type === 'timeRange' && declaration.display === 'period') {
      const period = readPeriodFilter(declaration, read, now);
      if (period) result.set(declaration.id, period);
      continue;
    }
    const value = readFilterValue(declaration, query, keys, read, now);
    if (!value) continue;
    const valid = normalizeFilterValue(value, declaration, now);
    if (valid) result.set(declaration.id, valid);
  }
  return result;
}

/** A mode-only URL requests the destination's cutoff. Full windows are applied snapshots. */
export function requestsRollingFinalization(
  declaration: FilterDeclaration,
  query: URLSearchParams,
): boolean {
  if (!rollingFinalizationName(declaration)) return false;
  const { value, from, to } = filterURLKeys(declaration);
  return query.get(value!) === 'last12Months' && !query.has(from!) && !query.has(to!);
}

export function hasExplicitDimensionClear(
  declaration: FilterDeclaration,
  query: URLSearchParams,
  key: string,
): boolean {
  if (!isConditionalDimension(declaration)) return false;
  const values = query.getAll(key);
  return values.length === 1 && values[0] === '';
}

export function filterSearch(
  values: FilterValues,
  declarations: readonly FilterDeclaration[] = [],
  iocRegion = false,
): string {
  const query = new URLSearchParams();
  for (const [id, value] of values) {
    const declaration = declarations.find((d) => d.id === id);
    const keys = declaration
      ? filterURLKeys(declaration, iocRegion)
      : { value: id, from: `${id}.from`, to: `${id}.to`, level: `${id}.level` };
    appendFilterValueURL(query, id, keys, value, declaration);
  }
  return query.toString();
}

export function requiresURLFallback(declaration: FilterDeclaration): boolean {
  return (
    !!(
      declaration.type === 'timeRange' &&
      (declaration.display === 'period' || declaration.required)
    ) ||
    !!(
      declaration.type === 'timePoint' &&
      (declaration.min !== undefined || declaration.disableFuture !== false) &&
      declaration.required
    )
  );
}

export function resolveURLRestoreValues(
  ctx: FilterStoreContext,
  search: string,
  declarations: readonly FilterDeclaration[],
): Map<string, FilterValue> {
  for (const declaration of declarations) ctx.byId.set(declaration.id, declaration);
  const next = new Map(
    parseFilterSearch(search, declarations, ctx.editing.now?.(), ctx.editing.iocRegion),
  );
  for (const declaration of declarations) {
    const local = ctx.current.get(declaration.id);
    if (declaration.urlParams === false && local) next.set(declaration.id, local);
  }
  restoreMissingDates(ctx, next, declarations);
  restoreSingleSelections(ctx, next, declarations, search);
  restoreDimensionOptions(ctx, next);
  for (const [id, value] of initialFilterValues(
    declarations.filter(isConditionalDimension),
    ctx.editing.now?.(),
    undefined,
    undefined,
    undefined,
    next,
  )) {
    next.set(id, value);
  }
  return next;
}

function stripQuestionMark(search: string): string {
  return search.startsWith('?') ? search.slice(1) : search;
}

function appendFilterValueURL(
  query: URLSearchParams,
  id: string,
  keys: Record<string, string>,
  value: FilterValue,
  declaration: FilterDeclaration | undefined,
): void {
  const put = (part: string, item: string | number | boolean | undefined) => {
    if (item !== undefined && keys[part]) query.append(keys[part]!, String(item));
  };
  if (value.type === 'dimension') {
    appendDimensionURL(query, keys, value, declaration);
  } else if (value.type === 'timeRange' && value.mode) {
    query.set(`${id}.mode`, value.mode);
    query.set(keys.from!, value.from);
    query.set(keys.to!, value.to);
  } else if (
    value.type === 'timeRange' &&
    value.selection &&
    declaration?.type === 'timeRange' &&
    declaration.display === 'period'
  ) {
    appendPeriodURL(value, put);
  } else if (value.type === 'timeRange' || value.type === 'numberRange') {
    put('from', value.from);
    put('to', value.to);
  } else if (value.type === 'search') {
    put('value', value.query);
  } else {
    put('value', value.value);
  }
}

function appendDimensionURL(
  query: URLSearchParams,
  keys: Record<string, string>,
  value: Extract<FilterValue, { type: 'dimension' }>,
  declaration?: FilterDeclaration,
): void {
  const levelKey = value.level === undefined ? undefined : keys[`node/${value.level}`];
  const valueKey = levelKey ?? keys.value;
  if (valueKey) {
    for (const item of value.values) query.append(valueKey, item);
  }
  if (valueKey && !value.values.length && isConditionalDimension(declaration)) {
    query.append(valueKey, '');
  }
  if ((!levelKey || value.values.length === 0) && value.level !== undefined && keys.level) {
    query.append(keys.level, value.level);
  }
}

function appendPeriodURL(
  value: Extract<FilterValue, { type: 'timeRange' }>,
  put: (part: string, item: string) => void,
): void {
  const selection = value.selection!;
  put(
    'value',
    selection.mode === 'last12Months' ? 'last12Months' : `${selection.mode}:${selection.value}`,
  );
  if (selection.mode === 'last12Months' && selection.anchor) {
    put('from', value.from);
    put('to', value.to);
  }
}

function readFilterValue(
  declaration: FilterDeclaration,
  query: URLSearchParams,
  keys: ReturnType<typeof filterURLKeys>,
  read: ReadURLPart,
  now: Date,
): FilterValue | undefined {
  switch (declaration.type) {
    case 'dimension':
      return readDimensionFilter(declaration, query, keys, read);
    case 'timeRange': {
      const from = read('from');
      const to = read('to');
      if (!from || !to || validateCalendarTimeRange({ from, to }, declaration.precision).length) {
        return;
      }
      return { type: 'timeRange', from, to };
    }
    case 'numberRange': {
      const from = read('from');
      const to = read('to');
      return {
        type: 'numberRange',
        ...(from?.trim() ? { from: Number(from) } : {}),
        ...(to?.trim() ? { to: Number(to) } : {}),
      };
    }
    case 'timePoint':
      return readPointFilter(declaration, read, now);
    case 'boolean': {
      const raw = read('value');
      if (raw !== 'true' && raw !== 'false') return;
      return { type: 'boolean', value: raw === 'true' };
    }
    default: {
      const raw = read('value');
      return raw?.trim() ? { type: 'search', query: raw } : undefined;
    }
  }
}

function readDimensionFilter(
  declaration: Extract<FilterDeclaration, { type: 'dimension' }>,
  query: URLSearchParams,
  keys: ReturnType<typeof filterURLKeys>,
  read: ReadURLPart,
): FilterValue | undefined {
  const selected = readLevelURLSelection(keys, query);
  if (selected) {
    return selected.value.trim()
      ? {
          type: 'dimension',
          values: [selected.value],
          level: selected.level,
          dimension: dimensionOfLevel(declaration, selected.level),
        }
      : undefined;
  }
  const valueKey = keys.value;
  if (!valueKey) return;
  const values = query.getAll(valueKey).filter((v) => v !== '');
  if (
    !values.length &&
    !(declaration.hierarchy && read('level')) &&
    !hasExplicitDimensionClear(declaration, query, valueKey)
  ) {
    return;
  }
  const level = read('level') ?? declaration.defaultLevel ?? declaration.hierarchy?.[0]?.id;
  if (level && declaration.hierarchy && !declaration.hierarchy.some((l) => l.id === level)) {
    return;
  }
  return {
    type: 'dimension',
    values,
    dimension: dimensionOfLevel(declaration, level),
    ...(level ? { level } : {}),
  };
}

function readPointFilter(
  declaration: Extract<FilterDeclaration, { type: 'timePoint' }>,
  read: ReadURLPart,
  now: Date,
): FilterValue | undefined {
  const raw = read('value');
  if (
    !raw ||
    validateTimePointValue(
      raw,
      declaration.granularity,
      declaration.min,
      declaration.disableFuture !== false,
      now,
    )
  ) {
    return;
  }
  return { type: 'timePoint', granularity: declaration.granularity, value: raw };
}

function readPeriodFilter(
  declaration: Extract<FilterDeclaration, { type: 'timeRange' }>,
  read: ReadURLPart,
  now: Date,
): FilterValue | undefined {
  const raw = read('value');
  if (!raw) return;
  const split = raw.indexOf(':');
  const selection =
    split < 0 ? { mode: raw } : { mode: raw.slice(0, split), value: raw.slice(split + 1) };
  if (!isPeriodSelection(selection)) return;
  if (selection.mode !== 'last12Months' && selection.value === undefined) return;
  try {
    const range = explicitPeriodRange(
      selection,
      read,
      now,
      declaration.precision === 'month' ? 'month' : 'date',
    );
    if (!range) return;
    const value = { type: 'timeRange' as const, ...range };
    if (!timeFilterBoundaryError(declaration, value, now)) return value;
  } catch {
    /* An invalid URL value does not replace a declared value. */
  }
}

function readModeFilter(
  declaration: Extract<FilterDeclaration, { type: 'timeRange' }>,
  query: URLSearchParams,
  keys: ReturnType<typeof filterURLKeys>,
  read: ReadURLPart,
): FilterValue | undefined {
  const mode = query.get(`${declaration.id}.mode`);
  const from = read('from');
  const to = read('to');
  if (!mode && !from && !to) return;
  if (
    !mode ||
    !from ||
    !to ||
    query.getAll(`${declaration.id}.mode`).length !== 1 ||
    query.getAll(keys.from!).length !== 1 ||
    query.getAll(keys.to!).length !== 1 ||
    modeRangeIssue(declaration, { mode: mode as TimeMode, from, to })
  ) {
    throw new Error('模式URL须为合法完整mode/from/to');
  }
  return { type: 'timeRange', mode: mode as TimeMode, from, to };
}

function explicitPeriodRange(
  selection: PeriodSelection,
  read: ReadURLPart,
  now: Date,
  precision: 'month' | 'date',
) {
  const from = read('from');
  const to = read('to');
  if (selection.mode !== 'last12Months' || (from === null && to === null)) {
    return resolvePeriodSelection(selection, now, precision);
  }
  if (!from || !to) return;
  const resolved = resolvePeriodSelection(
    { mode: 'last12Months', anchor: to.slice(0, 7) },
    now,
    precision,
  );
  if (resolved.from === from && resolved.to === to) return resolved;
}

function restoreMissingDates(
  ctx: FilterStoreContext,
  next: Map<string, FilterValue>,
  declarations: readonly FilterDeclaration[],
): void {
  for (const declaration of declarations) {
    if (!requiresURLFallback(declaration)) continue;
    const now = ctx.editing.now?.();
    const value = next.get(declaration.id);
    if (value && !finalizationIssue(ctx.editing, declaration, value, now)) continue;
    next.delete(declaration.id);
    if (ctx.preparation.has(declaration.id)) continue;
    const fallback =
      ctx.current.get(declaration.id) ??
      initialFilterValues(
        [declaration],
        now,
        undefined,
        undefined,
        ctx.editing.finalizationDates?.(),
      ).get(declaration.id);
    if (fallback) next.set(declaration.id, fallback);
  }
}

function restoreSingleSelections(
  ctx: FilterStoreContext,
  next: Map<string, FilterValue>,
  declarations: readonly FilterDeclaration[],
  search: string,
): void {
  const query = new URLSearchParams(stripQuestionMark(search));
  for (const declaration of declarations) {
    if (declaration.type !== 'dimension' || declaration.selection?.mode !== 'single') continue;
    const keys = filterURLKeys(declaration, ctx.editing.iocRegion);
    if (!keys.value || readLevelURLSelection(keys, query)) continue;
    if (query.getAll(keys.value).filter(Boolean).length <= 1) continue;
    const fallback =
      ctx.current.get(declaration.id) ?? initialFilterValues([declaration]).get(declaration.id);
    if (fallback) next.set(declaration.id, fallback);
  }
}

function restoreDimensionOptions(ctx: FilterStoreContext, next: Map<string, FilterValue>): void {
  for (const id of ctx.dimensionOptions.keys()) {
    if (acceptedDimensionOption(ctx.dimensionOptions, id, next.get(id))) continue;
    const declaration = ctx.byId.get(id);
    const fallback =
      ctx.current.get(id) ?? (declaration ? initialFilterValues([declaration]).get(id) : undefined);
    if (fallback) next.set(id, fallback);
  }
}
