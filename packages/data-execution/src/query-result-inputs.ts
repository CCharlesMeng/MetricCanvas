import { checkOrdinaryRange } from './source-program/range-policy';
import { filterQueryResultRows, MAX_QUERY_RESULT_VALUES, declaredPaginationLimit, type DataSource, type DataSnapshot, type EffectiveQuery } from '@metriccanvas/page/internal';

type Resolution =
  | { status: 'ready'; values: EffectiveQuery['filterValues'] }
  | { status: 'waiting' }
  | { status: 'terminal'; snapshot: DataSnapshot };

/** One-shot execution, rendering and export resolve predicates from raw normalized snapshots. */
export function resolveQueryResultInputs(source: DataSource, raw: ReadonlyMap<string, DataSnapshot>, sources: ReadonlyMap<string, DataSource>, windowLimits: ReadonlyMap<string, number> = new Map()): Resolution {
  if (source.source.type !== 'query') return { status: 'ready', values: [] };
  const values: EffectiveQuery['filterValues'] = [];
  let waiting = false;
  let empty = false;
  let error: DataSnapshot | undefined;
  const fail = (message: string): DataSnapshot => ({ status: 'error', error: { code: 'UNKNOWN', message } });
  for (const binding of source.source.query.resultBindings ?? []) {
    const snapshot = raw.get(binding.source);
    if (!snapshot || snapshot.status === 'loading') { waiting = true; continue; }
    if (snapshot.status === 'error') { error = { status: 'error', error: { code: snapshot.error.code, message: '查询输入数据源失败' } }; continue; }
    const rows = snapshot.status === 'ready' ? snapshot.rows : [];
    const upstream = sources.get(binding.source);
    const query = upstream?.source.type === 'query' ? upstream.source : undefined;
    const limit = windowLimits.get(binding.source) ?? (query ? declaredPaginationLimit(query.query) : undefined);
    if (upstream && checkOrdinaryRange(upstream,snapshot,limit).status==='error') { error=fail('查询输入结果不符合声明范围');continue; }
    let selected = rows;
    if (binding.where) {
      try { selected = filterQueryResultRows(rows, binding.where, upstream?.fields ?? {}); }
      catch (cause) { error = fail(cause instanceof Error ? cause.message : '查询输入过滤失败'); continue; }
    }
    if (!selected.length) { empty = true; continue; }
    const unique = new Map<string, string | number>();
    const fieldType = upstream?.fields[binding.field]?.type;
    for (const row of selected) {
      const value = row[binding.field];
      if ((typeof value !== 'string' && typeof value !== 'number') ||
          (fieldType !== undefined && typeof value !== fieldType) ||
          (typeof value === 'string' && !value.trim()) ||
          (typeof value === 'number' && !Number.isFinite(value))) {
        error = fail('查询输入维度缺失或类型不合法'); break;
      }
      unique.set(JSON.stringify([typeof value, value]), value);
    }
    if (unique.size > binding.maxValues || binding.maxValues > MAX_QUERY_RESULT_VALUES || binding.maxValues < 1) {
      error = fail('查询输入集合超过声明上限'); continue;
    }
    values.push({ target: 'dimension', queryField: binding.queryField,
      values: [...unique.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value) });
  }
  if (error) return { status: 'terminal', snapshot: error };
  if (empty) return { status: 'terminal', snapshot: { status: 'empty', totalCount: 0 } };
  return waiting ? { status: 'waiting' } : { status: 'ready', values };
}
