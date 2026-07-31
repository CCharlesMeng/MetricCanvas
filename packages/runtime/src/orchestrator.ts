import {
  isDataComponent,
  type DataComponent,
  type DataSnapshot,
  type DataSource,
  type EffectiveQuery,
  type Page,
  type QueryDataSource
} from '@metriccanvas/page';
import type { FilterState, FilterValues } from './filter-state';
import type { DataGateway } from './ports';

/** 单个组件按命名数据槽分发的数据快照。 */
export type ComponentSnapshots = ReadonlyMap<string, DataSnapshot>;

/** 页面数据快照：组件 id → 数据槽 → 快照。 */
export type PageSnapshots = ReadonlyMap<string, ComponentSnapshots>;

/** 兼容 Svelte store 的最小订阅契约。 */
export interface Subscribable<T> {
  subscribe(run: (value: T) => void): () => void;
}

export type PageSnapshotStream = Subscribable<PageSnapshots>;

interface DataBinding {
  key: string;
  component: DataComponent;
  slot: string;
  dataSource: DataSource;
}

interface QueryBinding extends DataBinding {
  dataSource: QueryDataSource;
}

/**
 * 页面数据编排器：直接消费 Page，并统一执行 inline 与 query 数据源。
 *
 * inline 数据立即成为终态；query 数据按生效查询去重、缓存并限制并发。
 * 页面筛选仅通过 DQE `filterBindings` 写入明确的外部字段，组件展示状态不会
 * 被偷偷翻译为查询协议。
 */
export function orchestrate(
  page: Page,
  gateway: DataGateway,
  filters?: FilterState
): PageSnapshotStream {
  const bindings = collectBindings(page);
  const queryBindings = bindings.filter(isQueryBinding);
  const subscribers = new Set<(value: PageSnapshots) => void>();
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
  current(): PageSnapshots;
  dispose(): void;
}

function collectBindings(page: Page): DataBinding[] {
  const bindings: DataBinding[] = [];
  for (const section of page.sections) {
    for (const component of section.components) {
      if (!isDataComponent(component)) continue;
      for (const [slot, sourceId] of Object.entries(component.data)) {
        const dataSource = page.dataSources[sourceId];
        if (!dataSource) continue;
        bindings.push({
          key: `${component.id}\u0000${slot}`,
          component,
          slot,
          dataSource
        });
      }
    }
  }
  return bindings;
}

function isQueryBinding(binding: DataBinding): binding is QueryBinding {
  return binding.dataSource.source.type === 'query';
}

function initialSnapshots(bindings: DataBinding[]): Map<string, ComponentSnapshots> {
  const snapshots = new Map<string, ComponentSnapshots>();
  for (const binding of bindings) {
    const slots = new Map(snapshots.get(binding.component.id) ?? []);
    slots.set(
      binding.slot,
      binding.dataSource.source.type === 'inline'
        ? rowsSnapshot(binding.dataSource.source.rows)
        : { status: 'loading' }
    );
    snapshots.set(binding.component.id, slots);
  }
  return snapshots;
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

function notify(run: (value: PageSnapshots) => void, snapshots: PageSnapshots): void {
  try {
    run(snapshots);
  } catch (cause) {
    console.error('数据快照订阅方回调抛出异常（已隔离）：', cause);
  }
}

function startSession(
  bindings: DataBinding[],
  queryBindings: QueryBinding[],
  gateway: DataGateway,
  filters: FilterState | undefined,
  push: (snapshots: PageSnapshots) => void
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
    const changed = new Map<string, Map<string, DataSnapshot>>();
    for (const [binding, snapshot] of updates) {
      let slots = changed.get(binding.component.id);
      if (!slots) {
        slots = new Map(next.get(binding.component.id) ?? []);
        changed.set(binding.component.id, slots);
        next.set(binding.component.id, slots);
      }
      slots.set(binding.slot, snapshot);
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
      sequences.set(binding.key, (sequences.get(binding.key) ?? 0) + 1);
    }

    const groups = new Map<
      string,
      { query: EffectiveQuery; members: Array<[QueryBinding, number]> }
    >();
    for (const binding of targets) {
      const query = composeEffectiveQuery(binding.dataSource, values);
      const key = JSON.stringify(query);
      const group = groups.get(key) ?? { query, members: [] };
      group.members.push([binding, sequences.get(binding.key)!]);
      groups.set(key, group);
    }

    for (const [cacheKey, { query, members }] of groups) {
      const land = (snapshot: DataSnapshot) => {
        if (disposed) return;
        publish(
          members
            .filter(([binding, sequence]) => sequences.get(binding.key) === sequence)
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
