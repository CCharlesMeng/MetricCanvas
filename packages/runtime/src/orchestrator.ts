import {
  declaredPaginationLimit,
  isQueryErrorCode,
  type DataSnapshot,
  type DataSource,
  type EffectiveQuery,
  type Page,
  type QueryDataSource,
  type QueryError
} from '@metriccanvas/page';
import {
  initialFilterValues,
  type FilterState,
  type FilterValues
} from './filter-state';
import type { DataGateway, QueryDiagnosticContext } from './ports';

/** 页面数据快照的唯一真元：页面数据源 id → 快照。 */
export type PageDataSnapshots = ReadonlyMap<string, DataSnapshot>;

/** 兼容 Svelte store 的最小订阅契约。 */
export interface Subscribable<T> {
  subscribe(run: (value: T) => void): () => void;
}

export interface PageSnapshotStream extends Subscribable<PageDataSnapshots> {
  setQueryPage(dataSourceId: string, pageIndex: number): void;
  setQueryPageSize(dataSourceId: string, pageSize: number): void;
}

interface DataSourceBinding {
  sourceId: string;
  dataSource: DataSource;
}

interface QueryBinding extends DataSourceBinding {
  dataSource: QueryDataSource;
  pagination?: { limit: number };
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
  diagnostics?: Pick<QueryDiagnosticContext, 'pageRevisionId'>
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
      }, defaults, diagnosticBase);
      notify(run, session.current());
      return () => {
        if (!subscribers.delete(run)) return;
        if (subscribers.size === 0) {
          session?.dispose();
          session = null;
        }
      };
    },
    setQueryPage(dataSourceId, pageIndex) {
      session?.setQueryPage(dataSourceId, pageIndex);
    },
    setQueryPageSize(dataSourceId, pageSize) {
      session?.setQueryPageSize(dataSourceId, pageSize);
    }
  };
}

interface Session {
  current(): PageDataSnapshots;
  setQueryPage(dataSourceId: string, pageIndex: number): void;
  setQueryPageSize(dataSourceId: string, pageSize: number): void;
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
  for (const section of page.sections) {
    for (const component of section.components) {
      for (const sourceId of Object.values(component.data ?? {})) {
        sourceIds.add(sourceId);
      }
      if (component.type === 'aiSummary') {
        for (const related of Object.values(component.props.relatedData)) {
          sourceIds.add(related.source);
        }
      }
    }
  }
  // 分页页大小取查询定义自述的协议中立分页能力,编排层不解析协议内部结构。
  const paginationLimits = new Map<string, number>();
  for (const section of page.sections) {
    for (const component of section.components) {
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
  }
  return [...sourceIds].flatMap((sourceId) => {
    const dataSource = page.dataSources[sourceId];
    if (!dataSource) return [];
    const limit = paginationLimits.get(sourceId);
    return [{
      sourceId,
      dataSource,
      ...(limit === undefined ? {} : { pagination: { limit } })
    }];
  });
}

function isQueryBinding(binding: DataSourceBinding): binding is QueryBinding {
  return binding.dataSource.source.type === 'query';
}

function initialSnapshots(
  bindings: DataSourceBinding[],
  useEmbeddedInitialRows: boolean
): Map<string, DataSnapshot> {
  return new Map(
    bindings.map((binding) => [
      binding.sourceId,
      binding.dataSource.source.type === 'inline'
        ? rowsSnapshot(binding.dataSource.source.rows)
        : useEmbeddedInitialRows && binding.dataSource.source.initial
          ? rowsSnapshot(
              binding.dataSource.source.initial.rows,
              binding.dataSource.source.initial.totalCount
            )
        : { status: 'loading' }
    ])
  );
}

function rowsSnapshot(
  rows: ReadonlyArray<Record<string, unknown>>,
  totalCount?: number
): DataSnapshot {
  return rows.length === 0
    ? { status: 'empty', ...(totalCount === undefined ? {} : { totalCount }) }
    : {
        status: 'ready',
        rows: rows as Extract<DataSnapshot, { status: 'ready' }>['rows'],
        ...(totalCount === undefined ? {} : { totalCount })
      };
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
  diagnosticBase: QueryDiagnosticContext
): Session {
  let values: FilterValues = filters ? new Map() : defaults;
  let primed = false;
  const unsubscribeFilters = filters?.subscribe((next) => {
    if (!primed) {
      primed = true;
      values = next;
    }
  });
  const useEmbeddedInitialRows = sameFilterValues(values, defaults);
  let snapshots = initialSnapshots(bindings, useEmbeddedInitialRows);
  const sequences = new Map<string, number>();
  const inFlightRequests = new Set<InFlightRequest>();
  const cache = new Map<string, DataSnapshot>();
  const pageIndexes = new Map(
    queryBindings
      .filter((binding) => binding.pagination)
      .map((binding) => [binding.sourceId, 0])
  );
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

  function publish(updates: ReadonlyArray<[QueryBinding, DataSnapshot]>): void {
    if (updates.length === 0) return;
    const next = new Map(snapshots);
    for (const [binding, snapshot] of updates) {
      next.set(binding.sourceId, snapshot);
    }
    snapshots = next;
    push(snapshots);
  }

  function refetch(targets: QueryBinding[], publishLoading: boolean): void {
    if (targets.length === 0 || disposed) return;
    if (publishLoading) {
      publish(targets.map((binding) => [binding, { status: 'loading' }]));
    }
    for (const binding of targets) {
      sequences.set(binding.sourceId, (sequences.get(binding.sourceId) ?? 0) + 1);
    }
    abortStaleRequests();

    const groups = new Map<
      string,
      { query: EffectiveQuery; members: Array<[QueryBinding, number]> }
    >();
    for (const binding of targets) {
      const query = composeEffectiveQuery(
        binding,
        values,
        pageIndexes.get(binding.sourceId) ?? 0
      );
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
        void execute(query, gateway, diagnosticContext, request.controller.signal).then(
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
    refetch(targets, true);
  });

  refetch(
    queryBindings.filter(
      (binding) => !(useEmbeddedInitialRows && binding.dataSource.source.initial)
    ),
    false
  );

  return {
    current: () => snapshots,
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

function composeEffectiveQuery(
  binding: QueryBinding,
  values: FilterValues,
  pageIndex: number
): EffectiveQuery {
  const dataSource = binding.dataSource;
  const query = dataSource.source.query;
  const filterValues: EffectiveQuery['filterValues'] = [];
  for (const [filterId, binding] of Object.entries(query.filterBindings ?? {})) {
    const value = values.get(filterId);
    if (binding.target === 'dimension' && value?.type === 'dimension') {
      filterValues.push({
        target: 'dimension',
        queryField: binding.queryField,
        values: value.values
      });
    } else if (binding.target === 'time' && value?.type === 'timeRange') {
      filterValues.push({
        target: 'time',
        value: { from: value.from, to: value.to }
      });
    }
  }
  // language 与查询体按数据源的查询定义分支原样透传,编排层不合成协议细节。
  return {
    language: query.language,
    body: query.body,
    fieldMappings: dataSource.fields,
    ...(binding.pagination
      ? {
          pagination: {
            offset: pageIndex * binding.pagination.limit,
            limit: binding.pagination.limit
          }
        }
      : {}),
    filterValues
  };
}

async function execute(
  query: EffectiveQuery,
  gateway: DataGateway,
  diagnosticContext: QueryDiagnosticContext,
  signal: AbortSignal
): Promise<DataSnapshot> {
  try {
    const result = await gateway.fetchData(query, diagnosticContext, signal);
    if (query.pagination && result.totalCount === undefined) {
      throw new Error('查询分页结果缺少 totalCount');
    }
    return rowsSnapshot(result.rows, result.totalCount);
  } catch (cause) {
    return { status: 'error', error: preservedQueryError(cause) };
  }
}

/**
 * 把数据网关的拒绝保留为数据快照的结构化查询错误(issue #51)。
 * 按结构判别 code(自定义数据网关不必依赖 DqeGatewayError 类,
 * 跨 realm 时 instanceof 也不可靠);封闭集之外的异常兜底为 UNKNOWN。
 */
function preservedQueryError(cause: unknown): QueryError {
  const code = cause instanceof Error ? (cause as { code?: unknown }).code : undefined;
  return {
    code: isQueryErrorCode(code) ? code : 'UNKNOWN',
    message: cause instanceof Error ? cause.message : String(cause)
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
