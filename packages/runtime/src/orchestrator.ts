import type {
  DataSnapshot,
  DataWidget,
  EffectiveQuery,
  FilterCondition,
  OrderByRule
} from '@metriccanvas/page';
import type { FilterState, FilterValues } from './filter-state';
import type { DataGateway } from './ports';

/** 页面全部数据 widget 的数据快照,键集恒等于传入的 widget id 集合(文本组件无查询,由壳过滤后不入编排) */
export type PageSnapshots = ReadonlyMap<string, DataSnapshot>;

/**
 * 兼容 svelte store 契约的结构化类型(零 svelte import):
 * subscribe 立即同步推送当前值,返回退订函数。
 */
export interface Subscribable<T> {
  subscribe(run: (value: T) => void): () => void;
}

/**
 * widget 视图状态(issue #7 视图通道):分页/排序/表头筛选是 widget 局部状态,
 * 不进页面筛选状态;由壳持有并经 setView 整体写入(null 清除,回落声明的默认视图)。
 */
export interface WidgetView {
  /** 每页行数(生效查询的 limit;盲翻探测的 +1 由编排器执行,视图不感知) */
  limit?: number;
  /** 跳过的行数 = 页码 × 每页行数 */
  offset?: number;
  /** 多列排序,数组序即优先级 */
  orderBy?: OrderByRule[];
  /** 表头筛选条件:并进生效查询 conditions(排在页面筛选条件之后) */
  conditions?: FilterCondition[];
}

/** orchestrate 的返回:页面快照流 + per-widget 视图写入口(#7 对 #5 接口的增量扩展) */
export interface PageSnapshotStream extends Subscribable<PageSnapshots> {
  /**
   * 写入 widget 视图:只重查该 widget,沿用 loading→终态时间线、竞态丢弃与
   * 会话缓存语义(缓存 key 含视图)。未知 widget id 静默忽略,永不 throw。
   * 冷流期(无订阅者)只记录视图,首个订阅者到达后的首查即按视图合成。
   */
  setView(widgetId: string, view: WidgetView | null): void;
}

/** 表格缺省每页行数(schema 对 pageSize 的文档口径,唯一实现处;壳计算 offset 时复用) */
export const DEFAULT_TABLE_PAGE_SIZE = 20;

/** 声明的默认视图:表格 widget 首查即分页(首页 pageSize 行),其余 widget 无视图 */
function defaultView(widget: DataWidget): WidgetView {
  if (widget.type === 'table') {
    return { limit: widget.pageSize ?? DEFAULT_TABLE_PAGE_SIZE, offset: 0 };
  }
  return {};
}

/**
 * 查询编排器:页面唯一的有状态调度台。
 * 生效查询合成(结构化查询 × 订阅筛选器当前值)→ 同轮去重 → 经数据网关取数 →
 * 包装数据快照分发;筛选变更只重查订阅了该筛选器的 widget(差量重查)。
 *
 * 返回冷流,不变式(issue #5 定稿):
 * 1. orchestrate 本身零副作用,首个订阅者到达才取数;
 * 2. subscribe 立即同步收到含全部 widget id 的 Map(初值 loading);
 * 3. 每 widget 时间线 loading → ready|empty|error;未受筛选变更影响的快照引用不变;
 * 4. 只有该 widget 最新生效查询的结果能落成快照,过期在途结果一律丢弃;
 * 5. 最后一个订阅者退订后在途查询全部作废、永不再回调(取消=退订);
 * 6. 网关异常只化为 error 快照,subscribe 永不 throw;每次变更推送新 Map 实例。
 *
 * 视图通道(#7 增量扩展,不变式不回退):返回对象增设 setView,
 * 分页/排序/表头筛选经视图状态进入生效查询合成,视图变更只重查该 widget。
 */
export function orchestrate(
  widgets: DataWidget[],
  gateway: DataGateway,
  filters?: FilterState
): PageSnapshotStream {
  const subscribers = new Set<(value: PageSnapshots) => void>();
  let session: Session | null = null;
  // 视图状态归属流本身而非会话:冷流期即可写入,退订重订后视图不丢
  const views = new Map<string, WidgetView>();

  return {
    subscribe(run) {
      subscribers.add(run);
      // 冷流:首个订阅者到达才启动执行;中途加入的订阅者共享同一次执行
      session ??= startSession(widgets, gateway, filters, views, (snapshots) => {
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

    setView(widgetId, view) {
      if (!widgets.some((widget) => widget.id === widgetId)) return;
      if (view === null) views.delete(widgetId);
      else views.set(widgetId, view);
      // 冷流期只记录;会话在跑才触发该 widget 重查(时间线/竞态/缓存语义同筛选变更)
      session?.refetchWidget(widgetId);
    }
  };
}

interface Session {
  current(): PageSnapshots;
  refetchWidget(widgetId: string): void;
  dispose(): void;
}

/** 兑现"subscribe 永不 throw":单个订阅方的异常不得中断分发与其余订阅方 */
function notify(run: (value: PageSnapshots) => void, snapshots: PageSnapshots): void {
  try {
    run(snapshots);
  } catch (cause) {
    console.error('数据快照订阅方回调抛出异常(已隔离):', cause);
  }
}

function startSession(
  widgets: DataWidget[],
  gateway: DataGateway,
  filters: FilterState | undefined,
  views: ReadonlyMap<string, WidgetView>,
  push: (snapshots: PageSnapshots) => void
): Session {
  let snapshots = new Map<string, DataSnapshot>(
    widgets.map((widget) => [widget.id, { status: 'loading' }])
  );
  // 每 widget 的查询序号:结果返回时序号已前进即视为过期,一律丢弃
  const sequences = new Map<string, number>();
  let disposed = false;
  let values: FilterValues = new Map();

  // 会话内缓存:同一生效查询的成功结果(就绪/空)复用,筛选来回切换不重复取数;
  // 错误不入缓存——失败该重试。会话即页面生命周期,退订即弃,无失效策略负担
  const cache = new Map<string, DataSnapshot>();

  // 并发分批:同时在途请求不超过数据服务批量上限 5(PRD「数据服务对接事实」),
  // 超过的排队,先到先补。名额未满时任务同步启动(订阅即发查的既有时序不变)
  const MAX_IN_FLIGHT = 5;
  let inFlight = 0;
  const waiters: Array<() => void> = [];
  function withSlot(task: () => void): void {
    if (disposed) return; // 退订即取消:不再启动任何新请求(不变式5)
    if (inFlight < MAX_IN_FLIGHT) {
      inFlight++;
      task();
    } else {
      waiters.push(task);
    }
  }
  function release(): void {
    if (disposed) return; // 会话已作废:排队任务不再链式启动
    const next = waiters.shift();
    if (next) next();
    else inFlight--;
  }

  function publish(mutate: (next: Map<string, DataSnapshot>) => void) {
    const next = new Map(snapshots);
    mutate(next);
    snapshots = next;
    push(snapshots);
  }

  function refetch(targets: DataWidget[], options: { publishLoading: boolean }) {
    // 初始轮快照本就全为 loading(不变式2 已由首发同步覆盖),不必再推一轮
    if (options.publishLoading) {
      publish((next) => {
        for (const widget of targets) next.set(widget.id, { status: 'loading' });
      });
    }
    for (const widget of targets) {
      sequences.set(widget.id, (sequences.get(widget.id) ?? 0) + 1);
    }

    // 同轮去重:相同生效查询只发一次网关请求(US24)
    const groups = new Map<string, { query: EffectiveQuery; members: Array<[string, number]> }>();
    for (const widget of targets) {
      const query = composeEffectiveQuery(widget, values, views.get(widget.id) ?? defaultView(widget));
      const key = JSON.stringify(query);
      const group = groups.get(key) ?? { query, members: [] };
      group.members.push([widget.id, sequences.get(widget.id)!]);
      groups.set(key, group);
    }

    for (const [key, { query, members }] of groups) {
      const land = (snapshot: DataSnapshot) => {
        if (disposed) return;
        const landed = members.filter(([id, seq]) => sequences.get(id) === seq);
        if (landed.length === 0) return;
        publish((next) => {
          for (const [id] of landed) next.set(id, snapshot);
        });
      };

      // 缓存命中同步落定:时间线仍是 loading→ready(publishLoading 在前),
      // 视觉上会闪一帧骨架——这是不变式3 的保序代价,刻意保留
      const cached = cache.get(key);
      if (cached) {
        land(cached);
        continue;
      }
      withSlot(() => {
        void execute(query, gateway).then((snapshot) => {
          release();
          if (snapshot.status === 'ready' || snapshot.status === 'empty') {
            cache.set(key, snapshot);
          }
          land(snapshot);
        });
      });
    }
  }

  // 订阅筛选状态:首次同步推送作为初值捕获,不算变更
  let primed = false;
  const unsubscribeFilters = filters?.subscribe((next) => {
    if (!primed) {
      primed = true;
      values = next;
      return;
    }
    const changed = changedFilterIds(values, next);
    values = next;
    const affected = widgets.filter((widget) =>
      (widget.query.filters?.subscribe ?? []).some((id) => changed.has(id))
    );
    if (affected.length > 0) refetch(affected, { publishLoading: true });
  });

  refetch(widgets, { publishLoading: false });

  return {
    current: () => snapshots,
    refetchWidget(widgetId) {
      const widget = widgets.find((candidate) => candidate.id === widgetId);
      if (widget) refetch([widget], { publishLoading: true });
    },
    dispose() {
      disposed = true;
      waiters.length = 0; // 排队中的查询一并作废,不得在退订后发出
      unsubscribeFilters?.();
    }
  };
}

/**
 * 生效查询合成(包内纯函数,暂不导出):
 * 订阅的维度筛选器值进 conditions(按订阅声明顺序),时间范围筛选器值进 timeRange;
 * widget 视图并入:表头筛选条件排在页面筛选之后,分页/排序原样承载。
 */
function composeEffectiveQuery(
  widget: DataWidget,
  values: FilterValues,
  view: WidgetView
): EffectiveQuery {
  const { metrics, dimensions, aggregation, granularity } = widget.query;
  const conditions: FilterCondition[] = [];
  let timeRange: { from: string; to: string } | undefined;
  for (const filterId of widget.query.filters?.subscribe ?? []) {
    const value = values.get(filterId);
    if (!value) continue;
    if (value.type === 'dimension') {
      conditions.push({ dimension: value.dimension, operator: 'in', value: value.values });
    } else {
      timeRange = { from: value.from, to: value.to };
    }
  }
  conditions.push(...(view.conditions ?? []));
  return {
    metrics,
    ...(dimensions ? { dimensions } : {}),
    ...(aggregation ? { aggregation } : {}),
    ...(granularity ? { granularity } : {}),
    conditions,
    ...(timeRange ? { timeRange } : {}),
    ...(view.limit !== undefined ? { limit: view.limit } : {}),
    ...(view.offset !== undefined ? { offset: view.offset } : {}),
    ...(view.orderBy?.length ? { orderBy: view.orderBy } : {})
  };
}

async function execute(query: EffectiveQuery, gateway: DataGateway): Promise<DataSnapshot> {
  try {
    if (query.limit === undefined) {
      const rows = await gateway.fetchData(query);
      return rows.length === 0 ? { status: 'empty' } : { status: 'ready', rows };
    }
    // 盲翻探测:数据服务响应不返回总条数(PRD「数据服务对接事实」),
    // 多取一行——归来行数超过 limit 即存在下一页,展示行裁回 limit。
    // 放编排器而非适配器:探测是编排语义,mock 与数据服务适配器只需忠实执行 limit,
    // 且裁剪后的快照(含 hasMore)直接进会话缓存,翻回旧页零额外请求。
    const rows = await gateway.fetchData({ ...query, limit: query.limit + 1 });
    const hasMore = rows.length > query.limit;
    const visible = hasMore ? rows.slice(0, query.limit) : rows;
    return visible.length === 0 ? { status: 'empty' } : { status: 'ready', rows: visible, hasMore };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { status: 'error', error: { message } };
  }
}

/** 变更的筛选器 id 集合:值改变、新增或被清除的都算 */
function changedFilterIds(before: FilterValues, after: FilterValues): Set<string> {
  const changed = new Set<string>();
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    if (JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id))) changed.add(id);
  }
  return changed;
}
