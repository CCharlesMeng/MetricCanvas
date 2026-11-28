import type { FilterValue } from '@metriccanvas/data-execution/runtime';
import {
  type DisplayInputsSnapshot,
  rangeContextIssue,
  timeAvailabilityIssue,
} from '@metriccanvas/page/internal';
import { invalidateDependents } from './gates';
import {
  acceptedDimensionOption,
  applyLinkedDefaults,
  explicitDimensionClear,
  matchesDeclaration,
  normalizeWithFinalization,
  sameFilterValue,
} from './normalize';
import type { CommitIssue, FilterIntent, FilterStoreContext } from './types';

export type CommitTransition =
  | { ok: false; issues: Array<CommitIssue> }
  | { ok: true; changedIds: string[]; next?: Map<string, FilterValue> };

export function isEditIntent(intent: FilterIntent): boolean {
  return intent.type === 'set' || intent.type === 'clear' || intent.type === 'applyDraft';
}

export function expandIntentChanges(
  ctx: FilterStoreContext,
  intent: FilterIntent,
): ReadonlyArray<readonly [string, FilterValue | null]> {
  if (intent.type === 'set') return [[intent.filterId, intent.value]];
  if (intent.type === 'clear') return [[intent.filterId, null]];
  if (intent.type === 'applyDraft') return intent.changes;
  const source = intent.type === 'reset' ? ctx.baseline : intent.values;
  const knownIds = intent.type === 'initialize' ? [] : ctx.byId.keys();
  const ids = [...new Set([...knownIds, ...ctx.current.keys(), ...source.keys()])];
  return ids.map((id) => [id, source.get(id) ?? null] as const);
}

export function applyCommitTransition(
  ctx: FilterStoreContext,
  intent: FilterIntent,
): CommitTransition {
  const now = ctx.editing.now?.() ?? new Date();
  const facts = ctx.editing.displayInputs?.();
  const trusted = intent.type === 'initialize' || intent.type === 'restore';
  const changes = expandIntentChanges(ctx, intent);
  const issues: Array<CommitIssue> = [];
  const normalized = new Map<string, FilterValue | null>();

  normalizeIntentChanges(ctx, intent, changes, now, facts, trusted, normalized, issues);
  if (isEditIntent(intent)) applyLinkedDefaults(ctx.declarations, ctx.current, normalized);
  validateRangeContext(ctx, normalized, issues);
  if (issues.length) return { ok: false, issues };

  const map = new Map(ctx.current);
  const changed = [...normalized]
    .filter(([id, value]) => !sameFilterValue(ctx.current.get(id), value))
    .map(([id]) => id);
  const gatesChanged = reconcileCommitGates(ctx, changes, changed, normalized, trusted, map);
  const changedIds = [...new Set([...ctx.current.keys(), ...map.keys()])].filter(
    (id) => !sameFilterValue(ctx.current.get(id), map.get(id) ?? null),
  );

  if (changedIds.length || gatesChanged) {
    ctx.revision++;
    ctx.operationClock = now;
    return { ok: true, changedIds, next: map };
  }
  return { ok: true, changedIds };
}

function normalizeIntentChanges(
  ctx: FilterStoreContext,
  intent: FilterIntent,
  changes: ReadonlyArray<readonly [string, FilterValue | null]>,
  now: Date,
  facts: DisplayInputsSnapshot | undefined,
  trusted: boolean,
  normalized: Map<string, FilterValue | null>,
  issues: Array<CommitIssue>,
): void {
  const editing = isEditIntent(intent);
  for (const [id, value] of changes) {
    const declaration = ctx.byId.get(id);
    const invalid =
      (ctx.declarations.length > 0 && !declaration) ||
      (value && declaration && !matchesDeclaration(value, declaration));
    const edit = editing ? explicitDimensionClear(value, declaration) : value;
    const next = invalid
      ? undefined
      : normalizeWithFinalization(ctx.editing, edit, declaration, now);
    const availability =
      next && declaration
        ? timeAvailabilityIssue(declaration, next, facts, ctx.revision)
        : undefined;
    if (!validCommitValue(ctx, id, next, availability, trusted, invalid)) {
      issues.push({
        filterId: id,
        code: 'INVALID_FILTER_INTENT',
        message: '筛选写入不符合声明、边界或只读约束',
      });
    } else {
      normalized.set(id, next);
    }
  }
}

function validCommitValue(
  ctx: FilterStoreContext,
  id: string,
  next: FilterValue | null | undefined,
  availability: unknown,
  trusted: boolean,
  invalid: unknown,
): next is FilterValue | null {
  return !(
    availability ||
    (!trusted && ctx.editing.readOnly?.()) ||
    invalid ||
    next === undefined ||
    !acceptedDimensionOption(ctx.dimensionOptions, id, next)
  );
}

function validateRangeContext(
  ctx: FilterStoreContext,
  normalized: ReadonlyMap<string, FilterValue | null>,
  issues: Array<CommitIssue>,
): void {
  const preview = new Map(ctx.current);
  applyNormalizedEntries(preview, normalized);
  for (const declaration of ctx.declarations) {
    if (
      declaration.type === 'numberRange' &&
      preview.has(declaration.id) &&
      rangeContextIssue(declaration, preview)
    ) {
      issues.push({
        filterId: declaration.id,
        code: 'INVALID_FILTER_INTENT',
        message: '金额币种未通过校验',
      });
    }
  }
}

function reconcileCommitGates(
  ctx: FilterStoreContext,
  changes: ReadonlyArray<readonly [string, FilterValue | null]>,
  changed: readonly string[],
  normalized: Map<string, FilterValue | null>,
  trusted: boolean,
  map: Map<string, FilterValue>,
): boolean {
  let gatesChanged = false;
  clearChangedDimensionReceipts(ctx, changed, normalized);
  for (const [id] of changes) {
    if (!trusted && ctx.preparation.delete(id)) gatesChanged = true;
  }
  for (const [id] of changes) {
    if (ctx.intersections.delete(id)) gatesChanged = true;
  }
  invalidateDependents(ctx, changed, normalized, trusted);
  for (const [id] of changes) {
    if (ctx.confirmation.delete(id)) gatesChanged = true;
  }
  applyNormalizedEntries(map, normalized);
  return gatesChanged;
}

function clearChangedDimensionReceipts(
  ctx: FilterStoreContext,
  changed: readonly string[],
  normalized: ReadonlyMap<string, FilterValue | null>,
): void {
  for (const id of changed) {
    const before = ctx.current.get(id);
    const after = normalized.get(id);
    if (
      before?.type === 'dimension' &&
      after?.type === 'dimension' &&
      (before.dimension !== after.dimension || before.level !== after.level)
    ) {
      ctx.receipts.delete(id);
    }
  }
}

function applyNormalizedEntries(
  target: Map<string, FilterValue>,
  normalized: ReadonlyMap<string, FilterValue | null>,
): void {
  for (const [id, value] of normalized) {
    if (value) target.set(id, value);
    else target.delete(id);
  }
}
