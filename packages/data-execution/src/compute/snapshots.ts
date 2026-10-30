import { declaredPaginationLimit, restoreCellFallbacks, snapshotCellFallbacks } from '@metriccanvas/page/internal';
import { checkOrdinaryRange } from '../source-program/range-policy';
import type { ComputationContext } from './time-fill';
import { computeDependencies, type DataSource, type DataSnapshot, type DataRow } from '@metriccanvas/page/internal';
import { applyComputation } from './index';
import { ComputationError } from './join-aggregate';

/** 每次发布从同一份原始快照图推导；缓存不保存计算产物。 */
export function computedSnapshots(
  sources: ReadonlyMap<string, DataSource>,
  raw: ReadonlyMap<string, DataSnapshot>,
  context?: ComputationContext,
  /** Display-only compatibility; complete reads leave this disabled. */
  options: { allowZeroTotal?: boolean } = {}
): Map<string, DataSnapshot> {
  const result = new Map<string, DataSnapshot>();
  const visiting = new Set<string>();
  function visit(id: string): DataSnapshot {
    const known = result.get(id);
    if (known) return known;
    if (visiting.has(id)) return fail('页面数据源计算依赖成环');
    const source = sources.get(id);
    const snapshot = restoreSnapshot(raw.get(id));
    if (!source || !snapshot) return fail('页面数据源计算依赖不存在');
    visiting.add(id);
    const dependencies = collectDependencies(source, sources, visit, options.allowZeroTotal === true);
    const computed = computeSnapshot(source, snapshot, dependencies, context, options.allowZeroTotal === true);
    visiting.delete(id);
    result.set(id, computed);
    return computed;
  }
  for (const id of sources.keys()) visit(id);
  return result;
}


interface Dependencies { rows: Map<string, readonly DataRow[]>; state?: DataSnapshot }
function fail(message: string): DataSnapshot { return {status:'error',error:{code:'UNKNOWN',message}}; }

function collectDependencies(source: DataSource, sources: ReadonlyMap<string, DataSource>, visit: (id:string)=>DataSnapshot, allowZeroTotal: boolean): Dependencies {
  const result: Dependencies = {rows:new Map()};
  const unionSources = new Set((source.compute ?? []).flatMap(op => op.op === 'unionKeys' ? op.sources : []));
  for (const dependency of computeDependencies(source.compute ?? [])) {
    const snapshot = completeDependency(sources.get(dependency), visit(dependency), unionSources.has(dependency), allowZeroTotal);
    if (snapshot.status === 'error') result.state = snapshot;
    else if (snapshot.status === 'loading' && result.state?.status !== 'error') result.state = snapshot;
    else if (snapshot.status === 'ready') result.rows.set(dependency, snapshot.rows);
    else if (snapshot.status === 'empty') result.rows.set(dependency, []);
  }
  return result;
}

function computeSnapshot(source: DataSource, snapshot: DataSnapshot, dependencies: Dependencies, context: ComputationContext | undefined, allowZeroTotal: boolean): DataSnapshot {
  if (snapshot.status === 'error') return snapshot;
  if (dependencies.state?.status === 'error') return {status:'error',error:{code:dependencies.state.error.code,message:'依赖数据源执行或计算失败'}};
  if (snapshot.status === 'loading' || dependencies.state?.status === 'loading') return {status:'loading'};
  const checked = checkOrdinaryRange(source,snapshot,undefined,undefined,{allowZeroTotal:canRenderZeroTotal(source) || (allowZeroTotal && hasZeroTotalRows(source, snapshot))});
  if (checked.status === 'error') return checked;
  return evaluateRows(source, snapshot, dependencies.rows, context);
}

function evaluateRows(source: DataSource, snapshot: Extract<DataSnapshot,{status:'ready'|'empty'}>, dependencies: ReadonlyMap<string,readonly DataRow[]>, context?: ComputationContext): DataSnapshot {
  try {
    const rows = snapshot.status === 'ready' ? snapshot.rows : [];
    const output = applyComputation(source.compute ?? [], rows, dependencies, context);
    const changesCount = (source.compute ?? []).some(op => op.op === 'timeFill' || op.op === 'unionKeys');
    const total = changesCount ? {totalCount:output.length} : snapshot.totalCount === undefined ? {} : {totalCount:snapshot.totalCount};
    return output.length ? {status:'ready',rows:output,...snapshotCellFallbacks(output),...total,warnings:snapshot.warnings} : {status:'empty',...total,warnings:snapshot.warnings};
  } catch (cause) { return fail(cause instanceof ComputationError ? cause.message : '页面数据源计算失败'); }
}

function restoreSnapshot(snapshot: DataSnapshot | undefined): DataSnapshot | undefined {
  if (snapshot?.status === 'ready') restoreCellFallbacks(snapshot.rows, snapshot.cellFallbacks);
  return snapshot;
}

/** Screen computation may consume zero-total rows without rewriting the upstream receipt. */
function completeDependency(source: DataSource | undefined, snapshot: DataSnapshot, requireCompleteCount: boolean, allowZeroTotal: boolean): DataSnapshot {
  const provisional = allowZeroTotal && hasZeroTotalRows(source, snapshot);
  if (!provisional && requireCompleteCount && (snapshot.status === 'ready' || snapshot.status === 'empty') &&
    snapshot.totalCount !== undefined && snapshot.totalCount !== (snapshot.status === 'ready' ? snapshot.rows.length : 0)) {
    return {status:'error',error:{code:'DQE_ROW_CONTRACT_ERROR',message:'并集依赖结果与 totalCount 不一致，不能证明完整行集'}};
  }
  return source ? checkOrdinaryRange(source, snapshot, undefined, undefined, {allowZeroTotal: provisional}) : snapshot;
}

function hasZeroTotalRows(source: DataSource | undefined, snapshot: DataSnapshot): boolean {
  return source?.source.type === 'query' && source.source.resultScope === 'complete' &&
    declaredPaginationLimit(source.source.query) === undefined &&
    snapshot.status === 'ready' && snapshot.rows.length > 0 && snapshot.totalCount === 0;
}

function canRenderZeroTotal(source: DataSource): boolean {
  return computeDependencies(source.compute ?? []).length === 0;
}
