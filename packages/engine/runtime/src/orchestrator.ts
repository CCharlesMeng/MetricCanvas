import {hasTimeConstraints} from '@metriccanvas/page/internal';
import {fieldSelectionIds,flattenPageComponents,queryFilterIds} from '@metriccanvas/page/internal';
import { createSourceProgram, visibleSourceIds, compileSources, defaultSourceView, computedSnapshots, automaticQueryPageSize } from '@metriccanvas/data-execution/runtime';
import type { QueryHeaderFilters } from '@metriccanvas/data-execution/runtime';
import { affectedSourceIds, conditionSourceIds, queryResultDependencies, type Page, type DataSnapshot, type EffectiveQuery, type QueryDataSource, type TableQueryView } from '@metriccanvas/page/internal';
import { executionSourceKey } from './execution';
import { filterBlockedIds, initialFilterValues, type FilterState, type FilterValues } from './filter-state';
import type { DataGateway, QueryDiagnosticContext } from './ports';
import { createTableSession, type TableSession } from './table-session';

export type PageDataSnapshots = ReadonlyMap<string, DataSnapshot>;
export interface Subscribable<T> { subscribe(run: (value: T) => void): () => void; }
export type { QueryHeaderFilters } from '@metriccanvas/data-execution/runtime';
export interface PageSnapshotStream extends Subscribable<PageDataSnapshots> {
  captureQueries(): ReadonlyMap<string, EffectiveQuery>;
  captureViews(): ReadonlyMap<string, TableQueryView>;
  captureComputeYear(): number;
  getQueryView(dataSourceId: string): TableQueryView | undefined;
  getQueryPageSize(dataSourceId: string): number | undefined;
  getSourceProgram(): ReturnType<typeof createSourceProgram> | undefined;
  setQueryPage(dataSourceId: string, pageIndex: number): void;
  setQueryPageSize(dataSourceId: string, pageSize: number): void;
  setQuerySort(dataSourceId: string, sort: ReadonlyArray<{ field: string; direction: 'asc' | 'desc' }>): void;
  setQueryHeaderFilters(dataSourceId: string, filters: QueryHeaderFilters): void;
  setQuerySearch(dataSourceId: string, search: { fields: readonly string[]; query: string }): void;
}
export function orchestrate(page: Page, gateway: DataGateway, filters?: FilterState,
  diagnostics?: Pick<QueryDiagnosticContext, 'pageRevisionId'>,
  execution?: Pick<import('./execution').ExecutionBootstrap, 'filters' | 'snapshots' | 'sourceKeys'>,timeContext:{displayInputs?:()=>import('@metriccanvas/page/internal').DisplayInputsSnapshot|undefined;filterRevision?:()=>number;now?:Date;clock?:()=>Date}={}): PageSnapshotStream {
  const ids = visibleSourceIds(page), compiled = compileSources(page), defaults = filters?new Map():initialFilterValues(page.filters ?? [],timeContext.now??timeContext.clock?.()??new Date(),timeContext.displayInputs?.(),timeContext.filterRevision?.());
  const subscribers = new Set<(value: PageDataSnapshots) => void>();
  let active: ReturnType<typeof start> | undefined;
  function notify(run: (value: PageDataSnapshots) => void, value: PageDataSnapshots) { try { run(value); } catch (cause) { console.error('数据快照订阅方回调抛出异常（已隔离）：', cause); } }
  function start() {
    const program = createSourceProgram(page, { gateway, diagnostics,...timeContext });
    const tables = new Map<string, TableSession>();
    let values: FilterValues = filters ? new Map() : defaults;
    const first = filters?.subscribe(next => values = next); first?.();
    let blocked = new Set(filterBlockedIds(filters));
    const gated = (id: string) => [...conditionSourceIds(page,id)].some(key => {
      const source = page.dataSources[key];
      return source?.source.type === 'query' && queryFilterIds(source.source.query).some(filterId => blocked.has(filterId));
    });
    let disposed = false, raw = new Map<string, DataSnapshot>();
    const year = new Date().getFullYear();
    const requests = new Map<string,AbortController>();
    const tokens = new Map<string, number>();
    const views = () => new Map([...tables].map(([id, session]) => [id, session.snapshot()]));
    for (const id of ids) {
      const source = page.dataSources[id];
      if (source?.source.type !== 'inline') tables.set(id, createTableSession(defaultSourceView(page, id, compiled.limits.get(id)), () => refetch(new Set([id]))));
    }
    const matched = new Set<string>();
    // Initial candidate loading may hide an otherwise valid initial snapshot.
    // Keep it only until the first release; later invalidation must fetch fresh data.
    const pendingInitial = new Map<string,DataSnapshot>();
    const initialSnapshots=execution?new Map<string,DataSnapshot>():program.initialSnapshots({roots:[...ids],conditions:values,views:views()});
    for (const id of ids) {
      const source = page.dataSources[id];
      const receipt = execution?.snapshots.get(id);
      let initial=initialSnapshots.get(id);
      if(initial?.status==='loading')initial=undefined;
      if(source.source.type==='inline'&&!initial)initial={status:source.source.rows.length?'ready':'empty',...(source.source.rows.length?{rows:source.source.rows}:{})} as DataSnapshot;
      const protectedSource=[...conditionSourceIds(page,id)].some(key=>{const s=page.dataSources[key];return s?.source.type==='query'&&(hasTimeConstraints(s.source.query,page.filters));});
      if (!protectedSource && receipt && same(values, execution!.filters) && execution!.sourceKeys.get(id) === executionSourceKey(source)) { initial = receipt; matched.add(id); }
      if (gated(id)) { if(initial)pendingInitial.set(id,initial);initial = undefined; }
      raw.set(id, initial ?? { status: 'loading' });
      if (compiled.automatic.has(id) && source.source.type === 'query') {
        const size = automaticQueryPageSize(source as QueryDataSource, initial);
        if (size) { compiled.limits.set(id, size); tables.get(id)?.correct(defaultSourceView(page, id, size), tables.get(id)!.generation); }
      }
    }
    const context = () => ({ currentYear: year,
      modes: new Map([...values].flatMap(([id, v]) => v.type === 'dimension' ? [[id, v.values] as const] : [])),
      ranges: new Map([...values].flatMap(([id, v]) => v.type === 'timeRange' ? [[id, { from: v.from, to: v.to }] as const] : [])) });
    let snapshots = computedSnapshots(new Map([...compiled.sources].filter(([id]) => ids.has(id))), raw, context());
    function publish() {
      snapshots = computedSnapshots(new Map([...compiled.sources].filter(([id]) => ids.has(id))), raw, context());
      for (const run of subscribers) notify(run, snapshots);
    }
    function refetch(changed: Set<string>, firstRead = false, releaseInitial = false) {
      if (disposed || !changed.size) return;
      const targets = new Set([...(firstRead ? changed : affectedSourceIds(page.dataSources, changed, false))].filter(id => ids.has(id)));
      if(!firstRead&&!releaseInitial)for(const id of targets)pendingInitial.delete(id);
      for (const id of targets) tokens.set(id, (tokens.get(id) ?? 0) + 1);
      for (const id of targets) {
        if (!changed.has(id)) tables.get(id)?.resetPage();
        tables.get(id)?.invalidate();
      }
      const capturedTokens = new Map(tokens), generations = new Map([...tables].map(([id, session]) => [id, session.generation]));
      const seeds = new Map(raw);
      for (const id of targets) { seeds.delete(id); if (!firstRead) raw.set(id, { status: 'loading' }); }
      if (!firstRead) publish();
      for (const root of targets) {
        requests.get(root)?.abort();
        if (gated(root)) { raw.set(root,{status:'loading'}); publish(); continue; }
        const receipt=pendingInitial.get(root);
        if(receipt){pendingInitial.delete(root);raw.set(root,receipt);publish();continue;}
        const controller = new AbortController(); requests.set(root,controller);
        void (async () => {
          try {
            for await (const update of program.read({ roots: [root], conditions: values, views: views(), seeds, currentYear: year, signal: controller.signal })) {
              if (disposed || tokens.get(root) !== capturedTokens.get(root) || update.sourceId !== root) continue;
              if (update.viewCorrection) { if (compiled.automatic.has(root)) compiled.limits.set(root, update.viewCorrection.pageSize); tables.get(root)?.correct(update.viewCorrection, generations.get(root)!); }
              raw = new Map(raw).set(root, update.raw); publish();
            }
          } catch {
            if (!disposed && !controller.signal.aborted && tokens.get(root)===capturedTokens.get(root)) {
              raw.set(root, { status: 'error', error: { code: 'UNKNOWN', message: '页面取数未完成' } }); publish();
            }
          } finally { if(requests.get(root)===controller)requests.delete(root); }
        })();
      }
    }
    let factKey=JSON.stringify(timeContext.displayInputs?.());
    let primed = false;
    const unsubscribe = filters?.subscribe(next => {
      if (!primed) { primed = true; return; }
      const changed = new Set([...new Set([...values.keys(), ...next.keys()])].filter(id => queryCondition(values.get(id)) !== queryCondition(next.get(id))));
      if(changed.size)pendingInitial.clear();
      const nextKey=JSON.stringify(timeContext.displayInputs?.());if(nextKey!==factKey){pendingInitial.clear();factKey=nextKey;for(const f of page.filters??[])if((f.type==='timeRange'||f.type==='timePoint')&&f.availability||f.type==='dimension'&&f.candidateWindow)changed.add(f.id);}
      const nextBlocked = new Set(filterBlockedIds(filters));
      for (const id of new Set([...blocked,...nextBlocked])) if (blocked.has(id) !== nextBlocked.has(id)) changed.add(id);
      blocked = nextBlocked;
      values = next;
      const targets = new Set([...ids].filter(id => [...conditionSourceIds(page, id)].some(key => {
        const source = page.dataSources[key];
        return source?.source.type === 'query' && queryFilterIds(source.source.query).some(id => changed.has(id));
      })));
      for(const component of flattenPageComponents(page))if(component.type==='table'&&fieldSelectionIds(component.props).some(id=>changed.has(id))){tables.get(component.data.main)?.resetPresentation();targets.add(component.data.main);}
      for (const id of targets) tables.get(id)?.resetPage();
      if (targets.size) refetch(targets,false,true); else if (changed.size) publish();
    });
    refetch(new Set([...ids].filter(id => !matched.has(id) && raw.get(id)?.status === 'loading')), true);
    return {
      program, tables, views, year, current: () => snapshots,
      queries: () => program.captureQueries(values, views(), raw),
      mutable(id: string) { return tables.has(id) && (compiled.limits.has(id) || compiled.automatic.has(id) || ![...ids].some(key => queryResultDependencies(page.dataSources[key]).includes(id))); },
      pageSize(id: string) { return compiled.limits.has(id) ? tables.get(id)?.snapshot().pageSize : undefined; },
      dispose() { disposed = true; unsubscribe?.(); for (const table of tables.values()) table.dispose(); for (const controller of requests.values()) controller.abort(); program.dispose(); }
    };
  }
  return {
    subscribe(run) { subscribers.add(run); active ??= start(); notify(run, active.current()); return () => { subscribers.delete(run); if (!subscribers.size) { active?.dispose(); active = undefined; } }; },
    captureQueries: () => active?.queries() ?? new Map(), captureViews: () => active?.views() ?? new Map(),
    captureComputeYear: () => active?.year ?? new Date().getFullYear(), getSourceProgram: () => active?.program,
    getQueryView: id => active?.tables.get(id)?.snapshot(), getQueryPageSize: id => active?.pageSize(id),
    setQueryPage(id, value) { if (active?.pageSize(id)) active.tables.get(id)?.setPage(value); },
    setQueryPageSize(id, value) { if(page.dataSources[id]?.source.type==='pagedJoin'&&value>1000)return; if (active?.pageSize(id)) active.tables.get(id)?.setPageSize(value); },
    setQuerySort(id, value) { const source=page.dataSources[id];const sortable=source?.source.type==='pagedJoin'?source.source.ordering.sortableFields:undefined;if(sortable&&value.some(rule=>!sortable.includes(rule.field)))return; if (active?.mutable(id)) active.tables.get(id)?.setSort((source?.source.type==='pagedJoin'&&!value.length?source.source.ordering.default:value).map(v => ({ ...v }))); },
    setQueryHeaderFilters(id, value) { if (active?.mutable(id)) active.tables.get(id)?.setHeaders(value); },
    setQuerySearch(id, value) { active?.tables.get(id)?.setSearch({ fields: [...value.fields], query: value.query }); }
  };
}
function same(left: FilterValues, right: FilterValues) { return [...new Set([...left.keys(), ...right.keys()])].every(id => JSON.stringify(left.get(id)) === JSON.stringify(right.get(id))); }

function queryCondition(value: import('./filter-state').FilterValue | undefined): string | undefined { return JSON.stringify(value?.type === 'timeRange' ? {type:value.type,mode:value.mode,from:value.from,to:value.to} : value); }
