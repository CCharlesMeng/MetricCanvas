import {
  type FilterValue,
  type FilterValues,
  initialFilterValues,
} from '@metriccanvas/data-execution/runtime';
import { type FilterDeclaration, independentExclusionFilterIds } from '@metriccanvas/page/internal';
import { applyCommitTransition } from './filter-state/commit';
import {
  applyCandidateReceipt,
  computeBlockedFilters,
  resolveUnrestrictedFilterClear,
} from './filter-state/gates';
import { initializeFilterValues } from './filter-state/normalize';
import type {
  CandidateStatus,
  CommitResult,
  CoordinatedFilterState,
  FilterCoordinator,
  FilterIntent,
  FilterState,
  FilterStateEditingOptions,
  FilterStoreContext,
} from './filter-state/types';
import {
  filterSearch,
  hasExplicitDimensionClear,
  parseFilterSearch,
  requestsRollingFinalization,
  resolveURLRestoreValues,
} from './filter-state/url';

export type {
  BooleanFilterValue,
  DimensionFilterValue,
  FilterValue,
  FilterValues,
  NumberRangeFilterValue,
  SearchFilterValue,
  TimePointFilterValue,
  TimeRangeFilterValue,
} from '@metriccanvas/data-execution/runtime';
export type { CommitResult, FilterCoordinator, FilterIntent, FilterState };
export {
  filterSearch,
  hasExplicitDimensionClear,
  initialFilterValues,
  parseFilterSearch,
  requestsRollingFinalization,
};

/**
 * 筛选状态 store:页面级共享的筛选条件集合,联动的唯一总线。
 * 筛选器写入它,query 页面数据源声明订阅它,图表点击回写它;组件间不直接连线。
 * subscribe 兼容 svelte store 契约(立即同步推送当前值),subscribe/write 永不 throw。
 */
export function createFilterState(
  initial?: FilterValues,
  declarations: readonly FilterDeclaration[] = [],
  dimensionOptions: ReadonlyMap<string, readonly string[]> = new Map(),
  editing: FilterStateEditingOptions = {},
): CoordinatedFilterState {
  const ctx = createFilterStoreContext(initial, declarations, dimensionOptions, editing);

  return {
    subscribe(run) {
      return subscribeFilterState(ctx, run);
    },
    commit(intent) {
      return commitFilterIntent(ctx, intent);
    },
    configurePage(page) {
      ctx.exclusions = independentExclusionFilterIds(page);
    },
    blocked() {
      return computeBlockedFilters(ctx);
    },
    confirmation() {
      return new Set(ctx.confirmation);
    },
    get revision() {
      return ctx.revision;
    },
    clock() {
      return new Date(ctx.operationClock);
    },
    refreshContext() {
      refreshFilterContext(ctx);
    },
    preparation() {
      return new Set(ctx.preparation);
    },
    completePreparation(values) {
      completeFilterPreparation(ctx, values);
    },
    preparing(id, pending) {
      setFilterPreparing(ctx, id, pending);
    },
    candidate(filterId, status, values) {
      applyFilterCandidate(ctx, filterId, status, values);
    },
    write(filterId, value) {
      commitFilterIntent(ctx, { type: 'applyDraft', changes: [[filterId, value]] });
    },
    writeMany(updates) {
      commitFilterIntent(ctx, { type: 'applyDraft', changes: updates });
    },
    toURL(explicitDeclarations = ctx.declarations) {
      return filterSearch(ctx.current, explicitDeclarations, ctx.editing.iocRegion);
    },
    fromURL(search, urlDeclarations) {
      restoreFilterStateFromURL(ctx, search, urlDeclarations);
    },
  };
}

/** Internal gate seam; custom legacy FilterState implementations remain valid. */
export function filterBlockedIds(state?: FilterState): ReadonlySet<string> {
  return (state as Partial<CoordinatedFilterState> | undefined)?.blocked?.() ?? new Set();
}

function createFilterStoreContext(
  initial: FilterValues | undefined,
  declarations: readonly FilterDeclaration[],
  dimensionOptions: ReadonlyMap<string, readonly string[]>,
  editing: FilterStateEditingOptions,
): FilterStoreContext {
  const byId = new Map(declarations.map((declaration) => [declaration.id, declaration]));
  const current = initializeFilterValues(initial, declarations, byId, dimensionOptions, editing);
  const baseline = new Map(current);
  const operationClock = editing.now?.() ?? new Date();
  return {
    declarations,
    byId,
    dimensionOptions,
    editing,
    skipUnrestrictedClearConfirmation: resolveUnrestrictedFilterClear(editing),
    current,
    baseline,
    revision: 0,
    operationClock,
    receipts: new Map(),
    preparation: new Set(),
    confirmation: new Set(),
    exclusions: new Set(),
    intersections: new Set(),
    subscribers: new Set(),
  };
}

/** 兑现"subscribe/write 永不 throw":单个订阅方的异常不得中断写入与其余订阅方的通知 */
function notifySubscriber(run: (values: FilterValues) => void, values: FilterValues): void {
  try {
    run(values);
  } catch (cause) {
    console.error('筛选状态订阅方回调抛出异常(已隔离):', cause);
  }
}

function replaceFilterState(ctx: FilterStoreContext, next: Map<string, FilterValue>): void {
  // 先构造新 Map 再整体替换:已推送出去的实例永不被原地修改,订阅方可安全持有与比较
  ctx.current = next;
  for (const run of ctx.subscribers) notifySubscriber(run, ctx.current);
}

function subscribeFilterState(
  ctx: FilterStoreContext,
  run: (values: FilterValues) => void,
): () => void {
  ctx.subscribers.add(run);
  notifySubscriber(run, ctx.current);
  return () => {
    ctx.subscribers.delete(run);
  };
}

function commitFilterIntent(ctx: FilterStoreContext, intent: FilterIntent): CommitResult {
  const transition = applyCommitTransition(ctx, intent);
  if (!transition.ok) return transition;
  if (transition.next) replaceFilterState(ctx, transition.next);
  return { ok: true, filterRevision: ctx.revision, changedIds: transition.changedIds };
}

function refreshFilterContext(ctx: FilterStoreContext): void {
  ctx.operationClock = ctx.editing.now?.() ?? new Date();
  replaceFilterState(ctx, new Map(ctx.current));
}

function completeFilterPreparation(ctx: FilterStoreContext, values: FilterValues): void {
  if (!ctx.preparation.size) return;
  const next = new Map(ctx.current);
  for (const [id, value] of values) {
    if (!ctx.preparation.delete(id)) continue;
    if (!ctx.current.has(id)) {
      next.set(id, value);
      ctx.baseline.set(id, value);
    }
  }
  ctx.revision++;
  replaceFilterState(ctx, next);
}

function setFilterPreparing(ctx: FilterStoreContext, filterId: string, pending: boolean): void {
  const changed = pending ? !ctx.preparation.has(filterId) : ctx.preparation.has(filterId);
  if (pending) ctx.preparation.add(filterId);
  else ctx.preparation.delete(filterId);
  if (changed) replaceFilterState(ctx, new Map(ctx.current));
}

function applyFilterCandidate(
  ctx: FilterStoreContext,
  filterId: string,
  status: CandidateStatus,
  values?: readonly string[],
): void {
  const next = applyCandidateReceipt(ctx, filterId, status, values);
  if (next) replaceFilterState(ctx, next);
}

function restoreFilterStateFromURL(
  ctx: FilterStoreContext,
  search: string,
  declarations: readonly FilterDeclaration[],
): void {
  const next = resolveURLRestoreValues(ctx, search, declarations);
  commitFilterIntent(ctx, { type: 'restore', values: next });
}
