import type { ComputationContext } from './time-fill';
import { computeDependencies, type DataSource, type DataSnapshot, type DataRow } from '@metriccanvas/page/internal';
import { applyComputation } from './index';
import { ComputationError } from './join-aggregate';

/** 每次发布从同一份原始快照图推导；缓存不保存计算产物。 */
export function computedSnapshots(
  sources: ReadonlyMap<string, DataSource>,
  raw: ReadonlyMap<string, DataSnapshot>,
  context?: ComputationContext
): Map<string, DataSnapshot> {
  const result = new Map<string, DataSnapshot>();
  const visiting = new Set<string>();
  const fail = (message: string): DataSnapshot => ({ status: 'error', error: { code: 'UNKNOWN', message } });
  function visit(id: string): DataSnapshot {
    const known = result.get(id);
    if (known) return known;
    if (visiting.has(id)) return fail('页面数据源计算依赖成环');
    const source = sources.get(id);
    const snapshot = raw.get(id);
    if (!source || !snapshot) return fail('页面数据源计算依赖不存在');
    visiting.add(id);
    let computed: DataSnapshot = snapshot;
    const dependencies = new Map<string, readonly DataRow[]>();
    let dependencyState: DataSnapshot | undefined;
    for (const dependency of computeDependencies(source.compute ?? [])) {
      const value = visit(dependency);
      if (value.status === 'error') dependencyState = value;
      else if (value.status === 'loading' && dependencyState?.status !== 'error') dependencyState = value;
      else if (value.status === 'ready') dependencies.set(dependency, value.rows);
      else if (value.status === 'empty') dependencies.set(dependency, []);
    }
    if (snapshot.status !== 'error') {
      if (dependencyState?.status === 'error') computed = { status: 'error', error: { code: dependencyState.error.code, message: '依赖数据源执行或计算失败' } };
      else if (snapshot.status === 'loading' || dependencyState?.status === 'loading') computed = { status: 'loading' };
      else if (snapshot.status === 'ready' || snapshot.status === 'empty') {
        const rows = snapshot.status === 'ready' ? snapshot.rows : [];
        if (source.source.type === 'query' && source.source.resultScope === 'complete' &&
          snapshot.totalCount !== undefined && snapshot.totalCount !== rows.length) {
          computed = fail('声明完整的查询结果与返回总数不一致');
        } else try {
          const output = applyComputation(source.compute ?? [], rows, dependencies, context);
          const changesCount = (source.compute ?? []).some(op => op.op === 'timeFill');
          const total = changesCount ? { totalCount: output.length } : snapshot.totalCount === undefined ? {} : { totalCount: snapshot.totalCount };
          computed = output.length ? { status: 'ready', rows: output, ...total } : { status: 'empty', ...total };
        } catch (cause) {
          computed = fail(cause instanceof ComputationError ? cause.message : '页面数据源计算失败');
        }
      }
    }
    visiting.delete(id);
    result.set(id, computed);
    return computed;
  }
  for (const id of sources.keys()) visit(id);
  return result;
}
