import {
  conditionSourceIds,
  type DataSnapshot,
  type DataSource,
  type DisplayInputsSnapshot,
  type EffectiveQuery,
  isCombinedDataSource,
  type Page,
  type QueryDataSource,
  queryFilterIds,
  queryResultDependencies,
  requiresQueryContext,
  selectQuerySource,
  type TableQueryView,
} from '@metriccanvas/page/internal';
import { linkAbortSignals } from '../abort-signals';
import { createCandidateValidator } from '../candidate-validation';
import { computedSnapshots } from '../compute/snapshots';
import { composeEffectiveQuery, emptyBooleanMembership } from '../effective-query';
import { intersectQueryFilters } from '../intersect-filters';
import { preservedQueryError } from '../query-error';
import { presentationQuerySources } from '../query-projection';
import { rawSnapshot } from '../snapshots';
import { candidateQueryRunner, candidateUnionReader } from './candidate-priority';
import { executionSourceIds } from './compiler';
import { describeExportSource } from './export-diagnostics';
import {
  COMPLETE_READ_TIMEOUT_MS,
  checkOrdinaryRange,
  reportInitialWarnings,
  reusableInitialSnapshot,
} from './range-policy';
import {
  defaultSourceView,
  executeCombined,
  executeOrdinary,
  readFailureMustPropagate,
} from './read-sources';
import { ordinaryScreenProgress } from './screen-progress';
import type { ProgramState, SourceRead, SourceUpdate } from './types';

export { defaultSourceView };

export type FrozenReadRequest = Omit<SourceRead, 'now' | 'signal'> & {
  now: Date;
  signal: AbortSignal;
};

export interface ReadContext {
  state: ProgramState;
  request: FrozenReadRequest;
  frozenInputs: DisplayInputsSnapshot | undefined;
  frozenRevision: number | undefined;
  scope: string;
  execution: ReturnType<typeof candidateQueryRunner>;
  currentUnion: ReturnType<typeof candidateUnionReader>;
  candidates: ReturnType<typeof createCandidateValidator>;
  sources: Map<string, DataSource>;
  ids: Set<string>;
  raw: Map<string, DataSnapshot>;
  views: Map<string, TableQueryView>;
  queries: Map<string, EffectiveQuery>;
  initials: Map<string, SourceUpdate['initial']>;
  corrections: Map<string, TableQueryView>;
  candidateRejected: Set<string>;
  reportedErrors: Map<string, string>;
  limits: Map<string, number>;
  tasks: Map<string, Promise<void>>;
}

function readSignals(controller: AbortController, input: SourceRead): AbortSignal[] {
  return [
    controller.signal,
    ...(input.signal ? [input.signal] : []),
    ...(input.purpose === 'complete'
      ? [AbortSignal.timeout(input.completeReadTimeoutMs ?? COMPLETE_READ_TIMEOUT_MS)]
      : []),
  ];
}

function freezeReadRequest(state: ProgramState, input: SourceRead) {
  return {
    ...input,
    now: input.now ?? state.config.now ?? state.config.clock?.() ?? new Date(),
    conditions: structuredClone(new Map(input.conditions)),
    views: input.views && structuredClone(new Map(input.views)),
  };
}

function readLimits(
  state: ProgramState,
  request: FrozenReadRequest,
  views: ReadonlyMap<string, TableQueryView>,
): Map<string, number> {
  const limits = new Map(state.compiled.limits);
  for (const [id, query] of request.queries ?? []) {
    if (query.pagination) limits.set(id, query.pagination.limit);
  }
  for (const [id, view] of views) {
    if (state.compiled.limits.has(id)) limits.set(id, view.pageSize);
  }
  return limits;
}

function computeContext(request: FrozenReadRequest) {
  return {
    currentYear: request.currentYear ?? new Date().getFullYear(),
    modes: new Map(
      [...request.conditions].flatMap(([id, value]) =>
        value.type === 'dimension' ? [[id, value.values] as const] : [],
      ),
    ),
    ranges: new Map(
      [...request.conditions].flatMap(([id, value]) =>
        value.type === 'timeRange' ? [[id, { from: value.from, to: value.to }] as const] : [],
      ),
    ),
  };
}

function reportError(ctx: ReadContext, id: string, snapshot: DataSnapshot): void {
  if (snapshot.status !== 'error' || snapshot.error.code === 'DQE_CANCELLED') return;
  const fingerprint = `${snapshot.error.code}\n${snapshot.error.message}`;
  if (ctx.reportedErrors.get(id) === fingerprint) return;
  ctx.reportedErrors.set(id, fingerprint);
  console.error(`[MetricCanvas][${snapshot.error.code}] ${snapshot.error.message}`, {
    ...ctx.state.config.diagnostics,
    pageId: ctx.state.page.id,
    ...describeExportSource(ctx.state.page, id),
    ...snapshot.error,
  });
}

function reportSourceState(
  ctx: ReadContext,
  id: string,
  snapshots: ReadonlyMap<string, DataSnapshot>,
): void {
  reportError(ctx, id, ctx.raw.get(id)!);
  const deps = [...executionSourceIds(ctx.state.page, [id], ctx.sources)];
  if (deps.every((dependency) => ctx.raw.has(dependency))) {
    reportError(ctx, id, snapshots.get(id) ?? ctx.raw.get(id)!);
  }
}

function hasCandidateWindowFilter(page: Page, query: QueryDataSource['source']['query']): boolean {
  return queryFilterIds(query).some((filterId) => {
    const filter = page.filters?.find((item) => item.id === filterId);
    return filter?.type === 'dimension' && !!filter.candidateWindow;
  });
}

function untrustedSeed(ctx: ReadContext, id: string): boolean {
  const { page, slotSearch } = ctx.state;
  if (slotSearch.owns({ page }, id, ctx.request.views)) return true;
  return [...conditionSourceIds(page, id)].some((key) => {
    const source = page.dataSources[key];
    if (source?.source.type !== 'query') return false;
    const query = source.source.query;
    return (
      requiresQueryContext(query, page.filters) ||
      ctx.state.overridesSource(key, ctx.request.conditions) ||
      emptyBooleanMembership(query.filterBindings ?? {}, ctx.request.conditions) ||
      hasCandidateWindowFilter(page, query)
    );
  });
}

function removeUntrustedSeeds(ctx: ReadContext): void {
  for (const id of ctx.raw.keys()) {
    if (untrustedSeed(ctx, id)) ctx.raw.delete(id);
  }
}

function requiredSource(ctx: ReadContext, id: string): DataSource {
  const source = ctx.sources.get(id);
  if (!source) throw new Error('页面数据源不存在');
  return source;
}

function appliedSource(ctx: ReadContext, id: string, source: DataSource): DataSource {
  if (source.source.type !== 'query') return source;
  // Keep branch metadata for context guards; downstream filters need resolved raw fields.
  const applied = {
    ...source,
    fields: selectQuerySource(source as QueryDataSource, ctx.request.conditions).fields,
  };
  ctx.sources.set(id, applied);
  return applied;
}

function rejectCandidate(ctx: ReadContext, id: string, cause: unknown): void {
  if (ctx.request.signal.aborted) throw cause;
  ctx.candidateRejected.add(id);
  ctx.raw.set(id, {
    status: 'error',
    error: { ...preservedQueryError(cause), message: '筛选候选校验失败' },
  });
}

function contradictorySource(ctx: ReadContext, source: DataSource): boolean {
  if (source.source.type !== 'query') return false;
  const query = composeEffectiveQuery(
    {
      displayInputs: ctx.frozenInputs,
      filterRevision: ctx.frozenRevision,
      now: ctx.request.now,
      page: ctx.state.page,
      filters: ctx.state.page.filters,
      dataSource: source as QueryDataSource,
    },
    ctx.request.conditions,
    0,
    [],
    {},
  );
  return !intersectQueryFilters(query);
}

function sourcePreflightSnapshot(ctx: ReadContext, source: DataSource): DataSnapshot | undefined {
  try {
    if (contradictorySource(ctx, source)) return { status: 'empty', totalCount: 0 };
  } catch (cause) {
    if (readFailureMustPropagate(ctx, cause)) throw cause;
    return { status: 'error', error: preservedQueryError(cause) };
  }
}

function availableInitial(
  ctx: ReadContext,
  id: string,
  source: DataSource,
  view: TableQueryView,
): DataSnapshot | undefined {
  const { page, config, slotSearch } = ctx.state;
  if (slotSearch.owns({ page }, id, ctx.request.views)) return undefined;
  const canReuse =
    ctx.request.useInitial && ctx.state.defaultConditions(id, ctx.request.conditions);
  const initial = canReuse ? reusableInitialSnapshot(source, view, ctx.limits.has(id)) : undefined;
  if (initial) {
    return checkOrdinaryRange(source, initial, undefined, {
      ...config.diagnostics,
      pageId: page.id,
      dataSourceIds: [id],
    });
  }
  if (source.source.type === 'inline') return rawSnapshot(source.source.rows);
}

async function executeSource(ctx: ReadContext, id: string): Promise<void> {
  ctx.request.signal.throwIfAborted();
  let source = requiredSource(ctx, id);
  try {
    const preparation = ctx.state.native.ensure(id, ctx.request.conditions, ctx.request.signal);
    if (preparation) await preparation;
    if (ctx.candidates.requires(id)) {
      await ctx.candidates.verify(id, ctx.request.conditions, ctx.request.signal);
    }
  } catch (cause) {
    rejectCandidate(ctx, id, cause);
    return;
  }
  source = appliedSource(ctx, id, source);
  if (ctx.raw.has(id)) return;
  const view = ctx.views.get(id) ?? defaultSourceView(ctx.state.page, id, ctx.limits.get(id));
  const preflight = sourcePreflightSnapshot(ctx, source);
  if (preflight) {
    ctx.raw.set(id, preflight);
    return;
  }
  const initial = availableInitial(ctx, id, source, view);
  if (initial) {
    reportInitialWarnings(source, {
      ...ctx.state.config.diagnostics,
      pageId: ctx.state.page.id,
      dataSourceIds: [id],
    });
    ctx.raw.set(id, initial);
    return;
  }
  const missing = queryResultDependencies(source).filter((depId) => !ctx.raw.has(depId));
  if (missing.length) await Promise.all(missing.map((depId) => runSourceTask(ctx, depId)));
  if (ctx.raw.has(id)) return;
  if (isCombinedDataSource(source)) {
    await executeCombined(ctx, id, source, view);
    return;
  }
  await executeOrdinary(ctx, id, source as QueryDataSource, view);
}

function runSourceTask(ctx: ReadContext, id: string): Promise<void> {
  let task = ctx.tasks.get(id);
  if (!task) {
    task = executeSource(ctx, id).catch((cause) => {
      if (
        !ctx.views.get(id)?.search?.data ||
        ctx.request.purpose === 'complete' ||
        ctx.request.signal.aborted
      ) {
        throw cause;
      }
      ctx.raw.set(id, { status: 'error', error: preservedQueryError(cause) });
    });
    ctx.tasks.set(id, task);
  }
  return task;
}

function sourceProjection(
  ctx: ReadContext,
  id: string,
  snapshots: ReadonlyMap<string, DataSnapshot>,
): DataSnapshot {
  const deps = [...executionSourceIds(ctx.state.page, [id], ctx.sources)];
  return deps.every((dependency) => ctx.raw.has(dependency))
    ? (snapshots.get(id) ?? ctx.raw.get(id)!)
    : { status: 'loading' };
}

function publishOrdinaryProgress(
  ctx: ReadContext,
  snapshots: ReadonlyMap<string, DataSnapshot>,
): void {
  if (ctx.request.purpose === 'complete' || !ctx.request.onProgress) return;
  for (const id of ctx.request.roots) {
    const status = snapshots.get(id)?.status;
    if (status === 'ready' || status === 'empty') continue;
    const progress = ordinaryScreenProgress(ctx.sources.get(id), ctx.raw.get(id), snapshots);
    if (progress) ctx.request.onProgress(id, progress);
  }
}

function createReadContext(
  state: ProgramState,
  request: FrozenReadRequest,
  frozenInputs: DisplayInputsSnapshot | undefined,
  frozenRevision: number | undefined,
  scope: string,
  execution: ReturnType<typeof candidateQueryRunner>,
  currentUnion: ReturnType<typeof candidateUnionReader>,
  candidates: ReturnType<typeof createCandidateValidator>,
): ReadContext {
  const sources = presentationQuerySources(
    state.page,
    {
      declarations: state.page.filters ?? [],
      filters: request.conditions,
      displaySnapshot: frozenInputs,
      filterRevision: frozenRevision,
    },
    request,
  );
  const ids = executionSourceIds(state.page, request.roots, sources);
  const raw = new Map(request.seeds);
  const views = new Map(request.views);
  const ctx: ReadContext = {
    state,
    request,
    frozenInputs,
    frozenRevision,
    scope,
    execution,
    currentUnion,
    candidates,
    sources,
    ids,
    raw,
    views,
    queries: new Map(),
    initials: new Map(),
    corrections: new Map(),
    candidateRejected: new Set(),
    reportedErrors: new Map(),
    limits: readLimits(state, request, views),
    tasks: new Map(),
  };
  removeUntrustedSeeds(ctx);
  return ctx;
}

function candidateMarker(ctx: ReadContext, id: string): { candidateRejected?: true } {
  return ctx.candidateRejected.has(id) ? { candidateRejected: true } : {};
}

export async function* readSourceProgram(
  state: ProgramState,
  input: SourceRead,
): AsyncGenerator<SourceUpdate> {
  const controller = new AbortController();
  const signals = readSignals(controller, input);
  const frozenRevision = input.filterRevision ?? state.config.filterRevision?.();
  const frozenInputs = structuredClone(input.displayInputs ?? state.config.displayInputs?.());
  const now = input.now ?? state.config.now ?? state.config.clock?.() ?? new Date();
  input.signal?.throwIfAborted();
  const candidateScope = state.candidateSession.capture({
    displayInputs: frozenInputs,
    filterRevision: frozenRevision,
    now,
  });
  const frozen = freezeReadRequest(state, { ...input, now });
  const execution = candidateQueryRunner(state.runner, frozen.background);
  const currentUnion = candidateUnionReader(state.union, execution, frozen.background);
  const candidates = createCandidateValidator(state.page, candidateScope.gateway, {
    displayInputs: () => frozenInputs,
    filterRevision: () => frozenRevision ?? 0,
    now: frozen.now,
  });
  const scope = state.sourceReadScope(frozen.freshness, frozenInputs);
  const linked = linkAbortSignals([...signals, candidateScope.signal]);
  const request: FrozenReadRequest = { ...frozen, signal: linked.signal };
  try {
    const ctx = createReadContext(
      state,
      request,
      frozenInputs,
      frozenRevision,
      scope,
      execution,
      currentUnion,
      candidates,
    );
    const context = computeContext(request);
    // Dependency graph execution is shared by all consumers. Stream complete source terminals.
    const pending = new Map([...ctx.ids].map((id) => [id, runSourceTask(ctx, id).then(() => id)]));
    void Promise.allSettled(pending.values());
    while (pending.size) {
      const id = await Promise.race(pending.values());
      pending.delete(id);
      request.signal.throwIfAborted();
      const all = new Map(ctx.sources);
      // Sources outside this read cannot create spurious missing-compute errors.
      for (const key of all.keys()) {
        if (!ctx.ids.has(key) && !ctx.raw.has(key)) all.delete(key);
      }
      const snapshots = computedSnapshots(all, ctx.raw, context, {
        allowZeroTotal: request.purpose !== 'complete',
      });
      publishOrdinaryProgress(ctx, snapshots);
      reportSourceState(ctx, id, snapshots);
      yield {
        ...candidateMarker(ctx, id),
        sourceId: id,
        snapshot: sourceProjection(ctx, id, snapshots),
        raw: ctx.raw.get(id)!,
        initial: ctx.initials.get(id),
        viewCorrection: ctx.corrections.get(id),
        query: ctx.queries.get(id),
      };
    }
    // Raw success can precede compute dependencies. Publish final projections after all settle.
    const finalSources = new Map(
      [...ctx.sources].filter(([id]) => ctx.ids.has(id) || ctx.raw.has(id)),
    );
    const final = computedSnapshots(finalSources, ctx.raw, context, {
      allowZeroTotal: request.purpose !== 'complete',
    });
    for (const id of ctx.ids) {
      if (state.compiled.sources.get(id)?.compute?.length) {
        reportError(ctx, id, final.get(id)!);
        yield {
          ...candidateMarker(ctx, id),
          sourceId: id,
          snapshot: final.get(id)!,
          raw: ctx.raw.get(id)!,
        };
      }
    }
  } finally {
    controller.abort();
    linked.dispose();
    if (request.freshness === 'refresh' || scope !== state.contextScope) {
      state.runner.forgetScope(scope);
    }
  }
}
