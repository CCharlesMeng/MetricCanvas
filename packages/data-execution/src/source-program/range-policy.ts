import { canonicalizeJson, declaredPaginationLimit, type DataSnapshot, type DataSource, type EffectiveQuery, type TableQueryView, type Row } from '@metriccanvas/page/internal';
import type { QueryRunner } from '../query-runner';
import type { QueryDiagnosticContext } from '../ports';
import { rawSnapshot } from '../snapshots';

export const EXPORT_MAX_ROWS = 10_000;
export const EXPORT_PREPARATION_TIMEOUT_MS = 60_000;
export class SourceRangeError extends Error {
  constructor(public readonly code: 'EXPORT_ROW_LIMIT' | 'EXPORT_INCOMPLETE_DATA', message: string) { super(message); }
}
export function reusableInitialSnapshot(source: DataSource, view?: TableQueryView, windowed=false): DataSnapshot | undefined {
  if (source.source.type === 'inline') return rawSnapshot(source.source.rows);
  const initial = source.source.initial;
  if (!initial) return undefined;
  if (source.source.type === 'pagedJoin') {
    if (!view || canonicalizeJson(source.source.initial!.view) !== canonicalizeJson(view)) return undefined;
  } else if (view && (view.pageIndex !== 0 || view.sort.length || view.predicates.length || view.search?.query.trim())) return undefined;
  if ((windowed||source.source.type==='pagedJoin') && view && initial.totalCount !== undefined && initial.rows.length !== Math.min(view.pageSize, initial.totalCount)) return undefined;
  return rawSnapshot(initial.rows, initial.totalCount);
}
export function checkOrdinaryRange(source: DataSource, snapshot: DataSnapshot, limit?: number): DataSnapshot {
  if (snapshot.status === 'error' || snapshot.status === 'loading' || source.source.type !== 'query') return snapshot;
  const count = snapshot.status === 'ready' ? snapshot.rows.length : 0;
  if ((snapshot.totalCount !== undefined && (!Number.isSafeInteger(snapshot.totalCount) || snapshot.totalCount < count)) ||
    (source.source.resultScope === 'complete' && snapshot.totalCount !== undefined && snapshot.totalCount !== count) ||
    (limit !== undefined && count > limit)) return { status: 'error', error: { code: 'DQE_ROW_CONTRACT_ERROR', message: '查询结果不符合字段或范围契约' } };
  return snapshot;
}
/** A static limit without offset is a business selection unless a table owns its window. */
export function isBusinessSelection(source:DataSource,mutableWindow:boolean):boolean {
  if(source.source.type!=='query'||mutableWindow||declaredPaginationLimit(source.source.query)===undefined)return false;
  const order=source.source.query.body.dsl_list[0].order;
  return typeof order==='object'&&order!==null&&!Array.isArray(order)&&!('offset' in order);
}
export function correctedPageIndex(query: EffectiveQuery, snapshot: DataSnapshot): number | undefined {
  if (!query.pagination || snapshot.status === 'error' || snapshot.status === 'loading') return undefined;
  const total = snapshot.totalCount;
  if (total === undefined || (total > 0 && query.pagination.offset < total) || (total === 0 && query.pagination.offset === 0)) return undefined;
  return Math.max(0, Math.ceil(total / query.pagination.limit) - 1);
}
export async function fetchComplete(query: EffectiveQuery, runner: QueryRunner, scope: string, signal: AbortSignal | undefined, diagnostics: QueryDiagnosticContext, trustedComplete = false): Promise<DataSnapshot> {
  const frozen = structuredClone(query);
  const declared = frozen.pagination?.limit ?? declaredPaginationLimit({ language: frozen.language, body: frozen.body });
  const limit = Math.min(declared ?? 500, 500);
  let paged = declared !== undefined, offset = 0, expected: number | undefined;
  const rows: Row[] = [];
  while (true) {
    signal?.throwIfAborted();
    const result = await runner.run({ ...frozen, ...(paged ? { pagination: { offset, limit } } : {}) }, diagnostics, scope, signal);
    signal?.throwIfAborted();
    if (result.status === 'error' || result.status === 'loading') return result;
    const chunk = result.status === 'ready' ? result.rows : [];
    if (result.totalCount !== undefined && (!Number.isSafeInteger(result.totalCount) || result.totalCount < 0)) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '导出结果总数不合法');
    if (result.totalCount !== undefined && result.totalCount > EXPORT_MAX_ROWS) throw new SourceRangeError('EXPORT_ROW_LIMIT', '导出单表超过 10000 行');
    if (expected !== undefined && result.totalCount !== expected) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '导出分页期间结果总数发生变化');
    expected ??= result.totalCount;
    if (!paged && expected !== undefined && expected > chunk.length) { paged = true; continue; }
    if (paged && expected === undefined) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '完整导出分页需要 totalCount');
    if (paged && chunk.length > limit) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '导出分页返回行数超出请求范围');
    rows.push(...chunk);
    if (rows.length > EXPORT_MAX_ROWS) throw new SourceRangeError('EXPORT_ROW_LIMIT', '导出单表超过 10000 行');
    if (expected !== undefined && rows.length > expected) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '导出行数超出结果总数');
    if (!paged && expected === undefined && !trustedComplete) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '完整导出需要 totalCount 或显式完整结果契约');
    if (!paged || rows.length === expected) return rawSnapshot(rows, rows.length);
    if (!chunk.length) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '导出分页提前结束');
    offset = rows.length;
  }
}
