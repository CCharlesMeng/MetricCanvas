import type { QueryError } from '@metriccanvas/page';
import type { Subscribable } from './orchestrator';
import type { DimensionValuesGateway, RuntimeDataGateway } from './ports';
import { preservedQueryError } from './query-error';

/**
 * 筛选候选值快照:统一运行时按维度名维护的候选值加载状态,形状只在
 * 这里声明一份(issue #54)。
 *
 * | 状态 | 含义 |
 * |---|---|
 * | idle | 尚未请求 |
 * | loading | 候选值查询执行中 |
 * | ready | 真实去重候选值可用 |
 * | empty | 查询成功且候选为空 |
 * | unavailable | 该维度的候选值能力不可用(不伪装成 empty) |
 * | error | 查询失败,携带 issue #51 的结构化查询错误 |
 */
export type DimensionValuesSnapshot =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; values: string[] }
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'error'; error: QueryError };

/** 筛选候选值快照的唯一真元:维度名 → 快照。 */
export type DimensionValuesSnapshots = ReadonlyMap<string, DimensionValuesSnapshot>;

export interface DimensionValuesStream extends Subscribable<DimensionValuesSnapshots> {
  /**
   * 请求一个维度的候选值。同一会话内按维度幂等:已在加载或已有终态的
   * 维度不重复请求。约束变化时用 `reload` 重新取。
   */
  load(dimension: string, constraints?: Readonly<Record<string, readonly string[]>>): void;
  /** 丢弃该维度当前快照并按新约束重新请求。 */
  reload(dimension: string, constraints?: Readonly<Record<string, readonly string[]>>): void;
  /** 结束会话:取消全部在途候选值请求,过期结果不再发布。 */
  dispose(): void;
}

const IDLE: DimensionValuesSnapshot = { status: 'idle' };

/**
 * 筛选候选值加载器:候选值从端口到显式状态的唯一编排点。
 *
 * - 数据网关未声明候选值能力(未实现 DimensionValuesGateway)时,
 *   维度直接进入 unavailable,不发起请求也不伪装成空结果;
 * - 在途请求经 AbortSignal 可取消,dispose 后过期结果不会覆盖筛选状态;
 * - 失败保留结构化查询错误分类(issue #51),未携带分类兜底 UNKNOWN。
 */
export function createDimensionValuesLoader(
  gateway: RuntimeDataGateway
): DimensionValuesStream {
  const snapshots = new Map<string, DimensionValuesSnapshot>();
  const subscribers = new Set<(value: DimensionValuesSnapshots) => void>();
  const controllers = new Map<string, AbortController>();
  let disposed = false;

  function publish(dimension: string, snapshot: DimensionValuesSnapshot): void {
    snapshots.set(dimension, snapshot);
    const current: DimensionValuesSnapshots = new Map(snapshots);
    for (const subscriber of subscribers) notify(subscriber, current);
  }

  function settle(dimension: string, snapshot: DimensionValuesSnapshot): void {
    // dispose 后或该维度已不在加载中(理论上不会发生)时丢弃过期结果。
    if (disposed || snapshots.get(dimension)?.status !== 'loading') return;
    controllers.delete(dimension);
    publish(dimension, snapshot);
  }

  function start(
    dimension: string,
    constraints: Readonly<Record<string, readonly string[]>> | undefined,
    force: boolean
  ): void {
    if (disposed) return;
    if (!force && snapshots.get(dimension) !== undefined) return;
    controllers.get(dimension)?.abort();
    const fetchDimensionValues = capability(gateway);
    if (!fetchDimensionValues) {
      publish(dimension, { status: 'unavailable' });
      return;
    }
    const controller = new AbortController();
    controllers.set(dimension, controller);
    publish(dimension, { status: 'loading' });
    fetchDimensionValues(dimension, { signal: controller.signal, constraints }).then(
      (result) => {
        settle(
          dimension,
          result.kind === 'unavailable'
            ? { status: 'unavailable' }
            : result.values.length === 0
              ? { status: 'empty' }
              : { status: 'ready', values: result.values }
        );
      },
      (cause: unknown) => {
        settle(dimension, { status: 'error', error: preservedQueryError(cause) });
      }
    );
  }

  return {
    subscribe(run) {
      subscribers.add(run);
      notify(run, new Map(snapshots));
      return () => subscribers.delete(run);
    },
    load(dimension, constraints) {
      start(dimension, constraints, false);
    },
    reload(dimension, constraints) {
      start(dimension, constraints, true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    }
  };
}

/** 便于消费方取快照缺省值:未请求过的维度视为 idle。 */
export function dimensionValuesSnapshot(
  snapshots: DimensionValuesSnapshots,
  dimension: string
): DimensionValuesSnapshot {
  return snapshots.get(dimension) ?? IDLE;
}

function capability(
  gateway: RuntimeDataGateway
): DimensionValuesGateway['fetchDimensionValues'] | undefined {
  return typeof gateway.fetchDimensionValues === 'function'
    ? gateway.fetchDimensionValues.bind(gateway)
    : undefined;
}

function notify(
  run: (value: DimensionValuesSnapshots) => void,
  snapshots: DimensionValuesSnapshots
): void {
  try {
    run(snapshots);
  } catch (cause) {
    console.error('筛选候选值订阅方回调抛出异常(已隔离):', cause);
  }
}
