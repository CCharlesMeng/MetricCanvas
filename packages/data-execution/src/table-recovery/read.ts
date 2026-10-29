import type { DataSnapshot, DataWarning, EffectiveQuery, Row, TableQueryView } from '@metriccanvas/page/internal';
import type { QueryRunner } from '../query-runner';
import { rawSnapshot } from '../snapshots';
import { evaluateTableView } from '../table-view';
import { EXPORT_MAX_ROWS, SourceRangeError } from '../source-program/range-policy';

export interface RecoveryContext {
  pageId: string; sourceId: string; signal: AbortSignal;
  warnings: Map<string, DataWarning>; bytes: number; maxBytes: number;
  scanned: number; maxScan: number;
}
export function recoverable(cause: unknown): boolean {
  const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
  return code === 'DQE_ROW_CONTRACT_ERROR' || code === 'DQE_FIELD_MAPPING_ERROR' || code === 'DQE_ITEM_ERROR' || code === 'EXPORT_INCOMPLETE_DATA' ||
    (cause instanceof Error && 'resultIssue' in cause && cause.resultIssue === true);
}
export async function withTableRecovery<T>(read: () => Promise<T>, recover: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try { return await read(); }
  catch (cause) {
    signal?.throwIfAborted();
    if (!recoverable(cause)) throw cause;
    return recover().catch(cause => {
      signal?.throwIfAborted();
      if (cause instanceof Error && cause.name === 'TimeoutError') throw Object.assign(new Error('异常数据整理已超时'), {code:'DQE_TIMEOUT'});
      throw cause;
    });
  }
}
export function recoveryContext(pageId: string, sourceId: string, signal?: AbortSignal, timeout = 60_000, maxBytes = 64 * 1024 * 1024): RecoveryContext {
  return { pageId, sourceId, signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeout)]), warnings: new Map(), bytes: 0, maxBytes, scanned: 0, maxScan: Infinity };
}
export function warn(context: RecoveryContext, sourceId: string, message: string, count = 1): void {
  const key = JSON.stringify([sourceId, message]);
  const previous = context.warnings.get(key);
  context.warnings.set(key, { code: 'TABLE_RESULT_RECOVERED', sourceId, message, count: (previous?.count ?? 0) + count });
}
export async function recoveryRows(query: EffectiveQuery, runner: QueryRunner, scope: string, context: RecoveryContext, sourceId: string, maxRows: number): Promise<Row[]> {
  const rows: Row[] = [], limit = Math.min(200, maxRows);
  let expected: number | undefined;
  while (true) {
    context.signal.throwIfAborted();
    const result = await runner.run({ ...query, resultPolicy: 'display', pagination: { offset: rows.length, limit } },
      { pageId: context.pageId, dataSourceIds: [context.sourceId, sourceId] }, scope, context.signal);
    context.signal.throwIfAborted();
    if (result.status === 'error') {
      if (!recoverable(result.error)) throw Object.assign(new Error(result.error.message), { code: result.error.code });
      warn(context, sourceId, '部分查询结果不可用，已保留可用数据');
      return rows;
    }
    if (result.status === 'loading') throw new Error('查询尚未完成');
    const batch = result.status === 'ready' ? result.rows : [];
    context.scanned += batch.length;
    if (context.scanned > context.maxScan) throw recoveryLimit();
    checkRecoveryBudget(context, rows.length, batch, maxRows);
    checkRecoveryCount(context, sourceId, result.totalCount, expected);
    expected = validTotal(result.totalCount) ? result.totalCount : undefined;
    rows.push(...batch);
    if (batch.length < limit || (expected !== undefined && rows.length >= expected)) {
      if (expected !== rows.length) warn(context, sourceId, '上游总数与可用窗口不一致，结果可能有缺项');
      return rows;
    }
    if (rows.length >= maxRows) throw recoveryLimit();
  }
}
function checkRecoveryBudget(context: RecoveryContext, count: number, batch: Row[], maxRows: number): void {
  context.bytes += new TextEncoder().encode(JSON.stringify(batch)).byteLength;
  if (count + batch.length > maxRows) throw recoveryLimit();
  if (context.bytes > context.maxBytes) throw Object.assign(new Error('异常数据整理超过字节预算，请缩小筛选范围'), { code: 'DQE_QUERY_REJECTED' });
}
function checkRecoveryCount(context: RecoveryContext, sourceId: string, total: number | undefined, expected: number | undefined): void {
  if (!validTotal(total) || (expected !== undefined && total !== expected)) {
    warn(context, sourceId, '上游总数不可确认，结果可能有缺项');
  }
}
function validTotal(total: number | undefined): total is number { return total !== undefined && Number.isSafeInteger(total) && total >= 0; }
function recoveryLimit(): Error { return Object.assign(new Error('异常数据整理超过行数上限，请缩小筛选范围'), {code:'DQE_QUERY_REJECTED'}); }
export function recoveryView(context: RecoveryContext, rows: Row[], view: TableQueryView, complete: boolean): { snapshot: DataSnapshot; viewCorrection?: TableQueryView } {
  context.signal.throwIfAborted();
  checkRecoveryBudget(context, 0, rows, Infinity);
  const result = evaluateTableView(rows, view, complete);
  if (complete && result.totalCount > EXPORT_MAX_ROWS) throw new SourceRangeError('EXPORT_ROW_LIMIT', '导出单表超过 10000 行');
  const warnings = [...context.warnings.values()];
  console.warn('[MetricCanvas][TABLE_RESULT_RECOVERED] 表格已兼容异常数据，结果有缺项或经过整理', { pageId: context.pageId, sourceId: context.sourceId, warnings });
  const snapshot = { ...rawSnapshot(result.rows, result.totalCount), warnings };
  return { snapshot, ...(result.pageIndex === view.pageIndex ? {} : { viewCorrection: { ...view, pageIndex: result.pageIndex } }) };
}
