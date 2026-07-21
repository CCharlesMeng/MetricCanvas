import {
  isDataComponent,
  type DataComponent,
  type DataSnapshot,
  type DataSource,
  type EffectiveQuery,
  type FilterCondition,
  type OrderByRule,
  type Page,
  type StructuredQuery,
  type TimeRangeValue,
  type TimeWindow
} from '@metriccanvas/page';
import type { FilterState, FilterValues } from './filter-state';
import type { DataGateway } from './ports';

/** 单个组件按命名数据槽分发的数据快照。 */
export type ComponentSnapshots = ReadonlyMap<string, DataSnapshot>;

/**
 * 页面数据快照，第一层键是组件 id，第二层键是组件声明的数据槽。
 * 同一数据源的不同组件绑定各有独立快照，因此表格局部视图不会互相污染。
 */
export type PageSnapshots = ReadonlyMap<string, ComponentSnapshots>;

/**
 * 兼容 svelte store 契约的结构化类型（零 svelte import）：
 * subscribe 立即同步推送当前值，返回退订函数。
 */
export interface Subscribable<T> {
  subscribe(run: (value: T) => void): () => void;
}

/**
 * 组件局部视图。分页、排序和表头筛选不进入页面筛选状态。
 */
export interface ComponentView {
  limit?: number;
  offset?: number;
  orderBy?: OrderByRule[];
  conditions?: FilterCondition[];
}

export interface PageSnapshotStream extends Subscribable<PageSnapshots> {
  /**
   * 更新组件主数据槽的局部视图。只有绑定 query 数据源的组件会重查；
   * 未知组件、无数据组件及 inline 组件均静默忽略。
   */
  setView(componentId: string, view: ComponentView | null): void;
}

export const DEFAULT_TABLE_PAGE_SIZE = 20;

interface DataBinding {
  key: string;
  component: DataComponent;
  slot: string;
  dataSource: DataSource;
}

interface QueryBinding extends DataBinding {
  dataSource: DataSource & { source: { type: 'query'; query: StructuredQuery } };
}

/**
 * 页面数据编排器：直接消费 Page，并统一执行 inline/query/mixed 数据源。
 *
 * - inline 数据槽在首个同步快照中直接进入 ready/empty；
 * - query 数据槽保持 loading → ready|empty|error；
 * - 查询按生效查询去重、缓存并限制并发，筛选变更只重查订阅的数据槽；
 * - 只有每个组件数据槽的最新结果可以落地，最后一个订阅者退订即作废会话；
 * - setView 只改变目标组件主数据槽，同源组件之间不共享视图状态。
 */
export function orchestrate(
  page: Page,
  gateway: DataGateway,
  filters?: FilterState
): PageSnapshotStream {
  const bindings = collectBindings(page);
  const queryBindings = bindings.filter(isQueryBinding);
  const componentIds = new Set(bindings.map((binding) => binding.component.id));
  const subscribers = new Set<(value: PageSnapshots) => void>();
  const views = new Map<string, ComponentView>();
  let session: Session | null = null;

  return {
    subscribe(run) {
      subscribers.add(run);
      session ??= startSession(bindings, queryBindings, gateway, filters, views, (snapshots) => {
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
    },

    setView(componentId, view) {
      if (!componentIds.has(componentId)) return;
      const main = queryBindings.find(
        (binding) => binding.component.id === componentId && binding.slot === 'main'
      );
      if (!main) return;
      if (view === null) views.delete(componentId);
      else views.set(componentId, view);
      session?.refetchBinding(main.key);
    }
  };
}

interface Session {
  current(): PageSnapshots;
  refetchBinding(key: string): void;
  dispose(): void;
}

function collectBindings(page: Page): DataBinding[] {
  const bindings: DataBinding[] = [];
  for (const section of page.sections) {
    for (const component of section.components) {
      if (!isDataComponent(component)) continue;
      for (const [slot, sourceId] of Object.entries(component.data)) {
        const dataSource = page.dataSources[sourceId];
        // Page 应在进入运行时前完成校验。保留此防线，避免不可信对象导致编排器抛错。
        if (!dataSource) continue;
        bindings.push({
          key: bindingKey(component.id, slot),
          component,
          slot,
          dataSource
        });
      }
    }
  }
  return bindings;
}

function bindingKey(componentId: string, slot: string): string {
  return `${componentId}\u0000${slot}`;
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

function rowsSnapshot(rows: ReadonlyArray<Record<string, unknown>>): DataSnapshot {
  return rows.length === 0
    ? { status: 'empty' }
    : { status: 'ready', rows: rows as Extract<DataSnapshot, { status: 'ready' }>['rows'] };
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
  views: ReadonlyMap<string, ComponentView>,
  push: (snapshots: PageSnapshots) => void
): Session {
  let snapshots = initialSnapshots(bindings);
  const byKey = new Map(queryBindings.map((binding) => [binding.key, binding]));
  const sequences = new Map<string, number>();
  const cache = new Map<string, DataSnapshot>();
  let disposed = false;
  let values: FilterValues = new Map();

  const MAX_IN_FLIGHT = 5;
  let inFlight = 0;
  const waiters: Array<() => void> = [];

  function withSlot(task: () => void): void {
    if (disposed) return;
    if (inFlight < MAX_IN_FLIGHT) {
      inFlight++;
      task();
    } else {
      waiters.push(task);
    }
  }

  function release(): void {
    if (disposed) return;
    const next = waiters.shift();
    if (next) next();
    else inFlight--;
  }

  function publish(updates: ReadonlyArray<[QueryBinding, DataSnapshot]>): void {
    if (updates.length === 0) return;
    const next = new Map(snapshots);
    const changedComponents = new Map<string, Map<string, DataSnapshot>>();
    for (const [binding, snapshot] of updates) {
      let slots = changedComponents.get(binding.component.id);
      if (!slots) {
        slots = new Map(next.get(binding.component.id) ?? []);
        changedComponents.set(binding.component.id, slots);
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
      {
        query: EffectiveQuery;
        blindPagination: boolean;
        members: Array<[QueryBinding, number]>;
      }
    >();

    for (const binding of targets) {
      const view = viewFor(binding, views);
      const query = composeEffectiveQuery(binding.dataSource.source.query, values, view);
      const blindPagination = view.limit !== undefined;
      const key = JSON.stringify({ query, blindPagination });
      const group = groups.get(key) ?? { query, blindPagination, members: [] };
      group.members.push([binding, sequences.get(binding.key)!]);
      groups.set(key, group);
    }

    for (const [cacheKey, { query, blindPagination, members }] of groups) {
      const land = (snapshot: DataSnapshot) => {
        if (disposed) return;
        const current = members
          .filter(([binding, sequence]) => sequences.get(binding.key) === sequence)
          .map(([binding]) => [binding, snapshot] as [QueryBinding, DataSnapshot]);
        publish(current);
      };

      const cached = cache.get(cacheKey);
      if (cached) {
        land(cached);
        continue;
      }

      withSlot(() => {
        void execute(query, gateway, blindPagination).then((snapshot) => {
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
    const affected = queryBindings.filter((binding) =>
      (binding.dataSource.source.query.filters?.subscribe ?? []).some((id) => changed.has(id))
    );
    refetch(affected, true);
  });

  refetch(queryBindings, false);

  return {
    current: () => snapshots,
    refetchBinding(key) {
      const binding = byKey.get(key);
      if (binding) refetch([binding], true);
    },
    dispose() {
      disposed = true;
      waiters.length = 0;
      unsubscribeFilters?.();
    }
  };
}

function viewFor(
  binding: QueryBinding,
  views: ReadonlyMap<string, ComponentView>
): ComponentView {
  if (binding.slot !== 'main') return {};
  return views.get(binding.component.id) ?? defaultView(binding.component);
}

function defaultView(component: DataComponent): ComponentView {
  if (component.type === 'table' && component.props.pagination?.mode === 'paged') {
    return {
      limit: component.props.pagination.pageSize ?? DEFAULT_TABLE_PAGE_SIZE,
      offset: 0
    };
  }
  return {};
}

function composeEffectiveQuery(
  query: StructuredQuery,
  values: FilterValues,
  view: ComponentView
): EffectiveQuery {
  const {
    metrics,
    dimensions,
    aggregation,
    granularity,
    orderBy: declaredOrderBy,
    limit: declaredLimit
  } = query;
  const conditions: FilterCondition[] = [];
  let timeRange: TimeRangeValue | undefined;
  for (const filterId of query.filters?.subscribe ?? []) {
    const value = values.get(filterId);
    if (!value) continue;
    if (value.type === 'dimension') {
      conditions.push({ dimension: value.dimension, operator: 'in', value: value.values });
    } else {
      timeRange = { from: value.from, to: value.to };
    }
  }
  if (query.time) {
    const value = values.get(query.time.filter);
    timeRange =
      value?.type === 'timeRange' ? resolveQueryTime(value, query.time.window) : undefined;
  }
  conditions.push(...(view.conditions ?? []));
  const limit = view.limit !== undefined ? view.limit : declaredLimit;
  const orderBy = view.orderBy !== undefined ? view.orderBy : declaredOrderBy;
  return {
    metrics,
    ...(dimensions ? { dimensions } : {}),
    ...(aggregation !== undefined ? { aggregation } : {}),
    ...(granularity !== undefined ? { granularity } : {}),
    conditions,
    ...(timeRange ? { timeRange } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(view.offset !== undefined ? { offset: view.offset } : {}),
    ...(orderBy?.length ? { orderBy } : {})
  };
}

function resolveQueryTime(range: TimeRangeValue, window: TimeWindow): TimeRangeValue {
  if (window.kind === 'selected') return { from: range.from, to: range.to };
  if (window.kind === 'point') return { from: range.to, to: range.to };
  return {
    from: subtractCalendarUnits(range.to, window.previous, window.unit) ?? range.from,
    to: range.to
  };
}

function subtractCalendarUnits(
  value: string,
  previous: number,
  unit: 'day' | 'week' | 'month'
): string | undefined {
  const parsed = parseCalendarValue(value);
  if (!parsed) return undefined;

  if (unit === 'month') {
    const target = parsed.year * 12 + parsed.month - 1 - previous;
    const year = Math.floor(target / 12);
    const month = target - year * 12 + 1;
    const day = Math.min(parsed.day, daysInMonth(year, month));
    return `${formatDate(year, month, day)}${parsed.time}`;
  }

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(parsed.year, parsed.month - 1, parsed.day);
  date.setUTCDate(date.getUTCDate() - previous * (unit === 'week' ? 7 : 1));
  if (Number.isNaN(date.getTime())) return undefined;
  return `${formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())}${parsed.time}`;
}

function parseCalendarValue(
  value: string
): { year: number; month: number; day: number; time: string } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[5] === undefined ? undefined : Number(match[5]);
  const minute = match[6] === undefined ? undefined : Number(match[6]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    (hour !== undefined && (hour > 23 || minute === undefined || minute > 59))
  ) {
    return undefined;
  }
  return { year, month, day, time: match[4] ?? '' };
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function execute(
  query: EffectiveQuery,
  gateway: DataGateway,
  blindPagination: boolean
): Promise<DataSnapshot> {
  try {
    if (!blindPagination || query.limit === undefined) {
      const rows = await gateway.fetchData(query);
      return rowsSnapshot(rows);
    }
    const rows = await gateway.fetchData({ ...query, limit: query.limit + 1 });
    const hasMore = rows.length > query.limit;
    const visible = hasMore ? rows.slice(0, query.limit) : rows;
    return visible.length === 0
      ? { status: 'empty' }
      : { status: 'ready', rows: visible, hasMore };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { status: 'error', error: { message } };
  }
}

function changedFilterIds(before: FilterValues, after: FilterValues): Set<string> {
  const changed = new Set<string>();
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    if (JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id))) changed.add(id);
  }
  return changed;
}
