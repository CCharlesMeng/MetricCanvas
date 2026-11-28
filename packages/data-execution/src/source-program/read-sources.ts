import {
  canonicalizeJson,
  type DataSnapshot,
  type DataSource,
  declaredPaginationLimit,
  type EffectiveQuery,
  hasPeriodComparison,
  isBoundedResultSource,
  isObjectDqeItem,
  type Page,
  type PagedJoinDataSource,
  type PagedUnionDataSource,
  pagedJoinHasComparison,
  type QueryDataSource,
  queryResultDependencies,
  requiresQueryContext,
  selectQuerySource,
  snapshotCellFallbacks,
  type TableQueryView,
  tableHeaders,
} from '@metriccanvas/page/internal';
import { withAbortSignals } from '../abort-signals';
import { MIN_DQE_TIMEOUT_MS } from '../dqe-timeout';
import { bindQueryResultValues, composeEffectiveQuery } from '../effective-query';
import type { executePagedJoin } from '../paged-join/execute';
import { compilePagedJoin } from '../paged-join/plan';
import { compileUnion } from '../paged-union/plan';
import type { QueryDiagnosticContext } from '../ports';
import { preservedQueryError } from '../query-error';
import { projectCapturedQuery } from '../query-projection';
import { resolveQueryResultInputs } from '../query-result-inputs';
import { queryRowsFromPageRows } from '../query-rows';
import { rawSnapshot } from '../snapshots';
import { readRecoverableJoin } from '../table-recovery/join';
import { withTableRecovery } from '../table-recovery/read';
import { recoverUnion } from '../table-recovery/union';
import { describeExportSource } from './export-diagnostics';
import {
  checkOrdinaryRange,
  correctedPageIndex,
  fetchComplete,
  isBusinessSelection,
  SourceRangeError,
} from './range-policy';
import type { ReadContext } from './read';
import { mainTableSearch, selectSearchRows } from './slot-search';
import { readSearchExportSlot } from './slot-search-read';
import { automaticQueryPageSize } from './table-pagination';
import type { SourceRead } from './types';

export function defaultSourceView(page: Page, id: string, pageSize?: number): TableQueryView {
  const raw = page.dataSources[id]?.source;
  if (raw?.type === 'pagedJoin' || raw?.type === 'pagedUnion') {
    return {
      pageIndex: 0,
      pageSize: pageSize ?? raw.pagination.pageSize,
      sort: structuredClone(raw.ordering.default),
      predicates: [],
    };
  }
  const defaultPageSize = raw?.type === 'query' ? (declaredPaginationLimit(raw.query) ?? 20) : 20;
  return { pageIndex: 0, pageSize: pageSize ?? defaultPageSize, sort: [], predicates: [] };
}

export function readFailureMustPropagate(ctx: ReadContext, cause: unknown): boolean {
  return (
    ctx.request.signal.aborted ||
    (ctx.request.purpose === 'complete' &&
      (!ctx.request.allowPartial || cause instanceof SourceRangeError))
  );
}

function readyQueryInputs(ctx: ReadContext, source: QueryDataSource) {
  const inputLimits = new Map(ctx.limits);
  if (ctx.request.purpose === 'complete') {
    for (const id of queryResultDependencies(source)) {
      const snapshot = ctx.raw.get(id);
      if (snapshot?.status === 'ready' && snapshot.totalCount === snapshot.rows.length) {
        inputLimits.set(id, snapshot.rows.length);
      }
    }
  }
  const input = resolveQueryResultInputs(source, ctx.raw, ctx.sources, inputLimits);
  if (input.status === 'waiting') throw new Error('页面查询依赖未就绪');
  return input;
}

function objectCompleteSource(source: DataSource, query: EffectiveQuery): boolean {
  return (
    source.source.type === 'query' &&
    source.source.resultScope === 'complete' &&
    (isObjectDqeItem(query.body.dsl_list[0]) || hasPeriodComparison(source.source.query))
  );
}

function preserveBusinessWindow(ctx: ReadContext, id: string, source: DataSource): boolean {
  const { compiled, cascaded, page } = ctx.state;
  const windowed = compiled.limits.has(id) || compiled.automatic.has(id);
  if (isBusinessSelection(source, windowed)) return true;
  if (!cascaded.has(id)) return false;
  return !ctx.request.completeSources?.includes(id) || isBoundedResultSource(page.dataSources, id);
}

function requiresCompleteRead(
  ctx: ReadContext,
  preserveWindow: boolean,
  source: DataSource,
  query: EffectiveQuery,
): boolean {
  return (
    (ctx.request.purpose === 'complete' && !preserveWindow) || objectCompleteSource(source, query)
  );
}

function buildFreshQuery(
  ctx: ReadContext,
  id: string,
  source: QueryDataSource,
  view: TableQueryView,
  includePagination: boolean,
): EffectiveQuery {
  const pagination =
    includePagination && ctx.limits.has(id) ? { pagination: { limit: view.pageSize } } : {};
  return composeEffectiveQuery(
    {
      displayInputs: ctx.frozenInputs,
      filterRevision: ctx.frozenRevision,
      now: ctx.request.now,
      page: ctx.state.page,
      filters: ctx.state.page.filters,
      dataSource: source,
      ...pagination,
    },
    ctx.request.conditions,
    view.pageIndex,
    view.sort,
    tableHeaders(view.predicates),
    mainTableSearch(view.search),
  );
}

function preparedQuery(
  ctx: ReadContext,
  id: string,
  source: QueryDataSource,
  view: TableQueryView,
  values: EffectiveQuery['filterValues'],
): EffectiveQuery {
  const { page, native } = ctx.state;
  const captured = projectCapturedQuery(
    native.captured(id, ctx.request.conditions, ctx.request.queries?.get(id)),
    source,
  );
  const needsContext = requiresQueryContext(source.source.query, page.filters);
  if (captured && needsContext) {
    const expected = buildFreshQuery(ctx, id, source, view, false);
    if (canonicalizeJson(captured.body) !== canonicalizeJson(expected.body)) {
      throw Object.assign(new Error('捕获查询与已应用查询模式不匹配'), {
        code: 'DQE_QUERY_REJECTED',
      });
    }
  }
  const protectedConditions = needsContext || ctx.state.overridesSource(id, ctx.request.conditions);
  let query: EffectiveQuery;
  if (!captured) {
    query = buildFreshQuery(ctx, id, source, view, true);
  } else if (protectedConditions) {
    // Captured views may be reused; their old predicates cannot authorize a different range.
    const fresh = buildFreshQuery(ctx, id, source, view, true);
    query = {
      ...structuredClone(captured),
      body: fresh.body,
      filterValues: fresh.filterValues,
      bindingValues: fresh.bindingValues,
      tableFilters: fresh.tableFilters,
      fieldMappings: fresh.fieldMappings,
      periodAggregation: fresh.periodAggregation,
    };
  } else {
    query = structuredClone(captured);
  }
  bindQueryResultValues(query, values);
  ctx.queries.set(id, query);
  return query;
}

function completeQuerySnapshot(
  ctx: ReadContext,
  id: string,
  source: QueryDataSource,
  query: EffectiveQuery,
  diagnostics: QueryDiagnosticContext,
): Promise<DataSnapshot> {
  const comparison = hasPeriodComparison(source.source.query);
  const timeout =
    comparison && ctx.request.purpose !== 'complete'
      ? AbortSignal.timeout(MIN_DQE_TIMEOUT_MS)
      : undefined;
  return withAbortSignals([ctx.request.signal, timeout], (signal) =>
    fetchComplete(query, ctx.execution, ctx.scope, signal, diagnostics, {
      trustedComplete: source.source.resultScope === 'complete',
      describeSource: () => describeExportSource(ctx.state.page, id),
      allowPartial: !comparison && ctx.request.allowPartial,
      allowZeroTotal: !comparison && ctx.request.purpose !== 'complete',
      strictComplete: ctx.request.strictComplete,
      maxRows: ctx.request.completeReadMaxRows,
      batchSize: ctx.request.ordinaryQueryBatchSize,
    }),
  );
}

/** Never freeze provisional zero-total rows as a trusted complete initial. */
function captureConsistentInitial(
  count: number,
  total: number | undefined,
  windowed: boolean,
  pageSize: number,
  strict: boolean,
): boolean {
  if (strict && total === 0 && count > 0) return false;
  return !windowed || (total !== undefined && count === Math.min(pageSize, total));
}

function defaultQueryView(ctx: ReadContext, id: string, view: TableQueryView): boolean {
  const { compiled } = ctx.state;
  if (
    Object.keys(ctx.sources.get(id)!.fields).length !==
    Object.keys(compiled.sources.get(id)!.fields).length
  ) {
    return false;
  }
  return (
    ctx.state.defaultConditions(id, ctx.request.conditions, false) &&
    view.pageIndex === 0 &&
    !view.sort.length &&
    !view.predicates.length &&
    !view.search?.query.trim() &&
    (!compiled.limits.has(id) || view.pageSize === compiled.limits.get(id))
  );
}

function finishQueryRead(
  ctx: ReadContext,
  id: string,
  source: QueryDataSource,
  view: TableQueryView,
  snapshot: DataSnapshot,
): void {
  const { compiled } = ctx.state;
  // Embedded initials cannot identify a query branch or its raw response mapping.
  if (
    (snapshot.status === 'ready' || snapshot.status === 'empty') &&
    !source.source.query.queryModes &&
    !source.source.query.periodAggregation
  ) {
    try {
      const rows = queryRowsFromPageRows(
        snapshot.status === 'ready' ? snapshot.rows : [],
        source.fields,
      );
      // Keep inconsistent live rows visible without persisting an invalid first-page initial.
      const validInitialWindow = captureConsistentInitial(
        rows.length,
        snapshot.totalCount,
        compiled.limits.has(id),
        view.pageSize,
        isObjectDqeItem(source.source.query.body?.dsl_list[0]),
      );
      if (validInitialWindow && defaultQueryView(ctx, id, view)) {
        ctx.initials.set(id, {
          capturedAt: new Date().toISOString(),
          rows,
          ...(snapshot.totalCount === undefined ? {} : { totalCount: snapshot.totalCount }),
        });
      }
    } catch (cause) {
      snapshot = { status: 'error', error: preservedQueryError(cause) };
    }
  }
  ctx.raw.set(id, snapshot);
  const autoSize =
    compiled.automatic.has(id) && !compiled.limits.has(id)
      ? automaticQueryPageSize(source, snapshot)
      : undefined;
  if (autoSize !== undefined) {
    compiled.limits.set(id, autoSize);
    ctx.corrections.set(id, { ...view, pageSize: autoSize });
  }
}

async function executeBoundExport(
  ctx: ReadContext,
  id: string,
  source: QueryDataSource,
): Promise<boolean> {
  const bindings = selectQuerySource(source, ctx.request.conditions).source.query.resultBindings;
  if (bindings?.length !== 1) return false;
  const upstream = ctx.raw.get(bindings[0].source);
  if (upstream?.status !== 'ready') return false;
  const rows = await readSearchExportSlot(
    {
      page: ctx.state.page,
      sourceId: bindings[0].source,
      conditions: ctx.request.conditions,
      runner: ctx.execution,
      completeReadMaxRows: ctx.request.completeReadMaxRows,
      scope: `${ctx.scope}:export-slot:${id}`,
      signal: ctx.request.signal,
      now: ctx.request.now,
      displayInputs: ctx.frozenInputs,
      filterRevision: ctx.frozenRevision,
    },
    id,
    upstream.rows,
  );
  if (!rows) return false;
  ctx.raw.set(id, rawSnapshot(rows, rows.length));
  return true;
}

async function executeSlotSearch(
  ctx: ReadContext,
  id: string,
  source: QueryDataSource,
  view: TableQueryView,
  values: EffectiveQuery['filterValues'],
): Promise<boolean> {
  if (!view.search?.data || view.search.data === 'main' || !view.search.query.trim()) return false;
  const query = composeEffectiveQuery(
    {
      page: ctx.state.page,
      filters: ctx.state.page.filters,
      dataSource: source,
      now: ctx.request.now,
      displayInputs: ctx.frozenInputs,
      filterRevision: ctx.frozenRevision,
    },
    ctx.request.conditions,
    0,
    [],
    {},
  );
  bindQueryResultValues(query, values);
  const input = {
    page: ctx.state.page,
    sourceId: id,
    query,
    view,
    completeReadMaxRows: ctx.request.completeReadMaxRows,
    conditions: ctx.request.conditions,
    runner: ctx.execution,
    scope: ctx.scope,
    signal: ctx.request.signal,
    now: ctx.request.now,
    displayInputs: ctx.frozenInputs,
    filterRevision: ctx.frozenRevision,
  };
  const data = await ctx.state.slotSearch.read(input);
  if (!data) return false;
  const result = selectSearchRows(input, data, ctx.request.purpose === 'complete');
  ctx.request.signal.throwIfAborted();
  for (const [sourceId, snapshot] of result.snapshots) ctx.raw.set(sourceId, snapshot);
  if (result.pageIndex !== view.pageIndex) {
    ctx.corrections.set(id, { ...view, pageIndex: result.pageIndex });
  }
  ctx.queries.set(id, query);
  return true;
}

async function runSingleOrdinaryQuery(
  ctx: ReadContext,
  id: string,
  source: QueryDataSource,
  view: TableQueryView,
  values: EffectiveQuery['filterValues'],
): Promise<{ snapshot: DataSnapshot; resultLimit: number | undefined }> {
  let resultLimit = ctx.limits.get(id) ?? declaredPaginationLimit(source.source.query);
  let query = preparedQuery(ctx, id, source, view, values);
  const diagnostics = {
    ...ctx.state.config.diagnostics,
    pageId: ctx.state.page.id,
    dataSourceIds: [id],
  };
  const preserveWindow = preserveBusinessWindow(ctx, id, source);
  if (requiresCompleteRead(ctx, preserveWindow, source, query)) {
    resultLimit = undefined;
    const snapshot = await completeQuerySnapshot(ctx, id, source, query, diagnostics);
    return { snapshot, resultLimit };
  }
  let snapshot = await ctx.execution.run(query, diagnostics, ctx.scope, ctx.request.signal);
  const corrected = correctedPageIndex(query, snapshot);
  if (corrected !== undefined && ctx.request.purpose !== 'complete') {
    ctx.corrections.set(id, { ...view, pageIndex: corrected });
    query = { ...query, pagination: { offset: corrected * view.pageSize, limit: view.pageSize } };
    ctx.queries.set(id, query);
    snapshot = await ctx.execution.run(query, diagnostics, ctx.scope, ctx.request.signal);
  }
  return { snapshot, resultLimit };
}

export async function executeOrdinary(
  ctx: ReadContext,
  id: string,
  source: QueryDataSource,
  view: TableQueryView,
): Promise<void> {
  if (
    ctx.request.purpose === 'complete' &&
    queryResultDependencies(source).length &&
    (await executeBoundExport(ctx, id, source))
  ) {
    return;
  }
  const input = readyQueryInputs(ctx, source);
  let snapshot: DataSnapshot;
  let resultLimit = ctx.limits.get(id) ?? declaredPaginationLimit(source.source.query);
  if (input.status === 'terminal') {
    snapshot = input.snapshot;
  } else {
    if (view.search?.data && (await executeSlotSearch(ctx, id, source, view, input.values))) return;
    const outcome = await runSingleOrdinaryQuery(ctx, id, source, view, input.values);
    snapshot = outcome.snapshot;
    resultLimit = outcome.resultLimit;
  }
  ctx.request.signal.throwIfAborted();
  snapshot = checkOrdinaryRange(
    source,
    snapshot,
    resultLimit,
    {
      ...ctx.state.config.diagnostics,
      pageId: ctx.state.page.id,
      dataSourceIds: [id],
      pagination: ctx.queries.get(id)?.pagination,
    },
    {
      allowZeroTotal: ctx.request.purpose !== 'complete',
      describeSource: () => describeExportSource(ctx.state.page, id),
    },
  );
  finishQueryRead(ctx, id, source, view, snapshot);
}

function defaultJoinedView(
  ctx: ReadContext,
  id: string,
  source: PagedJoinDataSource | PagedUnionDataSource,
  applied: TableQueryView,
): boolean {
  return (
    ctx.request.purpose !== 'complete' &&
    ctx.state.defaultConditions(id, ctx.request.conditions, false) &&
    applied.pageIndex === 0 &&
    applied.pageSize === source.source.pagination.pageSize &&
    !applied.predicates.length &&
    !applied.search?.query.trim() &&
    canonicalizeJson(applied.sort) === canonicalizeJson(source.source.ordering.default)
  );
}

function captureUnionInitial(
  ctx: ReadContext,
  id: string,
  source: PagedUnionDataSource,
  view: TableQueryView,
  snapshot: DataSnapshot,
): void {
  if (
    !defaultJoinedView(ctx, id, source, view) ||
    (snapshot.status !== 'ready' && snapshot.status !== 'empty') ||
    snapshot.warnings?.length
  ) {
    return;
  }
  ctx.initials.set(id, {
    capturedAt: new Date().toISOString(),
    rows: snapshot.status === 'ready' ? snapshot.rows : [],
    ...(snapshot.status === 'ready' ? snapshotCellFallbacks(snapshot.rows) : {}),
    totalCount: snapshot.totalCount!,
    view,
  });
}

function captureJoinedResult(
  ctx: ReadContext,
  id: string,
  source: PagedJoinDataSource,
  view: TableQueryView,
  plan: ReturnType<typeof compilePagedJoin>,
  result: Awaited<ReturnType<typeof executePagedJoin>>,
): void {
  const applied = result.viewCorrection ?? plan.view;
  if (canonicalizeJson(applied) !== canonicalizeJson(view)) ctx.corrections.set(id, applied);
  if (source.compute?.length || pagedJoinHasComparison(ctx.state.page, source)) return;
  if (
    defaultJoinedView(ctx, id, source, applied) &&
    (result.snapshot.status === 'ready' || result.snapshot.status === 'empty') &&
    !result.snapshot.warnings?.length
  ) {
    ctx.initials.set(id, {
      capturedAt: new Date().toISOString(),
      rows: result.snapshot.status === 'ready' ? result.snapshot.rows : [],
      ...(result.snapshot.status === 'ready' ? snapshotCellFallbacks(result.snapshot.rows) : {}),
      totalCount: result.snapshot.totalCount!,
      view: result.viewCorrection ?? { ...view, sort: plan.view.sort },
    });
  }
}

async function executeUnion(
  ctx: ReadContext,
  id: string,
  source: PagedUnionDataSource,
  view: TableQueryView,
): Promise<void> {
  const plan = compileUnion(ctx.state.page, id, ctx.request.conditions, view, ctx.request.now);
  const complete = ctx.request.purpose === 'complete';
  const timeout = complete ? undefined : AbortSignal.timeout(MIN_DQE_TIMEOUT_MS);
  const result = await withAbortSignals([ctx.request.signal, timeout], (signal) =>
    withTableRecovery(
      () =>
        ctx.currentUnion.read(plan, ctx.scope, signal, complete, ctx.request.completeReadMaxRows),
      () =>
        recoverUnion(
          plan,
          ctx.execution,
          ctx.scope,
          signal,
          complete,
          ctx.request.completeReadMaxRows,
        ),
      signal,
    ),
  );
  const applied = result.viewCorrection ?? plan.view;
  ctx.raw.set(id, result.snapshot);
  if (canonicalizeJson(applied) !== canonicalizeJson(view)) ctx.corrections.set(id, applied);
  captureUnionInitial(ctx, id, source, applied, result.snapshot);
}

export async function executeCombined(
  ctx: ReadContext,
  id: string,
  source: PagedJoinDataSource | PagedUnionDataSource,
  view: TableQueryView,
): Promise<void> {
  try {
    if (source.source.type === 'pagedUnion') {
      await executeUnion(ctx, id, source as PagedUnionDataSource, view);
      return;
    }
    const plan = compilePagedJoin(
      ctx.state.page,
      id,
      ctx.request.conditions,
      view,
      ctx.request.now,
      {
        displayInputs: ctx.frozenInputs,
        filterRevision: ctx.frozenRevision,
      },
    );
    const onProgress =
      ctx.request.purpose !== 'complete' && ctx.request.onProgress
        ? (update: Parameters<NonNullable<SourceRead['onProgress']>>[1]) =>
            ctx.request.onProgress!(plan.sourceId, update)
        : undefined;
    const result = await readRecoverableJoin(
      plan,
      ctx.execution,
      ctx.scope,
      ctx.request.signal,
      ctx.request.purpose === 'complete',
      ctx.request.allowPartial,
      onProgress,
      ctx.request.completeReadMaxRows,
    );
    ctx.request.signal.throwIfAborted();
    ctx.raw.set(id, result.snapshot);
    captureJoinedResult(ctx, id, source as PagedJoinDataSource, view, plan, result);
  } catch (cause) {
    if (readFailureMustPropagate(ctx, cause)) throw cause;
    ctx.raw.set(id, { status: 'error', error: preservedQueryError(cause) });
  }
}
