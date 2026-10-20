import { validFilterCandidates } from './filter-candidates';
import type { QueryError } from '@metriccanvas/page/internal';
import type { Subscribable } from './orchestrator';
import type {
  DimensionValueCandidate,
  FilterCandidate, FilterCandidatesRequest, FilterCandidatesResult,
  DimensionValuesGateway,
  RuntimeDataGateway
} from './ports';
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
  | { status: 'ready'; candidates: FilterCandidate[] }
  | { status: 'empty' }
  | { status: 'unavailable' | 'denied' | 'unconfigured' }
  | { status: 'error'; error: QueryError };

/** 筛选候选值快照的唯一真元:维度名 → 快照。 */
export type DimensionValuesSnapshots = ReadonlyMap<string, DimensionValuesSnapshot>;

export interface DimensionValuesStream extends Subscribable<DimensionValuesSnapshots> {
  /**
   * 请求一个维度的候选值。同一会话内按维度幂等:已在加载或已有终态的
   * 维度不重复请求。约束变化时用 `reload` 重新取。
   */
  load(dimension: string, constraints?: Readonly<Record<string, readonly string[]>>, scope?: { filterId: string; level?: string; context?: string } | string): void;
  /** 丢弃该维度当前快照并按新约束重新请求。 */
  reload(dimension: string, constraints?: Readonly<Record<string, readonly string[]>>, scope?: { filterId: string; level?: string; context?: string } | string): void;
  loadFilter(request:FilterCandidatesRequest,context:string,levels?:readonly string[],force?:boolean):void;
  /** 上游事实不可用时取消当前代次并清除其候选回执。 */
  unavailable(dimension: string, scope: { filterId: string; level?: string; context?: string }): void;
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
  const requests = new Map<string, { controller: AbortController; generation: number; key: string }>();
  const generations = new Map<string, number>();
  const activeKeys = new Map<string, string>();
  const cache = new Map<string, DimensionValuesSnapshot>();
  let disposed = false;

  function publish(slot: string, snapshot: DimensionValuesSnapshot, contextSlot?: string): void {
    snapshots.set(slot, snapshot);
    if (contextSlot) snapshots.set(contextSlot, snapshot);
    const current: DimensionValuesSnapshots = new Map(snapshots);
    for (const subscriber of subscribers) notify(subscriber, current);
  }
  function start(dimension: string, constraints: Readonly<Record<string, readonly string[]>> | undefined,
    force: boolean, inputScope?: {filterId:string;level?:string;context?:string}|string, filterRequest?:FilterCandidatesRequest, levels?:readonly string[]): void {
    if (disposed) return;
    const scope=typeof inputScope==='object'?inputScope:undefined;
    const slot = typeof inputScope==='string'?candidateKey(dimension,inputScope):scope ? candidateScopeKey(scope.filterId, dimension, scope.level) : dimension;
    const contextSlot = scope?.context !== undefined ? candidateScopeKey(scope.filterId,dimension,scope.level,scope.context) : undefined;
    const normalized = constraints && Object.fromEntries(Object.keys(constraints).sort().map(key => [key, [...new Set(constraints[key])].sort()]));
    const key = JSON.stringify([slot, dimension, normalized ?? {},scope?.context ?? null,filterRequest??null]);
    if (!force && activeKeys.get(slot) === key) return;
    activeKeys.set(slot,key);
    const previous = requests.get(slot);
    if (!force && previous?.key === key) return;
    previous?.controller.abort();
    const generation = (generations.get(slot) ?? 0) + 1;
    generations.set(slot, generation);
    requests.delete(slot);
    if (!force && cache.has(key)) { publish(slot, cache.get(key)!, contextSlot); return; }
    if(filterRequest && Object.values(filterRequest.constraints.dimensions).some(values=>values.length===0)){publish(slot,{status:'empty'},contextSlot);return;}
    const fetch = filterRequest ? gateway.fetchFilterCandidates : capability(gateway);
    if (!fetch) { publish(slot, {status:'unavailable'}, contextSlot); return; }
    const controller = new AbortController();
    const request = {controller,generation,key}; requests.set(slot,request);
    publish(slot,{status:'loading'}, contextSlot);
    function settle(snapshot: DimensionValuesSnapshot) {
      if (disposed || generations.get(slot) !== generation || requests.get(slot) !== request) return;
      requests.delete(slot); cache.set(key,snapshot); publish(slot,snapshot,contextSlot);
    }
    let pending: Promise<FilterCandidatesResult | Awaited<ReturnType<DimensionValuesGateway['fetchDimensionValues']>>>;
    try { pending = filterRequest ? gateway.fetchFilterCandidates!(filterRequest,{signal:controller.signal}) : capability(gateway)!(dimension,{signal:controller.signal,constraints:normalized}); }
    catch (cause) { settle({status:'error',error:preservedQueryError(cause)}); return; }
    pending.then(result => {
      if(!result||!['values','unavailable','denied','unconfigured'].includes(result.kind)){settle({status:'error',error:{code:'DQE_ROW_CONTRACT_ERROR',message:'候选回执形状无效'}});return;}
      if(result.kind!=='values'){settle({status:result.kind});return;}
      if(filterRequest && (!Array.isArray(result.candidates)||!validFilterCandidates(result.candidates,levels))){settle({status:'error',error:{code:'DQE_QUERY_REJECTED',message:'候选结构不符合声明'}});return;}
      const candidates = filterRequest ? result.candidates : [...new Map(result.candidates.map(candidate => [candidate.value,candidate])).values()];
      settle(candidates.length ? {status:'ready',candidates} : {status:'empty'});
    }, cause => settle({status:'error',error:preservedQueryError(cause)}));
  }

  return {
    subscribe(run) {
      subscribers.add(run);
      notify(run, new Map(snapshots));
      return () => subscribers.delete(run);
    },
    load(dimension, constraints, scope) {
      start(dimension, constraints, false, scope);
    },
    reload(dimension, constraints, scope) {
      start(dimension, constraints, true, scope);
    },
    loadFilter(request,context,levels,force=false) {
      const normalized={...request,constraints:{dimensions:Object.fromEntries(Object.keys(request.constraints.dimensions).sort().map(id=>[id,[...new Set(request.constraints.dimensions[id])].sort()])),times:Object.fromEntries(Object.keys(request.constraints.times).sort().map(id=>[id,request.constraints.times[id]]))}};
      start(request.dimension,normalized.constraints.dimensions,force,{filterId:request.filterId,level:request.level,context},normalized,levels);
    },
    unavailable(dimension, scope) {
      if (disposed) return;
      const slot = candidateScopeKey(scope.filterId, dimension, scope.level);
      requests.get(slot)?.controller.abort();
      requests.delete(slot); activeKeys.delete(slot);
      generations.set(slot, (generations.get(slot) ?? 0) + 1);
      for (const key of cache.keys()) if (JSON.parse(key)[0] === slot) cache.delete(key);
      for (const key of snapshots.keys()) if (key.startsWith(slot.slice(0, -1) + ",")) snapshots.delete(key);
      publish(slot, { status: 'unavailable' }, scope.context === undefined ? undefined : candidateScopeKey(scope.filterId, dimension, scope.level, scope.context));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const request of requests.values()) request.controller.abort();
      requests.clear(); cache.clear(); generations.clear();
    }
  };
}

/** 便于消费方取快照缺省值:未请求过的维度视为 idle。 */
export function dimensionValuesSnapshot(
  snapshots: DimensionValuesSnapshots,
  dimension: string, consumerId?:string
): DimensionValuesSnapshot {
  return snapshots.get(candidateKey(dimension,consumerId)) ?? IDLE;
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

/** Page filters and table-column candidates have distinct slots, even for the same dimension. */
export function candidateScopeKey(filterId: string, dimension: string, level?: string, context?: string): string {
  return JSON.stringify(['filter', filterId, dimension, level ?? null, ...(context === undefined ? [] : [context])]);
}

export function candidateKey(dimension:string,consumerId?:string):string {return consumerId ? `${consumerId}:${dimension}` : dimension;}
