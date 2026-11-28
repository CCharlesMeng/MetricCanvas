import type { FilterValue } from '@metriccanvas/data-execution/runtime';
import {
  type FilterDeclaration,
  filterDependencies,
  filterExecutionDependencies,
  overriddenFilterIds,
  supportsUnrestrictedFilterClear,
  timeAvailabilityIssue,
} from '@metriccanvas/page/internal';
import type { CandidateStatus, FilterStoreContext } from './types';

export function resolveUnrestrictedFilterClear(editing: {
  unrestrictedFilterClear?: boolean;
  schemaVersion?: string;
}): boolean {
  return editing.unrestrictedFilterClear ?? supportsUnrestrictedFilterClear(editing.schemaVersion);
}

export function reconcilesByIntersection(declaration: FilterDeclaration, parent: string): boolean {
  return (
    declaration.type === 'dimension' &&
    declaration.candidateContext?.reconcile === 'intersection' &&
    !declaration.clearOnChangeOf?.includes(parent)
  );
}

export function needsClearConfirmation(
  ctx: FilterStoreContext,
  declaration: FilterDeclaration,
): boolean {
  if (
    !ctx.skipUnrestrictedClearConfirmation ||
    ctx.current.has(declaration.id) ||
    ctx.dimensionOptions.has(declaration.id)
  ) {
    return true;
  }
  if (declaration.type === 'numberRange') return false;
  return (
    declaration.type !== 'dimension' || !!declaration.selection?.required || !!declaration.hierarchy
  );
}

export function invalidateDependents(
  ctx: FilterStoreContext,
  changed: readonly string[],
  normalized: Map<string, FilterValue | null>,
  trusted: boolean,
): void {
  const queue = [...changed];
  const visited = new Set<string>();
  for (const parent of queue) {
    for (const declaration of ctx.declarations) {
      if (!filterDependencies(declaration).includes(parent)) continue;
      if (!visited.has(declaration.id)) {
        visited.add(declaration.id);
        queue.push(declaration.id);
      }
      ctx.receipts.delete(declaration.id);
      if (ctx.exclusions.has(declaration.id)) continue;
      if (reconcilesByIntersection(declaration, parent)) {
        if (!normalized.has(declaration.id)) ctx.intersections.add(declaration.id);
        continue;
      }
      const interruptedIntersection = ctx.intersections.delete(declaration.id);
      if (trusted || normalized.has(declaration.id)) continue;
      normalized.set(declaration.id, null);
      if (interruptedIntersection || needsClearConfirmation(ctx, declaration)) {
        ctx.confirmation.add(declaration.id);
      }
    }
  }
}

export function computeBlockedFilters(ctx: FilterStoreContext): Set<string> {
  const result = new Set([...ctx.confirmation, ...ctx.preparation]);
  for (const declaration of ctx.declarations) {
    if (
      timeAvailabilityIssue(
        declaration,
        ctx.current.get(declaration.id),
        ctx.editing.displayInputs?.(),
        ctx.revision,
      ) ||
      ((declaration.type === 'timeRange' || declaration.type === 'timePoint') &&
        declaration.required &&
        !ctx.current.has(declaration.id))
    ) {
      result.add(declaration.id);
    }
  }
  blockDimensions(ctx, result);
  return propagateBlockedFilters(
    result,
    ctx.declarations,
    overriddenFilterIds(ctx.declarations, ctx.current),
  );
}

export function propagateBlockedFilters(
  blocked: ReadonlySet<string>,
  declarations: readonly FilterDeclaration[],
  overridden: ReadonlySet<string>,
): Set<string> {
  const result = new Set([...blocked].filter((id) => !overridden.has(id)));
  const queue = [...result];
  for (const parent of queue) {
    for (const declaration of declarations) {
      if (
        overridden.has(declaration.id) ||
        result.has(declaration.id) ||
        !filterExecutionDependencies(declaration).includes(parent)
      ) {
        continue;
      }
      result.add(declaration.id);
      queue.push(declaration.id);
    }
  }
  return result;
}

/** An unset optional selection does not require confirmation; a lost selection does. */
export function reconcileCandidateReceipt(
  ctx: FilterStoreContext,
  filterId: string,
  values?: readonly string[],
): Map<string, FilterValue> | null {
  const selected = ctx.current.get(filterId);
  if (selected?.type !== 'dimension' || !selected.values.length) return null;
  const kept = selected.values.filter((value) => values?.includes(value));
  if (kept.length) ctx.confirmation.delete(filterId);
  else ctx.confirmation.add(filterId);
  if (kept.length === selected.values.length) return null;
  const normalized = new Map<string, FilterValue | null>([
    [filterId, kept.length ? { ...selected, values: kept } : null],
  ]);
  invalidateDependents(ctx, [filterId], normalized, false);
  const next = new Map(ctx.current);
  for (const [id, value] of normalized) {
    if (value) next.set(id, value);
    else next.delete(id);
  }
  ctx.revision++;
  return next;
}

export function applyCandidateReceipt(
  ctx: FilterStoreContext,
  filterId: string,
  status: CandidateStatus,
  values?: readonly string[],
): Map<string, FilterValue> | null {
  const previous = blockedSignature(computeBlockedFilters(ctx));
  ctx.receipts.set(filterId, { status, values });
  if (status === 'ready' && ctx.intersections.delete(filterId)) {
    const reconciled = reconcileCandidateReceipt(ctx, filterId, values);
    if (reconciled) return reconciled;
  }
  if (blockedSignature(computeBlockedFilters(ctx)) !== previous) {
    return new Map(ctx.current);
  }
  return null;
}

function blockedSignature(blocked: ReadonlySet<string>): string {
  return [...blocked].sort().join('\0');
}

function blockDimensions(ctx: FilterStoreContext, result: Set<string>): void {
  for (const declaration of ctx.declarations) {
    const selected = ctx.current.get(declaration.id);
    if (declaration.type !== 'dimension') continue;
    if (
      declaration.selection?.required &&
      (selected?.type !== 'dimension' || selected.values.length === 0)
    ) {
      result.add(declaration.id);
    }
    if (ctx.intersections.has(declaration.id)) result.add(declaration.id);
    blockCandidate(ctx, declaration, selected, result);
  }
}

function blockCandidate(
  ctx: FilterStoreContext,
  declaration: Extract<FilterDeclaration, { type: 'dimension' }>,
  selected: FilterValue | undefined,
  result: Set<string>,
): void {
  if (ctx.exclusions.has(declaration.id)) return;
  if (!ctx.editing.candidates || ctx.dimensionOptions.has(declaration.id) || declaration.options) {
    return;
  }
  const receipt = ctx.receipts.get(declaration.id);
  if (requiresCandidateReceipt(declaration) && receipt?.status !== 'ready') {
    result.add(declaration.id);
  }
  if (selected?.type !== 'dimension' || !selected.values.length) return;
  if (
    !receipt ||
    receipt.status !== 'ready' ||
    selected.values.some((value) => !receipt.values?.includes(value))
  ) {
    result.add(declaration.id);
  }
}

function requiresCandidateReceipt(
  declaration: Extract<FilterDeclaration, { type: 'dimension' }>,
): boolean {
  return !!(declaration.candidates || declaration.candidateContext || declaration.candidateWindow);
}
