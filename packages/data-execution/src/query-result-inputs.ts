import { checkOrdinaryRange } from './source-program/range-policy';
import { filterQueryResultRows, MAX_QUERY_RESULT_VALUES, declaredPaginationLimit, type DataSource, type DataSnapshot, type EffectiveQuery, type QueryResultBinding, type Row, type FieldDefinition } from '@metriccanvas/page/internal';

type Resolution =
  | { status: 'ready'; values: EffectiveQuery['filterValues'] }
  | { status: 'waiting' }
  | { status: 'terminal'; snapshot: DataSnapshot };
type BindingResolution =
  | { status: 'ready'; value: EffectiveQuery['filterValues'][number] }
  | { status: 'waiting' | 'empty' }
  | { status: 'terminal'; snapshot: DataSnapshot };
type SelectedRows = { status: 'ready'; rows: Row[] } | { status: 'terminal'; snapshot: DataSnapshot };
const fail = (message: string): BindingResolution & { status: 'terminal' } => ({
  status: 'terminal', snapshot: { status: 'error', error: { code: 'UNKNOWN', message } }
});

/** One-shot execution, rendering and export resolve predicates from raw normalized snapshots. */
export function resolveQueryResultInputs(source: DataSource, raw: ReadonlyMap<string, DataSnapshot>, sources: ReadonlyMap<string, DataSource>, windowLimits: ReadonlyMap<string, number> = new Map()): Resolution {
  if (source.source.type !== 'query') return { status: 'ready', values: [] };
  const values: EffectiveQuery['filterValues'] = [];
  let waiting = false;
  let empty = false;
  let error: DataSnapshot | undefined;
  for (const binding of source.source.query.resultBindings ?? []) {
    const result = resolveBinding(binding, raw, sources, windowLimits);
    switch (result.status) {
      case 'waiting': waiting = true; break;
      case 'empty': empty = true; break;
      case 'terminal': error = result.snapshot; break;
      case 'ready': values.push(result.value); break;
    }
  }
  // Continue all bindings: the last error wins, ahead of empty and waiting.
  if (error) return { status: 'terminal', snapshot: error };
  if (empty) return { status: 'terminal', snapshot: { status: 'empty', totalCount: 0 } };
  return waiting ? { status: 'waiting' } : { status: 'ready', values };
}

function resolveBinding(binding: QueryResultBinding, raw: ReadonlyMap<string, DataSnapshot>, sources: ReadonlyMap<string, DataSource>, windowLimits: ReadonlyMap<string, number>): BindingResolution {
  const snapshot = raw.get(binding.source);
  if (!snapshot || snapshot.status === 'loading') return { status: 'waiting' };
  if (snapshot.status === 'error') return { status: 'terminal', snapshot: { status: 'error', error: { code: snapshot.error.code, message: '查询输入数据源失败' } } };
  const upstream = sources.get(binding.source);
  const selected = selectBindingRows(binding, snapshot, upstream, windowLimits.get(binding.source));
  if (selected.status === 'terminal') return selected;
  if (!selected.rows.length) return { status: 'empty' };
  const { unique, invalid } = collectInputValues(selected.rows, binding.field, upstream?.fields[binding.field]?.type);
  // The bound error takes precedence even if a selected row is also invalid.
  if (unique.size > binding.maxValues || binding.maxValues > MAX_QUERY_RESULT_VALUES || binding.maxValues < 1) return fail('查询输入集合超过声明上限');
  if (invalid) return fail('查询输入维度缺失或类型不合法');
  return {
    status: 'ready', value: {
      target: 'dimension', queryField: binding.queryField,
      values: [...unique.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value)
    }
  };
}

function selectBindingRows(binding: QueryResultBinding, snapshot: Extract<DataSnapshot, { status: 'ready' | 'empty' }>, upstream: DataSource | undefined, windowLimit: number | undefined): SelectedRows {
  const rows = snapshot.status === 'ready' ? snapshot.rows : [];
  const query = upstream?.source.type === 'query' ? upstream.source : undefined;
  const limit = windowLimit ?? (query ? declaredPaginationLimit(query.query) : undefined);
  if (upstream && checkOrdinaryRange(upstream, snapshot, limit).status === 'error') return fail('查询输入结果不符合声明范围');
  if (!binding.where) return { status: 'ready', rows };
  try { return { status: 'ready', rows: filterQueryResultRows(rows, binding.where, upstream?.fields ?? {}) }; }
  catch (cause) { return fail(cause instanceof Error ? cause.message : '查询输入过滤失败'); }
}

function collectInputValues(rows: Row[], field: string, fieldType: FieldDefinition['type'] | undefined): { unique: Map<string, string | number>; invalid: boolean } {
  const unique = new Map<string, string | number>();
  for (const row of rows) {
    const value = row[field];
    if (!validInputValue(value, fieldType)) return { unique, invalid: true };
    unique.set(JSON.stringify([typeof value, value]), value);
  }
  return { unique, invalid: false };
}

function validInputValue(value: unknown, fieldType: FieldDefinition['type'] | undefined): value is string | number {
  return (typeof value === 'string' || typeof value === 'number') &&
    (fieldType === undefined || typeof value === fieldType) &&
    !(typeof value === 'string' && !value.trim()) &&
    !(typeof value === 'number' && !Number.isFinite(value));
}
