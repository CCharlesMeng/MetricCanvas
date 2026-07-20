import type { DataSnapshot, EffectiveQuery, FilterCondition, Widget } from '@metriccanvas/page';
import type { FilterState, FilterValues } from './filter-state';
import type { DataGateway } from './ports';

/** 页面全部 widget 的数据快照,键集恒等于 widget id 集合 */
export type PageSnapshots = ReadonlyMap<string, DataSnapshot>;

/**
 * 兼容 svelte store 契约的结构化类型(零 svelte import):
 * subscribe 立即同步推送当前值,返回退订函数。
 */
export interface Subscribable<T> {
  subscribe(run: (value: T) => void): () => void;
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
 */
export function orchestrate(
  widgets: Widget[],
  gateway: DataGateway,
  filters?: FilterState
): Subscribable<PageSnapshots> {
  const subscribers = new Set<(value: PageSnapshots) => void>();
  let session: Session | null = null;

  return {
    subscribe(run) {
      subscribers.add(run);
      // 冷流:首个订阅者到达才启动执行;中途加入的订阅者共享同一次执行
      session ??= startSession(widgets, gateway, filters, (snapshots) => {
        for (const notify of subscribers) notify(snapshots);
      });
      run(session.current());
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

function startSession(
  widgets: Widget[],
  gateway: DataGateway,
  filters: FilterState | undefined,
  push: (snapshots: PageSnapshots) => void
): Session {
  let snapshots = new Map<string, DataSnapshot>(
    widgets.map((widget) => [widget.id, { status: 'loading' }])
  );
  // 每 widget 的查询序号:结果返回时序号已前进即视为过期,一律丢弃
  const sequences = new Map<string, number>();
  let disposed = false;
  let values: FilterValues = new Map();

  function publish(mutate: (next: Map<string, DataSnapshot>) => void) {
    const next = new Map(snapshots);
    mutate(next);
    snapshots = next;
    push(snapshots);
  }

  function refetch(targets: Widget[], options: { publishLoading: boolean }) {
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
      const query = composeEffectiveQuery(widget, values);
      const key = JSON.stringify(query);
      const group = groups.get(key) ?? { query, members: [] };
      group.members.push([widget.id, sequences.get(widget.id)!]);
      groups.set(key, group);
    }

    for (const { query, members } of groups.values()) {
      void execute(query, gateway).then((snapshot) => {
        if (disposed) return;
        const landed = members.filter(([id, seq]) => sequences.get(id) === seq);
        if (landed.length === 0) return;
        publish((next) => {
          for (const [id] of landed) next.set(id, snapshot);
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
    dispose() {
      disposed = true;
      unsubscribeFilters?.();
    }
  };
}

/**
 * 生效查询合成(包内纯函数,暂不导出):
 * 订阅的维度筛选器值进 conditions(按订阅声明顺序),时间范围筛选器值进 timeRange。
 */
function composeEffectiveQuery(widget: Widget, values: FilterValues): EffectiveQuery {
  const { metrics, dimensions, granularity } = widget.query;
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
  return {
    metrics,
    ...(dimensions ? { dimensions } : {}),
    ...(granularity ? { granularity } : {}),
    conditions,
    ...(timeRange ? { timeRange } : {})
  };
}

async function execute(query: EffectiveQuery, gateway: DataGateway): Promise<DataSnapshot> {
  try {
    const rows = await gateway.fetchData(query);
    return rows.length === 0 ? { status: 'empty' } : { status: 'ready', rows };
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
