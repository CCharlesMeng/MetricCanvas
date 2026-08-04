import {
  type DataSnapshot,
  type DataSource,
  type EffectiveQuery,
  type Page,
  type QueryDataSource
} from '@metriccanvas/page';
import type { FilterState, FilterValues } from './filter-state';
import type { DataGateway } from './ports';

/** 页面数据快照的唯一真元：页面数据源 id → 快照。 */
export type PageDataSnapshots = ReadonlyMap<string, DataSnapshot>;

/** 兼容 Svelte store 的最小订阅契约。 */
export interface Subscribable<T> {
  subscribe(run: (value: T) => void): () => void;
}

export type PageSnapshotStream = Subscribable<PageDataSnapshots>;

interface DataSourceBinding {
  sourceId: string;
  dataSource: DataSource;
}

interface QueryBinding extends DataSourceBinding {
  dataSource: QueryDataSource;
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
  filters?: FilterState
): PageSnapshotStream {
  const bindings = collectReferencedSources(page);
  const queryBindings = bindings.filter(isQueryBinding);
  const subscribers = new Set<(value: PageDataSnapshots) => void>();
  let session: Session | null = null;

  return {
    subscribe(run) {
      subscribers.add(run);
      session ??= startSession(bindings, queryBindings, gateway, filters, (snapshots) => {
        for (const subscriber of subscribers) notify(subscriber, snapshots);
      });
      notify(run, session.current());
      return () => {
        if (!subscribers.delete(run)) return;
        if (subscribers.size === 0) {
          session?.dispose();
          session = null;
        }
      };
    }
  };
}

interface Session {
  current(): PageDataSnapshots;
  dispose(): void;
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
  return [...sourceIds].flatMap((sourceId) => {
    const dataSource = page.dataSources[sourceId];
    return dataSource ? [{ sourceId, dataSource }] : [];
  });
}

function isQueryBinding(binding: DataSourceBinding): binding is QueryBinding {
  return binding.dataSource.source.type === 'query';
}

function initialSnapshots(bindings: DataSourceBinding[]): Map<string, DataSnapshot> {
  return new Map(
    bindings.map((binding) => [
      binding.sourceId,
      binding.dataSource.source.type === 'inline'
        ? rowsSnapshot(binding.dataSource.source.rows)
        : { status: 'loading' }
    ])
  );
}

function rowsSnapshot(
  rows: ReadonlyArray<Record<string, unknown>>
): DataSnapshot {
  return rows.length === 0
    ? { status: 'empty' }
    : {
        status: 'ready',
        rows: rows as Extract<DataSnapshot, { status: 'ready' }>['rows']
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
  push: (snapshots: PageDataSnapshots) => void
): Session {
  let snapshots = initialSnapshots(bindings);
  const sequences = new Map<string, number>();
  const cache = new Map<string, DataSnapshot>();
  let values: FilterValues = new Map();
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

    const groups = new Map<
      string,
      { query: EffectiveQuery; members: Array<[QueryBinding, number]> }
    >();
    for (const binding of targets) {
      const query = composeEffectiveQuery(binding.dataSource, values);
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
            .filter(([binding, sequence]) => sequences.get(binding.sourceId) === sequence)
            .map(([binding]) => [binding, snapshot])
        );
      };
      const cached = cache.get(cacheKey);
      if (cached) {
        land(cached);
        continue;
      }
      withSlot(() => {
        void execute(query, gateway).then((snapshot) => {
          release();
          if (snapshot.status === 'ready' || snapshot.status === 'empty') {
            cache.set(cacheKey, snapshot);
          }
          land(snapshot);
        });
      });
    }
  }

  let primed = false;
  const unsubscribeFilters = filters?.subscribe((next) => {
    if (!primed) {
      primed = true;
      values = next;
      return;
    }
    const changed = changedFilterIds(values, next);
    values = next;
    refetch(
      queryBindings.filter((binding) =>
        Object.keys(binding.dataSource.source.query.filterBindings ?? {}).some((id) =>
          changed.has(id)
        )
      ),
      true
    );
  });

  refetch(queryBindings, false);

  return {
    current: () => snapshots,
    dispose() {
      disposed = true;
      waiters.length = 0;
      unsubscribeFilters?.();
    }
  };
}

function composeEffectiveQuery(
  dataSource: QueryDataSource,
  values: FilterValues
): EffectiveQuery {
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
  return {
    language: 'dqe',
    body: query.body,
    fieldMappings: dataSource.fields,
    filterValues
  };
}

async function execute(
  query: EffectiveQuery,
  gateway: DataGateway
): Promise<DataSnapshot> {
  try {
    return rowsSnapshot(await gateway.fetchData(query));
  } catch (cause) {
    return {
      status: 'error',
      error: { message: cause instanceof Error ? cause.message : String(cause) }
    };
  }
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
