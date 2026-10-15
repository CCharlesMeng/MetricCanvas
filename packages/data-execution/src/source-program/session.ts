import { initialFilterValues } from '../filter-values';
import { compilePagedJoin } from '../paged-join/plan';
import { executePagedJoin } from '../paged-join/execute';
import { exportPagedJoin } from '../paged-join/export';
import { preservedQueryError } from '../query-error';
import { cascadeSourceIds, conditionSourceIds, canonicalizeJson, isBoundedResultSource, queryResultDependencies, tableHeaders, declaredPaginationLimit, type Page, type DataSnapshot, type EffectiveQuery, type TableQueryView, type QueryDataSource, type EmbeddedInitialRows } from '@metriccanvas/page/internal';
import { createQueryRunner } from '../query-runner';
import type { DataGateway, QueryDiagnosticContext } from '../ports';
import type { FilterValues } from '../filter-values';
import { composeEffectiveQuery } from '../effective-query';
import { resolveQueryResultInputs } from '../query-result-inputs';
import { rawSnapshot } from '../snapshots';
import { queryRowsFromPageRows } from '../query-rows';
import { computedSnapshots } from '../compute/snapshots';
import { compileSources, executionSourceIds } from './compiler';
import { reusableInitialSnapshot, checkOrdinaryRange, isBusinessSelection, correctedPageIndex, fetchComplete } from './range-policy';
import { automaticQueryPageSize } from './table-pagination';
import { describeExportSource } from './export-diagnostics';

export interface SourceRead {
  roots: readonly string[]; conditions: FilterValues;
  views?: ReadonlyMap<string, TableQueryView>;
  purpose?: 'screen' | 'complete'; freshness?: 'reuse' | 'refresh'; signal?: AbortSignal;
  /** Adapters may seed existing ordinary raw receipts; they never seed member roles. */
  seeds?: ReadonlyMap<string, DataSnapshot>; useInitial?: boolean;
  queries?: ReadonlyMap<string, EffectiveQuery>; completeSources?: readonly string[]; currentYear?: number;
}
export interface SourceUpdate {
  sourceId: string; snapshot: DataSnapshot; raw: DataSnapshot;
  initial?: EmbeddedInitialRows | (EmbeddedInitialRows & { view: TableQueryView; totalCount: number });
  viewCorrection?: TableQueryView; query?: EffectiveQuery;
}
export function defaultSourceView(page: Page, id: string, pageSize?: number): TableQueryView {
  const source = page.dataSources[id];
  return { pageIndex: 0, pageSize: pageSize ?? (source?.source.type === 'pagedJoin' ? source.source.pagination.pageSize : source?.source.type === 'query' ? declaredPaginationLimit(source.source.query) ?? 20 : 20),
    sort: source?.source.type === 'pagedJoin' ? structuredClone(source.source.ordering.default) : [], predicates: [] };
}
/** All execution policies are owned here; adapters own publication and lifecycle. */
export function createSourceProgram(page: Page, config: { gateway: DataGateway; diagnostics?: QueryDiagnosticContext }) {
  const compiled = compileSources(page);
  for (const id of compiled.automatic) { const source = compiled.sources.get(id)!; if (source.source.type === 'query') { const size = automaticQueryPageSize(source as QueryDataSource, reusableInitialSnapshot(source)); if (size) compiled.limits.set(id, size); } }
  const runner = createQueryRunner(config);
  const cascaded = cascadeSourceIds(page.dataSources);
  const defaults=initialFilterValues(page.filters??[]);
  function defaultConditions(id:string,values:FilterValues):boolean {
    const filters=new Set([...conditionSourceIds(page,id)].flatMap(key=>{const source=page.dataSources[key];return source?.source.type==='query'?Object.keys(source.source.query.filterBindings??{}):[];}));
    return [...filters].every(id=>canonicalizeJson(values.get(id)??null)===canonicalizeJson(defaults.get(id)??null));
  }
  let batch = 0;
  return {
    initialSnapshots(request:Pick<SourceRead,'roots'|'conditions'|'views'>):Map<string,DataSnapshot>{
      const snapshots=new Map<string,DataSnapshot>();
      for(const id of executionSourceIds(page,request.roots)){
        const source=compiled.sources.get(id);if(!source)continue;
        const view=request.views?.get(id)??defaultSourceView(page,id,compiled.limits.get(id));
        const initial=defaultConditions(id,request.conditions)?reusableInitialSnapshot(source,view,compiled.limits.has(id)):source.source.type==='inline'?rawSnapshot(source.source.rows):undefined;
        snapshots.set(id,initial??{status:'loading'});
      }return snapshots;
    },
    captureQueries(conditions: FilterValues, views: ReadonlyMap<string, TableQueryView>, raw: ReadonlyMap<string, DataSnapshot>): ReadonlyMap<string, EffectiveQuery> {
      const queries = new Map<string, EffectiveQuery>();
      const limits = new Map(compiled.limits);
      for (const [id, view] of views) if (compiled.limits.has(id)) limits.set(id, view.pageSize);
      for (const [id, source] of compiled.sources) {
        if (source.source.type !== 'query') continue;
        const view = views.get(id) ?? defaultSourceView(page, id);
        const query = composeEffectiveQuery({ dataSource: source as QueryDataSource, ...(limits.has(id) ? { pagination: { limit: view.pageSize } } : {}) }, conditions, cascaded.has(id) ? view.pageIndex : 0, view.sort, tableHeaders(view.predicates), view.search);
        const inputs = resolveQueryResultInputs(source, raw, compiled.sources, limits);
        if (inputs.status === 'ready') query.filterValues.push(...inputs.values);
        queries.set(id, structuredClone(query));
      }
      return queries;
    },
    async *read(input: SourceRead): AsyncGenerator<SourceUpdate> {
      const controller=new AbortController();
      const signals=[controller.signal,...(input.signal?[input.signal]:[]),...(input.purpose==='complete'?[AbortSignal.timeout(60_000)]:[])];
      const request = { ...input, conditions: structuredClone(new Map(input.conditions)), views: input.views && structuredClone(new Map(input.views)), signal:AbortSignal.any(signals) };
      const scope = request.freshness === 'refresh' ? `fresh:${++batch}` : 'session';
      try {
      const ids = executionSourceIds(page, request.roots);
      const raw = new Map(request.seeds);
      const views = new Map(request.views);
      const queries = new Map<string, EffectiveQuery>();
      const initials = new Map<string, SourceUpdate['initial']>();
      const corrections = new Map<string, TableQueryView>();
      const limits = new Map(compiled.limits);
      for(const [id,query] of request.queries??[])if(query.pagination)limits.set(id,query.pagination.limit);
      for (const [id, view] of views) if (compiled.limits.has(id)) limits.set(id, view.pageSize);
      const context = { currentYear: request.currentYear ?? new Date().getFullYear(),
        modes: new Map([...request.conditions].flatMap(([id, v]) => v.type === 'dimension' ? [[id, v.values] as const] : [])),
        ranges: new Map([...request.conditions].flatMap(([id, v]) => v.type === 'timeRange' ? [[id, { from: v.from, to: v.to }] as const] : [])) };
      const tasks = new Map<string, Promise<void>>();
      async function execute(id: string): Promise<void> {
        request.signal?.throwIfAborted();
        const source = compiled.sources.get(id);
        if (!source) throw new Error('页面数据源不存在');
        if (raw.has(id)) return;
        const view = views.get(id) ?? defaultSourceView(page, id, limits.get(id));
        const initial = request.useInitial && defaultConditions(id,request.conditions) ? reusableInitialSnapshot(source,view,limits.has(id)) : undefined;
        if (initial) { raw.set(id, initial); return; }
        if (source.source.type === 'inline') { raw.set(id, rawSnapshot(source.source.rows)); return; }
        const dependencies = queryResultDependencies(source);
        const missing = dependencies.filter(id => !raw.has(id));
        if (missing.length) await Promise.all(missing.map(run));
        if (source.source.type === 'pagedJoin') {
          try {
            const plan = compilePagedJoin(page, id, request.conditions, view);
            const result = request.purpose === 'complete' ? await exportPagedJoin(plan, runner, scope, request.signal) : await executePagedJoin(plan, runner, scope, request.signal);
            request.signal?.throwIfAborted();
            raw.set(id, result.snapshot);
            const applied=result.viewCorrection??plan.view;
            if (canonicalizeJson(applied)!==canonicalizeJson(view)) corrections.set(id,applied);
            if (request.purpose !== 'complete' && defaultConditions(id,request.conditions) && applied.pageIndex===0 && applied.pageSize===source.source.pagination.pageSize && !applied.predicates.length && !applied.search?.query.trim() && canonicalizeJson(applied.sort)===canonicalizeJson(source.source.ordering.default) && (result.snapshot.status === 'ready' || result.snapshot.status === 'empty')) initials.set(id, { capturedAt: new Date().toISOString(), rows: result.snapshot.status === 'ready' ? result.snapshot.rows : [], totalCount: result.snapshot.totalCount!, view: result.viewCorrection ?? { ...view, sort: plan.view.sort } });
          } catch (cause) {
            if (request.signal?.aborted || request.purpose === 'complete') throw cause;
            raw.set(id, { status: 'error', error: preservedQueryError(cause) });
          }
          return;
        }
        const input = resolveQueryResultInputs(source, raw, compiled.sources, limits);
        let snapshot: DataSnapshot;
        let resultLimit=limits.get(id)??declaredPaginationLimit(source.source.query);
        if (input.status === 'waiting') throw new Error('页面查询依赖未就绪');
        if (input.status === 'terminal') snapshot = input.snapshot;
        else {
          const captured = request.queries?.get(id);
          let query = captured ? structuredClone(captured) : composeEffectiveQuery({ dataSource: source as QueryDataSource, ...(limits.has(id) ? { pagination: { limit: view.pageSize } } : {}) }, request.conditions, view.pageIndex, view.sort, tableHeaders(view.predicates), view.search);
          const bindingTargets = new Set((source.source.query.resultBindings ?? []).map(b => b.queryField));
          query.filterValues = query.filterValues.filter(v => v.target !== 'dimension' || !bindingTargets.has(v.queryField));
          query.filterValues.push(...input.values);
          queries.set(id, query);
          const diagnostics = { ...config.diagnostics, pageId: page.id, dataSourceIds: [id] };
          const preserveWindow = isBusinessSelection(source,compiled.limits.has(id)||compiled.automatic.has(id)) || (cascaded.has(id) && (!request.completeSources?.includes(id) || isBoundedResultSource(page.dataSources, id)));
          if (request.purpose === 'complete' && !preserveWindow) { resultLimit=undefined; snapshot = await fetchComplete(query, runner, scope, request.signal, diagnostics, source.source.resultScope === 'complete', () => describeExportSource(page, id)); }
          else {
            snapshot = await runner.run(query, diagnostics, scope, request.signal);
            const corrected = correctedPageIndex(query, snapshot);
            if (corrected !== undefined && request.purpose !== 'complete') {
              const correctedView = { ...view, pageIndex: corrected };
              corrections.set(id, correctedView);
              query = { ...query, pagination: { offset: corrected * view.pageSize, limit: view.pageSize } };
              queries.set(id,query);
              snapshot = await runner.run(query, diagnostics, scope, request.signal);
            }
          }
        }
        request.signal?.throwIfAborted();
        snapshot = checkOrdinaryRange(source, snapshot, resultLimit);
        if (snapshot.status === 'ready' || snapshot.status === 'empty') {
          try { const rows=queryRowsFromPageRows(snapshot.status === 'ready' ? snapshot.rows : [],source.fields);
            if(defaultConditions(id,request.conditions) && view.pageIndex===0 && !view.sort.length && !view.predicates.length && !view.search?.query.trim() && (!compiled.limits.has(id)||view.pageSize===compiled.limits.get(id))) initials.set(id,{capturedAt:new Date().toISOString(),rows,...(snapshot.totalCount===undefined?{}:{totalCount:snapshot.totalCount})}); }
          catch { snapshot = { status: 'error', error: { code: 'DQE_ROW_CONTRACT_ERROR', message: '查询结果不符合字段契约' } }; }
        }
        raw.set(id, snapshot);
        const autoSize = compiled.automatic.has(id) && !compiled.limits.has(id) ? automaticQueryPageSize(source as QueryDataSource, snapshot) : undefined;
        if (autoSize !== undefined) { compiled.limits.set(id, autoSize); corrections.set(id, { ...view, pageSize: autoSize }); }
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
        yield { sourceId: id, snapshot: [...executionSourceIds(page,[id])].every(dependency=>raw.has(dependency)) ? snapshots.get(id) ?? raw.get(id)! : {status:'loading'}, raw: raw.get(id)!, initial: initials.get(id), viewCorrection: corrections.get(id), query: queries.get(id) };
      }
      // Raw success can precede compute dependencies. Publish final projections after all settle.
      const final = computedSnapshots(new Map([...compiled.sources].filter(([id]) => ids.has(id) || raw.has(id))), raw, context);
      for (const id of ids) if (compiled.sources.get(id)?.compute?.length) yield { sourceId: id, snapshot: final.get(id)!, raw: raw.get(id)! };
      } finally { controller.abort(); if(request.freshness==='refresh')runner.forgetScope(scope); }
    },
    dispose() { runner.dispose(); }
  };
}
export type SourceProgram = ReturnType<typeof createSourceProgram>;
