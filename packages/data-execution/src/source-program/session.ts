import { isObjectDqeItem } from '@metriccanvas/page/internal';
import { intersectQueryFilters } from '../intersect-filters';
import {requiresQueryContext,requiresTimeValidation,hasQuerySelection} from '@metriccanvas/page/internal';
import {type DisplayInputsSnapshot} from '@metriccanvas/page/internal';
import {queryFilterIds} from '@metriccanvas/page/internal';
import { createCandidateValidator } from '../candidate-validation';
import { createColumnCandidatesReader, type ColumnCandidatesRead } from './column-candidates';
import { initialFilterValues } from '../filter-values';
import { compilePagedJoin } from '../paged-join/plan';
import { executePagedJoin } from '../paged-join/execute';
import { exportPagedJoin } from '../paged-join/export';
import { preservedQueryError } from '../query-error';
import { cascadeSourceIds, conditionSourceIds, canonicalizeJson, isBoundedResultSource, queryResultDependencies, tableHeaders, declaredPaginationLimit, type DataSource, type PagedJoinDataSource, type Page, type DataSnapshot, type EffectiveQuery, type TableQueryView, type QueryDataSource, type EmbeddedInitialRows } from '@metriccanvas/page/internal';
import { createQueryRunner } from '../query-runner';
import type { RuntimeDataGateway, QueryDiagnosticContext } from '../ports';
import type { FilterValues } from '../filter-values';
import { composeEffectiveQuery, bindQueryResultValues } from '../effective-query';
import { resolveQueryResultInputs } from '../query-result-inputs';
import { rawSnapshot } from '../snapshots';
import { queryRowsFromPageRows } from '../query-rows';
import { computedSnapshots } from '../compute/snapshots';
import { compileSources, executionSourceIds } from './compiler';
import { reusableInitialSnapshot, checkOrdinaryRange, isBusinessSelection, correctedPageIndex, fetchComplete, SourceRangeError } from './range-policy';
import { automaticQueryPageSize } from './table-pagination';
import { describeExportSource } from './export-diagnostics';

export interface SourceRead {
  displayInputs?:DisplayInputsSnapshot;filterRevision?:number;now?:Date;
  roots: readonly string[]; conditions: FilterValues;
  views?: ReadonlyMap<string, TableQueryView>;
  purpose?: 'screen' | 'complete'; freshness?: 'reuse' | 'refresh'; signal?: AbortSignal;
  /** Adapters may seed existing ordinary raw receipts; they never seed member roles. */
  seeds?: ReadonlyMap<string, DataSnapshot>; useInitial?: boolean;
  queries?: ReadonlyMap<string, EffectiveQuery>; completeSources?: readonly string[]; currentYear?: number;
  /** Complete report reads retain successful sources/pages when a query fails. */
  allowPartial?: boolean;
}
export interface SourceUpdate {
  sourceId: string; snapshot: DataSnapshot; raw: DataSnapshot;
  initial?: EmbeddedInitialRows | (EmbeddedInitialRows & { view: TableQueryView; totalCount: number });
  viewCorrection?: TableQueryView; query?: EffectiveQuery;
  /** Candidate/selection validation failed before any business query or initial reuse. */
  candidateRejected?: true;
}

export function defaultSourceView(page: Page, id: string, pageSize?: number): TableQueryView {
  const source = page.dataSources[id];
  return { pageIndex: 0, pageSize: pageSize ?? (source?.source.type === 'pagedJoin' ? source.source.pagination.pageSize : source?.source.type === 'query' ? declaredPaginationLimit(source.source.query) ?? 20 : 20),
    sort: source?.source.type === 'pagedJoin' ? structuredClone(source.source.ordering.default) : [], predicates: [] };
}
/** All execution policies are owned here; adapters own publication and lifecycle. */
export function createSourceProgram(page: Page, config: { gateway: RuntimeDataGateway; diagnostics?: QueryDiagnosticContext; displayInputs?: () => DisplayInputsSnapshot | undefined; filterRevision?: () => number; now?: Date; clock?: () => Date }) {
  const compiled = compileSources(page);
  for (const id of compiled.automatic) { const source = compiled.sources.get(id)!; if (source.source.type === 'query') { const size = automaticQueryPageSize(source as QueryDataSource, reusableInitialSnapshot(source)); if (size) compiled.limits.set(id, size); } }
  const runner = createQueryRunner(config);
  const candidates = createCandidateValidator(page, config.gateway, config);

  const cascaded = cascadeSourceIds(page.dataSources);
  const defaults = new Map<string, import('../filter-values').FilterValue>();
  const defaultNow = config.now ?? config.clock?.() ?? new Date(), defaultInputs = config.displayInputs?.(), defaultRevision = config.filterRevision?.();
  for (const filter of page.filters ?? []) try { for (const [id, value] of initialFilterValues([filter], defaultNow, defaultInputs, defaultRevision)) defaults.set(id, value); } catch {/* An unavailable dynamic default cannot override an explicit valid selection. */ }
  function defaultConditions(id: string, values: FilterValues, reuse = true): boolean {
    if(reuse&&[...conditionSourceIds(page,id)].some(key=>{const source=page.dataSources[key];return source?.source.type==='query'&&hasQuerySelection(source.source.query);}))return false;
    const filters = new Set([...conditionSourceIds(page, id)].flatMap(key => { const source = page.dataSources[key]; return source?.source.type === 'query' ? queryFilterIds(source.source.query) : []; }));
    return [...filters].every(id => {
      const filter = page.filters?.find(filter => filter.id === id);
      if (requiresFreshTime(filter, reuse) || dynamicPeriodDefault(filter)) return false;
      return canonicalizeJson(values.get(id) ?? null) === canonicalizeJson(defaults.get(id) ?? null);
    });
  }
  let batch = 0, contextScope = 'session';
  function readSignals(controller: AbortController, input: SourceRead): AbortSignal[] {
    return [controller.signal, ...(input.signal ? [input.signal] : []), ...(input.purpose === 'complete' ? [AbortSignal.timeout(60_000)] : [])];
  }
  function freezeReadRequest(input: SourceRead, signals: AbortSignal[]) {
    return { ...input, now: input.now ?? config.now ?? config.clock?.() ?? new Date(), conditions: structuredClone(new Map(input.conditions)), views: input.views && structuredClone(new Map(input.views)), signal: AbortSignal.any(signals) };
  }
  function sourceReadScope(freshness: SourceRead['freshness'], inputs: DisplayInputsSnapshot | undefined, revision: number | undefined): string {
    const nextScope = inputs ? `context:${canonicalizeJson([inputs, revision ?? null])}` : 'session';
    if (nextScope !== contextScope) { runner.forgetScope(contextScope); contextScope = nextScope; }
    return freshness === 'refresh' ? `fresh:${++batch}` : nextScope;
  }
  function requiresFreshTime(filter: NonNullable<Page['filters']>[number] | undefined, reuse: boolean): boolean {
    return !!reuse && !!filter && (filter.type === 'timeRange' || filter.type === 'timePoint') && requiresTimeValidation(filter);
  }
  function dynamicPeriodDefault(filter: NonNullable<Page['filters']>[number] | undefined): boolean {
    return filter?.type === 'timeRange' && filter.display === 'period' && !!filter.default && typeof filter.default === 'object' && 'mode' in filter.default && (filter.default.mode === 'last12Months' || !('value' in filter.default) || !filter.default.value);
  }
  const program = {
    readColumnCandidates(request: ColumnCandidatesRead) { return createColumnCandidatesReader(page, runner, value => program.read(value), compiled.limits, config)(request); },
    initialSnapshots(request: Pick<SourceRead, 'roots' | 'conditions' | 'views'>): Map<string, DataSnapshot> {
      const snapshots = new Map<string, DataSnapshot>();
      for (const id of executionSourceIds(page, request.roots)) {
        const source = compiled.sources.get(id); if (!source) continue;
        const view = request.views?.get(id) ?? defaultSourceView(page, id, compiled.limits.get(id));
        const contradictory = candidates.trusted(id, request.conditions) && source.source.type === 'query' && !intersectQueryFilters(composeEffectiveQuery({ now: config.now ?? config.clock?.() ?? new Date(), filters: page.filters, dataSource: source as QueryDataSource }, request.conditions, 0, [], {}));
        const initial = contradictory ? { status: 'empty' as const, totalCount: 0 } : candidates.trusted(id, request.conditions) && defaultConditions(id, request.conditions) ? reusableInitialSnapshot(source, view, compiled.limits.has(id)) : source.source.type === 'inline' ? rawSnapshot(source.source.rows) : undefined;
        snapshots.set(id, initial ? checkOrdinaryRange(source, initial, undefined, { ...config.diagnostics, pageId: page.id, dataSourceIds: [id] }) : { status: 'loading' });
      } return snapshots;
    },
    captureQueries(conditions: FilterValues, views: ReadonlyMap<string, TableQueryView>, raw: ReadonlyMap<string, DataSnapshot>): ReadonlyMap<string, EffectiveQuery> {
      const queries = new Map<string, EffectiveQuery>(), now = config.now ?? config.clock?.() ?? new Date();
      const limits = new Map(compiled.limits);
      for (const [id, view] of views) if (compiled.limits.has(id)) limits.set(id, view.pageSize);
      for (const [id, source] of compiled.sources) {
        if (source.source.type !== 'query') continue;
        const view = views.get(id) ?? defaultSourceView(page, id);
        const query = composeEffectiveQuery({ now, filters: page.filters, dataSource: source as QueryDataSource, ...(limits.has(id) ? { pagination: { limit: view.pageSize } } : {}) }, conditions, cascaded.has(id) ? view.pageIndex : 0, view.sort, tableHeaders(view.predicates), view.search);
        const inputs = resolveQueryResultInputs(source, raw, compiled.sources, limits);
        if (inputs.status === 'ready') bindQueryResultValues(query, inputs.values);
        queries.set(id, structuredClone(query));
      }
      return queries;
    },
    async *read(input: SourceRead): AsyncGenerator<SourceUpdate> {
      const controller = new AbortController();
      const signals = readSignals(controller, input);
      const request = freezeReadRequest(input, signals);
      const frozenInputs = request.displayInputs ?? config.displayInputs?.(); const frozenRevision = request.filterRevision ?? config.filterRevision?.();
      const candidates = createCandidateValidator(page, config.gateway, { displayInputs: () => frozenInputs, filterRevision: () => frozenRevision ?? 0, now: request.now });
      const scope = sourceReadScope(request.freshness, frozenInputs, frozenRevision);
      try {
        const ids = executionSourceIds(page, request.roots);
        const raw = new Map(request.seeds);
        removeUntrustedSeeds();
        const views = new Map(request.views);
        const queries = new Map<string, EffectiveQuery>();
        const initials = new Map<string, SourceUpdate['initial']>();
        const corrections = new Map<string, TableQueryView>();
        const candidateRejected = new Set<string>();

        const reportedErrors = new Map<string, string>();
        function reportError(id: string, snapshot: DataSnapshot): void {
          if (snapshot.status !== 'error') return;
          const fingerprint = `${snapshot.error.code}\n${snapshot.error.message}`;
          if (reportedErrors.get(id) === fingerprint) return;
          reportedErrors.set(id, fingerprint);
          console.error(`[MetricCanvas][${snapshot.error.code}] ${snapshot.error.message}`, {
            ...config.diagnostics, pageId: page.id, ...describeExportSource(page, id), ...snapshot.error
          });
        }
        const limits = readLimits();
        const context = computeContext();
        function readLimits(): Map<string, number> {
          const limits = new Map(compiled.limits);
          for (const [id, query] of request.queries ?? []) if (query.pagination) limits.set(id, query.pagination.limit);
          for (const [id, view] of views) if (compiled.limits.has(id)) limits.set(id, view.pageSize);
          return limits;
        }
        function computeContext() {
          return {
            currentYear: request.currentYear ?? new Date().getFullYear(),
            modes: new Map([...request.conditions].flatMap(([id, v]) => v.type === 'dimension' ? [[id, v.values] as const] : [])),
            ranges: new Map([...request.conditions].flatMap(([id, v]) => v.type === 'timeRange' ? [[id, { from: v.from, to: v.to }] as const] : []))
          };
        }
        const tasks = new Map<string, Promise<void>>();
        async function execute(id: string): Promise<void> {
          request.signal?.throwIfAborted();
          const source = requiredSource(id);
          try { if (candidates.requires(id)) await candidates.verify(id, request.conditions, request.signal); }
          catch (cause) { rejectCandidate(id, cause); return; }
          if (raw.has(id)) return;
          const view = views.get(id) ?? defaultSourceView(page, id, limits.get(id));
          if (contradictorySource(source)) { raw.set(id, { status: 'empty', totalCount: 0 }); return; }
          const initial = availableInitial(id, source, view);
          if (initial) { raw.set(id, initial); return; }
          const dependencies = queryResultDependencies(source);
          const missing = dependencies.filter(id => !raw.has(id));
          if (missing.length) await Promise.all(missing.map(run));
          if (source.source.type === 'pagedJoin') {
            try {
              const plan = compilePagedJoin(page, id, request.conditions, view, request.now);
              const result = await readJoined(plan);
              request.signal?.throwIfAborted();
              raw.set(id, result.snapshot);
              captureJoinedResult(id, source as PagedJoinDataSource, view, plan, result);
            } catch (cause) {
              if (joinFailureMustPropagate(cause)) throw cause;
              raw.set(id, { status: 'error', error: preservedQueryError(cause) });
            }
            return;
          }
          const querySource = source as QueryDataSource;
          const input = readyQueryInputs(querySource);
          let snapshot: DataSnapshot;
          let resultLimit = limits.get(id) ?? declaredPaginationLimit(querySource.source.query);
          if (input.status === 'terminal') snapshot = input.snapshot;
          else {
            let query = preparedQuery(id, source as QueryDataSource, view, input.values);
            const diagnostics = { ...config.diagnostics, pageId: page.id, dataSourceIds: [id] };
            const preserveWindow = preserveBusinessWindow(id, source);
            if (requiresCompleteRead(preserveWindow,source,query)) { resultLimit = undefined; snapshot = await fetchComplete(query, runner, scope, request.signal, diagnostics, querySource.source.resultScope === 'complete', () => describeExportSource(page, id), request.allowPartial); }
            else {
              snapshot = await runner.run(query, diagnostics, scope, request.signal);
              const corrected = correctedPageIndex(query, snapshot);
              if (canCorrectPage(corrected)) {
                const correctedView = { ...view, pageIndex: corrected };
                corrections.set(id, correctedView);
                query = { ...query, pagination: { offset: corrected * view.pageSize, limit: view.pageSize } };
                queries.set(id, query);
                snapshot = await runner.run(query, diagnostics, scope, request.signal);
              }
            }
          }
          request.signal?.throwIfAborted();
          snapshot = checkOrdinaryRange(source, snapshot, resultLimit, { ...config.diagnostics, pageId: page.id, dataSourceIds: [id], pagination: queries.get(id)?.pagination });
          finishQueryRead(id, source as QueryDataSource, view, snapshot);
        }
        function removeUntrustedSeeds(): void {
          for (const id of raw.keys()) if (untrustedSeed(id)) raw.delete(id);
        }
        function candidateMarker(id: string): { candidateRejected?: true } {
          return candidateRejected.has(id) ? { candidateRejected: true } : {};
        }
        function canCorrectPage(index: number | undefined): index is number {
          return index !== undefined && request.purpose !== 'complete';
        }
        function readJoined(plan: ReturnType<typeof compilePagedJoin>) {
          return request.purpose === 'complete' ? exportPagedJoin(plan, runner, scope, request.signal, request.allowPartial) : executePagedJoin(plan, runner, scope, request.signal);
        }
        function reportSourceState(id: string, snapshots: ReadonlyMap<string, DataSnapshot>): void {
          reportError(id, raw.get(id)!);
          if ([...executionSourceIds(page, [id])].every(dependency => raw.has(dependency))) reportError(id, snapshots.get(id) ?? raw.get(id)!);
        }
        function requiredSource(id: string): DataSource {
          const source = compiled.sources.get(id);
          if (!source) throw new Error('页面数据源不存在');
          return source;
        }
        function rejectCandidate(id: string, cause: unknown): void {
          if (request.signal.aborted) throw cause;
          candidateRejected.add(id);
          raw.set(id, { status: 'error', error: { ...preservedQueryError(cause), message: '筛选候选校验失败' } });
        }
        function contradictorySource(source: DataSource): boolean {
          return source.source.type === 'query' && !intersectQueryFilters(composeEffectiveQuery({ now: request.now, filters: page.filters, dataSource: source as QueryDataSource }, request.conditions, 0, [], {}));
        }
        function untrustedSeed(id: string): boolean {
          return [...conditionSourceIds(page, id)].some(key => {
            const source = page.dataSources[key];
            return source?.source.type === 'query' && (requiresQueryContext(source.source.query, page.filters) || queryFilterIds(source.source.query).some(id => {
              const filter = page.filters?.find(filter => filter.id === id);
              return filter?.type === 'dimension' && !!filter.candidateWindow;
            }));
          });
        }
        function availableInitial(id: string, source: DataSource, view: TableQueryView): DataSnapshot | undefined {
          const initial = request.useInitial && defaultConditions(id, request.conditions) ? reusableInitialSnapshot(source, view, limits.has(id)) : undefined;
          if (initial) return checkOrdinaryRange(source, initial, undefined, { ...config.diagnostics, pageId: page.id, dataSourceIds: [id] });
          if (source.source.type === 'inline') return rawSnapshot(source.source.rows);
        }
        function joinFailureMustPropagate(cause: unknown): boolean {
          return request.signal.aborted || (request.purpose === 'complete' && (!request.allowPartial || cause instanceof SourceRangeError));
        }
        function captureJoinedResult(id: string, source: PagedJoinDataSource, view: TableQueryView, plan: ReturnType<typeof compilePagedJoin>, result: Awaited<ReturnType<typeof executePagedJoin>>): void {
          const applied = result.viewCorrection ?? plan.view;
          if (canonicalizeJson(applied) !== canonicalizeJson(view)) corrections.set(id, applied);
          if (defaultJoinedView(id, source, applied) && (result.snapshot.status === 'ready' || result.snapshot.status === 'empty')) initials.set(id, { capturedAt: new Date().toISOString(), rows: result.snapshot.status === 'ready' ? result.snapshot.rows : [], totalCount: result.snapshot.totalCount!, view: result.viewCorrection ?? { ...view, sort: plan.view.sort } });
        }
        function defaultJoinedView(id: string, source: PagedJoinDataSource, applied: TableQueryView): boolean {
          return request.purpose !== 'complete' && defaultConditions(id, request.conditions, false) && applied.pageIndex === 0 && applied.pageSize === source.source.pagination.pageSize && !applied.predicates.length && !applied.search?.query.trim() && canonicalizeJson(applied.sort) === canonicalizeJson(source.source.ordering.default);
        }
        function readyQueryInputs(source: QueryDataSource) {
          const input = resolveQueryResultInputs(source, raw, compiled.sources, limits);
          if (input.status === 'waiting') throw new Error('页面查询依赖未就绪');
          return input;
        }
        const requiresCompleteRead = (preserveWindow: boolean, source: DataSource, query: EffectiveQuery) => (request.purpose === 'complete' && !preserveWindow) || objectCompleteSource(source,query);
        function preparedQuery(id: string, source: QueryDataSource, view: TableQueryView, values: EffectiveQuery['filterValues']): EffectiveQuery {
          const captured = request.queries?.get(id);
          if (captured && requiresQueryContext(source.source.query, page.filters)) { const expected = composeEffectiveQuery({ now: request.now, filters: page.filters, dataSource: source as QueryDataSource }, request.conditions, view.pageIndex, view.sort, tableHeaders(view.predicates), view.search); if (canonicalizeJson(captured.body) !== canonicalizeJson(expected.body)) throw Object.assign(new Error('捕获查询与已应用查询模式不匹配'), { code: 'DQE_QUERY_REJECTED' }); }
          const fresh = () => composeEffectiveQuery({ now: request.now, filters: page.filters, dataSource: source as QueryDataSource, ...(limits.has(id) ? { pagination: { limit: view.pageSize } } : {}) }, request.conditions, view.pageIndex, view.sort, tableHeaders(view.predicates), view.search);
          const protectedConditions = requiresQueryContext(source.source.query, page.filters);
          // Captured views may be reused; their old predicates cannot authorize a different range.
          let query = captured ? { ...structuredClone(captured), ...(protectedConditions ? { filterValues: fresh().filterValues, bindingValues: fresh().bindingValues, tableFilters: fresh().tableFilters, fieldMappings: source.fields } : {}) } : fresh();
          bindQueryResultValues(query, values);
          queries.set(id, query);
          return query;
        }
        function preserveBusinessWindow(id: string, source: DataSource): boolean {
          return isBusinessSelection(source, compiled.limits.has(id) || compiled.automatic.has(id)) || (cascaded.has(id) && (!request.completeSources?.includes(id) || isBoundedResultSource(page.dataSources, id)));
        }
        function defaultQueryView(id: string, view: TableQueryView): boolean {
          return defaultConditions(id, request.conditions, false) && view.pageIndex === 0 && !view.sort.length && !view.predicates.length && !view.search?.query.trim() && (!compiled.limits.has(id) || view.pageSize === compiled.limits.get(id));
        }
        function finishQueryRead(id: string, source: QueryDataSource, view: TableQueryView, snapshot: DataSnapshot): void {
          if (snapshot.status === 'ready' || snapshot.status === 'empty') {
            try {
              const rows = queryRowsFromPageRows(snapshot.status === 'ready' ? snapshot.rows : [], source.fields);
              // Keep inconsistent live rows visible without persisting an invalid first-page initial.
              const validInitialWindow = !compiled.limits.has(id) || (snapshot.totalCount !== undefined && rows.length === Math.min(view.pageSize, snapshot.totalCount));
              if (validInitialWindow && defaultQueryView(id, view)) initials.set(id, { capturedAt: new Date().toISOString(), rows, ...(snapshot.totalCount === undefined ? {} : { totalCount: snapshot.totalCount }) });
            }
            catch (cause) { snapshot = { status: 'error', error: preservedQueryError(cause) }; }
          }
          raw.set(id, snapshot);
          const autoSize = compiled.automatic.has(id) && !compiled.limits.has(id) ? automaticQueryPageSize(source as QueryDataSource, snapshot) : undefined;
          if (autoSize !== undefined) { compiled.limits.set(id, autoSize); corrections.set(id, { ...view, pageSize: autoSize }); }
        }
        function sourceProjection(id: string, snapshots: ReadonlyMap<string, DataSnapshot>): DataSnapshot {
          return [...executionSourceIds(page, [id])].every(dependency => raw.has(dependency)) ? snapshots.get(id) ?? raw.get(id)! : { status: 'loading' };
        }
        function run(id: string): Promise<void> {
          let task = tasks.get(id);
          if (!task) { task = execute(id); tasks.set(id, task); }
          return task;
        }
        // Dependency graph execution is shared by all consumers. Stream complete source terminals.
        const pending = new Map([...ids].map(id => [id, run(id).then(() => id)]));
        void Promise.allSettled(pending.values());
        while (pending.size) {
          const id = await Promise.race(pending.values()); pending.delete(id);
          request.signal?.throwIfAborted();
          const all = new Map(compiled.sources);
          // Sources outside this read cannot create spurious missing-compute errors.
          for (const key of all.keys()) if (!ids.has(key) && !raw.has(key)) all.delete(key);
          const snapshots = computedSnapshots(all, raw, context);
          reportSourceState(id, snapshots);
          yield { ...candidateMarker(id), sourceId: id, snapshot: sourceProjection(id, snapshots), raw: raw.get(id)!, initial: initials.get(id), viewCorrection: corrections.get(id), query: queries.get(id) };
        }
        // Raw success can precede compute dependencies. Publish final projections after all settle.
        const final = computedSnapshots(new Map([...compiled.sources].filter(([id]) => ids.has(id) || raw.has(id))), raw, context);
        for (const id of ids) if (compiled.sources.get(id)?.compute?.length) {
          reportError(id, final.get(id)!);
          yield { ...candidateMarker(id), sourceId: id, snapshot: final.get(id)!, raw: raw.get(id)! };
        }
      } finally { controller.abort(); if (request.freshness === 'refresh' || scope !== contextScope) runner.forgetScope(scope); }
    },
    dispose() { runner.dispose(); }
  };
  return program;
}
export type SourceProgram = ReturnType<typeof createSourceProgram>;

function objectCompleteSource(source: DataSource, query: EffectiveQuery): boolean {
  return source.source.type==='query' && source.source.resultScope==='complete' && isObjectDqeItem(query.body.dsl_list[0]);
}
