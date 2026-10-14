import { composeEffectiveQuery, executeQuery, rawSnapshot } from '@metriccanvas/data-execution/runtime';
import type { QueryHeaderFilters } from '@metriccanvas/data-execution/runtime';
import { resolveQueryResultInputs } from './query-result-inputs';
import { executionSourceKey } from './execution';
import type { Page } from '@metriccanvas/page';
import {
  queryResultDependencies,
  cascadeSourceIds,
  computeDependencies,
  declaredPaginationLimit,
  hasQueryFieldMapping,
  type DataSnapshot,
  type DataSource,
  type EffectiveQuery,
  type QueryDataSource,
  flattenPageComponents
} from '@metriccanvas/page/internal';
import type { ComputationContext } from './compute/time-fill';
import { computedSnapshots } from './compute/snapshots';
import {
  initialFilterValues,
  type FilterState,
  type FilterValues
} from './filter-state';
import type { DataGateway, QueryDiagnosticContext } from './ports';
import { preservedQueryError } from './query-error';
import { automaticQueryPageSize, automaticQueryTableSources } from './table-pagination';

/** 页面数据快照的唯一真元：页面数据源 id → 快照。 */
export type PageDataSnapshots = ReadonlyMap<string, DataSnapshot>;

/** 兼容 Svelte store 的最小订阅契约。 */
export interface Subscribable<T> {
  subscribe(run: (value: T) => void): () => void;
}

/** 表头筛选的当前值,按页面字段 id 归集;形状与表格视图状态同源。 */
export type { QueryHeaderFilters } from '@metriccanvas/data-execution/runtime';

export interface PageSnapshotStream extends Subscribable<PageDataSnapshots> {
  captureQueries(): ReadonlyMap<string, EffectiveQuery>;
  captureComputeYear(): number;
  getQueryPageSize(dataSourceId: string): number | undefined;
  setQueryPage(dataSourceId: string, pageIndex: number): void;
  setQueryPageSize(dataSourceId: string, pageSize: number): void;
  /** 服务端排序;数组序即优先级,空数组表示恢复查询定义自带的顺序。 */
  setQuerySort(
    dataSourceId: string,
    sort: ReadonlyArray<{ field: string; direction: 'asc' | 'desc' }>
  ): void;
  setQueryHeaderFilters(dataSourceId: string, filters: QueryHeaderFilters): void;
  setQuerySearch(dataSourceId: string, search: { fields: readonly string[]; query: string }): void;
}

interface DataSourceBinding {
  sourceId: string;
  dataSource: DataSource;
}

interface QueryBinding extends DataSourceBinding {
  dataSource: QueryDataSource;
  pagination?: { limit: number };
  automaticPagination?: boolean;
}

/**
 * 页面数据编排器：只执行被组件数据槽或 AI 总结关联数据引用的数据源。
 *
 * inline 数据立即成为终态；query 数据按生效查询去重、缓存并限制并发。
 * 快照按 dataSourceId 唯一存储，组件数据槽由 Runtime UI 在渲染时投影。
 */
export function orchestrate(
  page: Page,
  gateway: DataGateway,
  filters?: FilterState,
  diagnostics?: Pick<QueryDiagnosticContext, 'pageRevisionId'>,
  execution?: Pick<import('./execution').ExecutionBootstrap, 'filters' | 'snapshots' | 'sourceKeys'>
): PageSnapshotStream {
  const bindings = collectReferencedSources(page);
  const queryBindings = bindings.filter(isQueryBinding);
  const defaults = initialFilterValues(page.filters ?? []);
  const subscribers = new Set<(value: PageDataSnapshots) => void>();
  const diagnosticBase: QueryDiagnosticContext = {
    pageId: page.id,
    ...(diagnostics?.pageRevisionId !== undefined
      ? { pageRevisionId: diagnostics.pageRevisionId }
      : {})
  };
  let session: Session | null = null;

  return {
    subscribe(run) {
      subscribers.add(run);
      session ??= startSession(bindings, queryBindings, gateway, filters, (snapshots) => {
        for (const subscriber of subscribers) notify(subscriber, snapshots);
      }, defaults, diagnosticBase, execution);
      notify(run, session.current());
      return () => {
        if (!subscribers.delete(run)) return;
        if (subscribers.size === 0) {
          session?.dispose();
          session = null;
        }
      };
    },
    captureQueries() {
      return session?.captureQueries() ?? new Map();
    },
    captureComputeYear() { return session?.captureComputeYear() ?? new Date().getFullYear(); },
    getQueryPageSize(dataSourceId) { return session?.getQueryPageSize(dataSourceId); },
    setQueryPage(dataSourceId, pageIndex) {
      session?.setQueryPage(dataSourceId, pageIndex);
    },
    setQueryPageSize(dataSourceId, pageSize) {
      session?.setQueryPageSize(dataSourceId, pageSize);
    },
    setQuerySort(dataSourceId, sort) {
      session?.setQuerySort(dataSourceId, sort);
    },
    setQueryHeaderFilters(dataSourceId, filters) {
      session?.setQueryHeaderFilters(dataSourceId, filters);
    },
    setQuerySearch(dataSourceId, search) { session?.setQuerySearch(dataSourceId, search); }
  };
}

interface Session {
  current(): PageDataSnapshots;
  captureQueries(): ReadonlyMap<string, EffectiveQuery>;
  captureComputeYear(): number;
  getQueryPageSize(dataSourceId: string): number | undefined;
  setQueryPage(dataSourceId: string, pageIndex: number): void;
  setQueryPageSize(dataSourceId: string, pageSize: number): void;
  setQuerySort(
    dataSourceId: string,
    sort: ReadonlyArray<{ field: string; direction: 'asc' | 'desc' }>
  ): void;
  setQueryHeaderFilters(dataSourceId: string, filters: QueryHeaderFilters): void;
  setQuerySearch(dataSourceId: string, search: { fields: readonly string[]; query: string }): void;
  dispose(): void;
}

/**
 * 一次在途的生效查询执行:members 记录发起时各数据源的请求代次,
 * controller 承载真取消信号(issue #53)。生效查询去重后一次执行可
 * 服务多个数据源成员。
 */
interface InFlightRequest {
  members: ReadonlyArray<[QueryBinding, number]>;
  controller: AbortController;
}

function collectReferencedSources(page: Page): DataSourceBinding[] {
  const sourceIds = new Set<string>();
  const paginationLimits = new Map<string, number>();
  const automaticSources = automaticQueryTableSources(page);
  for (const component of flattenPageComponents({ sections: page.sections,
    detailViews: page.detailViews?.filter(view => view.mode === 'snapshot') })) {
    for (const sourceId of Object.values(component.data ?? {})) {
      sourceIds.add(sourceId);
    }
    if (component.type === 'aiSummary') {
      for (const related of Object.values(component.props.relatedData)) {
        sourceIds.add(related.source);
      }
    }
    if (component.type !== 'table' || component.props.pagination?.mode !== 'query') {
      continue;
    }
    const source = page.dataSources[component.data.main];
    const limit = source?.source.type === 'query'
      ? declaredPaginationLimit(source.source.query)
      : undefined;
    if (limit !== undefined) {
      paginationLimits.set(component.data.main, limit);
    }
  }
  // Set 迭代会访问新加入的项，收集整个依赖闭包（含无组件直连的辅助源）。
  for (const id of sourceIds) {
    for (const dependency of [...computeDependencies(page.dataSources[id]?.compute ?? []), ...queryResultDependencies(page.dataSources[id])]) sourceIds.add(dependency);
  }
  return [...sourceIds].flatMap((sourceId) => {
    const dataSource = page.dataSources[sourceId];
    if (!dataSource) return [];
    const limit = paginationLimits.get(sourceId);
    return [{
      sourceId,
      dataSource,
      ...(automaticSources.has(sourceId) ? { automaticPagination: true } : {}),
      ...(limit === undefined ? {} : { pagination: { limit } })
    }];
  });
}

function isQueryBinding(binding: DataSourceBinding): binding is QueryBinding {
  return binding.dataSource.source.type === 'query';
}

function activateAutomaticPagination(binding: QueryBinding, snapshot: DataSnapshot | undefined): boolean {
  if (!binding.automaticPagination || binding.pagination) return false;
  const limit = automaticQueryPageSize(binding.dataSource, snapshot);
  if (limit === undefined) return false;
  binding.pagination = { limit };
  return true;
}

function hasReusableInitial(binding: DataSourceBinding): boolean {
  if (!isQueryBinding(binding)) return false;
  const initial = binding.dataSource.source.initial;
  if (!initial) return false;
  const { rows, totalCount } = initial;
  // Unpaged initial rows are a first-screen snapshot, even when partial.
  // Completeness is presented separately; it must not trigger a background query.
  if (!binding.pagination) return true;
  // Explicit query pagination still requires a complete first page.
  if (totalCount === undefined || totalCount === rows.length) return true;
  return binding.pagination !== undefined
    && rows.length === Math.min(binding.pagination.limit, totalCount);
}

function initialSnapshots(
  bindings: DataSourceBinding[],
  useEmbeddedInitialRows: boolean
): Map<string, DataSnapshot> {
  return new Map(
    bindings.map((binding) => [
      binding.sourceId,
      binding.dataSource.source.type === 'inline'
        ? rawSnapshot(binding.dataSource.source.rows)
        : useEmbeddedInitialRows && hasReusableInitial(binding) && binding.dataSource.source.initial
          ? rawSnapshot(
              binding.dataSource.source.initial.rows,
              binding.dataSource.source.initial.totalCount
            )
        : { status: 'loading' }
    ])
  );
}

function notify(run: (value: PageDataSnapshots) => void, snapshots: PageDataSnapshots): void {
  try {
    run(snapshots);
  } catch (cause) {
    console.error('数据快照订阅方回调抛出异常（已隔离）：', cause);
  }
}

function startSession(
  bindings: DataSourceBinding[],
  queryBindings: QueryBinding[],
  gateway: DataGateway,
  filters: FilterState | undefined,
  push: (snapshots: PageDataSnapshots) => void,
  defaults: FilterValues,
  diagnosticBase: QueryDiagnosticContext,
  execution?: Pick<import('./execution').ExecutionBootstrap, 'filters' | 'snapshots' | 'sourceKeys'>
): Session {
  let values: FilterValues = filters ? new Map() : defaults;
  let primed = false;
  const unsubscribeFilters = filters?.subscribe((next) => {
    if (!primed) {
      primed = true;
      values = next;
    }
  });
  const useEmbeddedInitialRows = !execution && sameFilterValues(values, defaults);
  // Existing initial is consumed even when captures differ or a dependent source is missing.
  let rawSnapshots = initialSnapshots(bindings, useEmbeddedInitialRows);
  const sources = new Map(bindings.map(binding => [binding.sourceId, binding.dataSource]));
  const executionMatches = new Set<string>();
  if (execution && sameFilterValues(values, execution.filters)) for (const binding of queryBindings) {
    const snapshot = execution.snapshots.get(binding.sourceId);
    if (snapshot && execution.sourceKeys.get(binding.sourceId) === executionSourceKey(binding.dataSource)) {
      executionMatches.add(binding.sourceId);
      rawSnapshots.set(binding.sourceId, snapshot);
    }
  }
  for (const binding of queryBindings) {
    activateAutomaticPagination(binding, rawSnapshots.get(binding.sourceId));
  }
  const currentYear = new Date().getFullYear();
  const computationContext = (): ComputationContext => ({
    currentYear,
    modes: new Map([...values].flatMap(([id, value]) => value.type === 'dimension' ? [[id, value.values] as const] : [])),
    ranges: new Map([...values].flatMap(([id, value]) => value.type === 'timeRange' ? [[id, { from: value.from, to: value.to }] as const] : []))
  });
  let snapshots = computedSnapshots(sources, rawSnapshots, computationContext());
  const sequences = new Map<string, number>();
  const inFlightRequests = new Set<InFlightRequest>();
  const cache = new Map<string, DataSnapshot>();
  const waitingQueries = new Set<string>();
  const pageIndexes = new Map(
    queryBindings
      .filter((binding) => binding.pagination)
      .map((binding) => [binding.sourceId, 0])
  );
  // 排序与表头筛选是会话态,不进页面文档:它们是用户当下的看法,
  // 不是页面的声明。
  const sortRules = new Map<string, Array<{ field: string; direction: 'asc' | 'desc' }>>();
  const headerFilters = new Map<string, QueryHeaderFilters>();
  const searches = new Map<string, { fields: readonly string[]; query: string }>();
  let disposed = false;
  let inFlight = 0;
  const waiters: Array<() => void> = [];
  const maxInFlight = 5;

  function withSlot(task: () => void): void {
    if (disposed) return;
    if (inFlight < maxInFlight) {
      inFlight += 1;
      task();
    } else {
      waiters.push(task);
    }
  }

  function release(): void {
    if (disposed) return;
    const next = waiters.shift();
    if (next) next();
    else inFlight -= 1;
  }

  function isStale(binding: QueryBinding, sequence: number): boolean {
    return sequences.get(binding.sourceId) !== sequence;
  }

  /**
   * 真取消(issue #53):请求代次推进后,在途请求若已不服务任何当前代次
   * 成员,则中止其底层执行,而不是只丢弃迟到结果。去重共享的执行只要
   * 仍有一个成员在当前代次就继续;未被本轮筛选或分页触及的查询定义
   * 代次不变,不会发生误取消。
   */
  function abortStaleRequests(): void {
    for (const request of inFlightRequests) {
      if (request.members.every(([binding, sequence]) => isStale(binding, sequence))) {
        inFlightRequests.delete(request);
        request.controller.abort();
      }
    }
  }

  const windowLimits = () => new Map(queryBindings.flatMap(binding => binding.pagination ? [[binding.sourceId, binding.pagination.limit] as const] : []));
  const cascaded = cascadeSourceIds(Object.fromEntries(sources));

  function publish(updates: ReadonlyArray<[QueryBinding, DataSnapshot]>): void {
    if (updates.length === 0) return;
    const next = new Map(rawSnapshots);
    for (const [binding, snapshot] of updates) {
      if (activateAutomaticPagination(binding, snapshot)) pageIndexes.set(binding.sourceId, 0);
      next.set(binding.sourceId, snapshot);
    }
    rawSnapshots = next;
    snapshots = computedSnapshots(sources, rawSnapshots, computationContext());
    push(snapshots);
    if (updates.some(([, snapshot]) => snapshot.status !== 'loading')) {
      const ready = queryBindings.filter(binding => waitingQueries.has(binding.sourceId) &&
        resolveQueryResultInputs(binding.dataSource, rawSnapshots, sources, windowLimits()).status !== 'waiting');
      if (ready.length) refetch(ready, false);
    }
  }

  function refetch(targets: QueryBinding[], publishLoading: boolean): void {
    if (targets.length === 0 || disposed) return;
    if (publishLoading) {
      const roots = new Set(targets.map(binding => binding.sourceId));
      const ids = new Set(roots);
      let size = -1;
      while (size !== ids.size) {
        size = ids.size;
        for (const binding of queryBindings) if (queryResultDependencies(binding.dataSource).some(id => ids.has(id))) ids.add(binding.sourceId);
      }
      for (const id of ids) if (!roots.has(id)) pageIndexes.set(id, 0);
      targets = queryBindings.filter(binding => ids.has(binding.sourceId));
    }
    for (const binding of targets) {
      waitingQueries.delete(binding.sourceId);
      sequences.set(binding.sourceId, (sequences.get(binding.sourceId) ?? 0) + 1);
    }
    abortStaleRequests();
    if (publishLoading) publish(targets.map((binding) => [binding, { status: 'loading' }]));

    const groups = new Map<
      string,
      { query: EffectiveQuery; members: Array<[QueryBinding, number]> }
    >();
    for (const binding of targets) {
      const input = resolveQueryResultInputs(binding.dataSource, rawSnapshots, sources, windowLimits());
      if (input.status === 'waiting') { waitingQueries.add(binding.sourceId); continue; }
      if (input.status === 'terminal') { publish([[binding, input.snapshot]]); continue; }
      const query = composeEffectiveQuery(
        binding,
        values,
        pageIndexes.get(binding.sourceId) ?? 0,
        sortRules.get(binding.sourceId) ?? [],
        headerFilters.get(binding.sourceId) ?? {},
        searches.get(binding.sourceId)
      );
      query.filterValues.push(...input.values);
      const key = JSON.stringify(query);
      const group = groups.get(key) ?? { query, members: [] };
      group.members.push([binding, sequences.get(binding.sourceId)!]);
      groups.set(key, group);
    }

    for (const [cacheKey, { query, members }] of groups) {
      const land = (snapshot: DataSnapshot) => {
        if (disposed) return;
        publish(
          members
            .filter(([binding, sequence]) => !isStale(binding, sequence))
            .map(([binding]) => [binding, snapshot])
        );
      };
      const cached = cache.get(cacheKey);
      if (cached) {
        land(cached);
        continue;
      }
      const diagnosticContext: QueryDiagnosticContext = {
        ...diagnosticBase,
        dataSourceIds: members.map(([binding]) => binding.sourceId)
      };
      const request: InFlightRequest = { members, controller: new AbortController() };
      inFlightRequests.add(request);
      withSlot(() => {
        void executeQuery(query, gateway, diagnosticContext, request.controller.signal).then(
          (snapshot) => {
            inFlightRequests.delete(request);
            release();
            const correctedPage = correctedPageIndex(query, snapshot);
            if (correctedPage !== undefined) {
              // 越界页纠偏只对仍在当前代次的成员生效:过期成员已有新请求
              // 在途,不得回写其页码或推进其代次(取消失败的迟到结果同理)。
              const corrected = members
                .filter(([binding, sequence]) => !isStale(binding, sequence))
                .map(([binding]) => binding);
              for (const binding of corrected) {
                pageIndexes.set(binding.sourceId, correctedPage);
              }
              refetch(corrected, false);
              return;
            }
            if (snapshot.status === 'ready' || snapshot.status === 'empty') {
              cache.set(cacheKey, snapshot);
            }
            land(snapshot);
          }
        );
      });
    }
  }

  unsubscribeFilters?.();
  const unsubscribeLiveFilters = filters?.subscribe((next) => {
    if (!primed) {
      primed = true;
      values = next;
      return;
    }
    const changed = changedFilterIds(values, next);
    values = next;
    const targets = queryBindings.filter((binding) =>
        Object.keys(binding.dataSource.source.query.filterBindings ?? {}).some((id) =>
          changed.has(id)
        )
      );
    for (const binding of targets) {
      if (binding.pagination) pageIndexes.set(binding.sourceId, 0);
    }
    if (targets.length === 0 && changed.size > 0) {
      snapshots = computedSnapshots(sources, rawSnapshots, computationContext());
      push(snapshots);
    } else refetch(targets, true);
  });

  refetch(
    queryBindings.filter(
      (binding) => !(executionMatches.has(binding.sourceId)) && !(useEmbeddedInitialRows && hasReusableInitial(binding) && binding.dataSource.source.initial)
    ),
    false
  );

  return {
    current: () => snapshots,
    captureComputeYear: () => currentYear,
    getQueryPageSize: id => queryBindings.find(binding => binding.sourceId === id)?.pagination?.limit,
    captureQueries() {
      return new Map(queryBindings.map(binding => {
        const query = composeEffectiveQuery(binding, values, cascaded.has(binding.sourceId) ? pageIndexes.get(binding.sourceId) ?? 0 : 0, sortRules.get(binding.sourceId) ?? [], headerFilters.get(binding.sourceId) ?? {}, searches.get(binding.sourceId));
        const input = resolveQueryResultInputs(binding.dataSource, rawSnapshots, sources, windowLimits());
        if (input.status === 'ready') query.filterValues.push(...input.values);
        return [binding.sourceId, structuredClone(query)];
      }));
    },
    setQueryPage(dataSourceId, pageIndex) {
      if (!Number.isInteger(pageIndex) || pageIndex < 0) return;
      const binding = queryBindings.find(
        (candidate) => candidate.sourceId === dataSourceId && candidate.pagination
      );
      if (!binding || pageIndexes.get(dataSourceId) === pageIndex) return;
      pageIndexes.set(dataSourceId, pageIndex);
      refetch([binding], true);
    },
    setQueryPageSize(dataSourceId, pageSize) {
      if (!Number.isInteger(pageSize) || pageSize <= 0) return;
      const binding = queryBindings.find(
        (candidate) => candidate.sourceId === dataSourceId && candidate.pagination
      );
      if (!binding?.pagination || binding.pagination.limit === pageSize) return;
      binding.pagination.limit = pageSize;
      pageIndexes.set(dataSourceId, 0);
      refetch([binding], true);
    },
    // 排序与表头筛选都改变结果集的组成,页码一律回到第一页:停在第 5 页
    // 看新排序的第 5 页是没有意义的。
    setQuerySort(dataSourceId, sort) {
      const binding = queryBindings.find((candidate) => candidate.sourceId === dataSourceId);
      if (!binding || (!binding.pagination && queryBindings.some(candidate => queryResultDependencies(candidate.dataSource).includes(dataSourceId)))) return;
      const next = sort.map((rule) => ({ ...rule }));
      if (JSON.stringify(sortRules.get(dataSourceId) ?? []) === JSON.stringify(next)) return;
      sortRules.set(dataSourceId, next);
      pageIndexes.set(dataSourceId, 0);
      refetch([binding], true);
    },
    setQueryHeaderFilters(dataSourceId, filters) {
      const binding = queryBindings.find((candidate) => candidate.sourceId === dataSourceId);
      if (!binding || (!binding.pagination && queryBindings.some(candidate => queryResultDependencies(candidate.dataSource).includes(dataSourceId)))) return;
      if (JSON.stringify(headerFilters.get(dataSourceId) ?? {}) === JSON.stringify(filters)) return;
      headerFilters.set(dataSourceId, filters);
      pageIndexes.set(dataSourceId, 0);
      refetch([binding], true);
    },
    setQuerySearch(dataSourceId, search) {
      const binding = queryBindings.find(candidate => candidate.sourceId === dataSourceId);
      if (!binding) return;
      const next = { fields: [...search.fields], query: search.query.trim() };
      if (JSON.stringify(searches.get(dataSourceId)) === JSON.stringify(next)) return;
      searches.set(dataSourceId, next);
      pageIndexes.set(dataSourceId, 0);
      refetch([binding], true);
    },
    dispose() {
      disposed = true;
      waiters.length = 0;
      // 运行时会话结束(页面卸载或页面修订切换):中止仍在运行的查询。
      for (const request of inFlightRequests) {
        request.controller.abort();
      }
      inFlightRequests.clear();
      unsubscribeLiveFilters?.();
    }
  };
}

function correctedPageIndex(
  query: EffectiveQuery,
  snapshot: DataSnapshot
): number | undefined {
  if (!query.pagination || snapshot.status === 'loading' || snapshot.status === 'error') {
    return undefined;
  }
  const totalCount = snapshot.totalCount;
  if (totalCount === undefined || totalCount === 0 || query.pagination.offset < totalCount) {
    return undefined;
  }
  return Math.max(0, Math.ceil(totalCount / query.pagination.limit) - 1);
}

function changedFilterIds(before: FilterValues, after: FilterValues): Set<string> {
  const changed = new Set<string>();
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    if (JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id))) {
      changed.add(id);
    }
  }
  return changed;
}

function sameFilterValues(left: FilterValues, right: FilterValues): boolean {
  return changedFilterIds(left, right).size === 0;
}
