import {isObjectDqeItem,queryLeaves} from '@metriccanvas/page/internal';
import { canonicalizeJson, declaredPaginationLimit, type DataSnapshot, type DataSource, type EffectiveQuery, type TableQueryView, type Row,type EmbeddedInitialRows } from '@metriccanvas/page/internal';
import type { QueryRunner } from '../query-runner';
import type { QueryDiagnosticContext } from '../ports';
import { rawSnapshot } from '../snapshots';
import type { ExportSourceDetails } from './export-diagnostics';

export const EXPORT_MAX_ROWS = 10_000;
export const EXPORT_PREPARATION_TIMEOUT_MS = 60_000;
export class SourceRangeError extends Error {
  constructor(public readonly code: 'EXPORT_ROW_LIMIT' | 'EXPORT_INCOMPLETE_DATA', message: string) { super(message); }
}
export function reusableInitialSnapshot(source: DataSource, view?: TableQueryView, windowed = false): DataSnapshot | undefined {
  if (source.source.type === 'inline') return rawSnapshot(source.source.rows);
  if(source.source.type==='pagedJoin'&&source.source.records)return undefined;
  const initial = source.source.initial;
  if (!initial) return undefined;
  if ((source.source.type === 'pagedJoin' || source.source.type === 'pagedUnion')) {
    if (!view || canonicalizeJson(source.source.initial!.view) !== canonicalizeJson(view)) return undefined;
  } else if (view && changedInitialView(view)) return undefined;
  if(incompleteInitialWindow(source,initial,view,windowed))return undefined;
  return rawSnapshot(initial.rows, initial.totalCount, initial.cellFallbacks);
}
interface RangeReadOptions { allowZeroTotal?: boolean; describeSource?: () => ExportSourceDetails }
export function checkOrdinaryRange(source: DataSource, snapshot: DataSnapshot, limit?: number, diagnostics?: QueryDiagnosticContext & { pagination?: EffectiveQuery['pagination'] }, options?: RangeReadOptions): DataSnapshot {
  if (snapshot.status === 'error' || snapshot.status === 'loading' || source.source.type !== 'query') return snapshot;
  const count = snapshot.status === 'ready' ? snapshot.rows.length : 0;
  if (snapshot.totalCount !== undefined && (!Number.isSafeInteger(snapshot.totalCount) || snapshot.totalCount < 0)) {
    return { status: 'error', error: { code: 'DQE_ROW_CONTRACT_ERROR', message: '查询结果 totalCount 必须是非负安全整数' } };
  }
  if (limit !== undefined && count > limit) {
    return { status: 'error', error: { code: 'DQE_ROW_CONTRACT_ERROR', message: `查询返回 ${count} 行，超过请求上限 ${limit} 行` } };
  }
  if (incompleteObjectSource(source,count,snapshot.totalCount,options?.allowZeroTotal)) return {status:'error',error:{code:'DQE_ROW_CONTRACT_ERROR',message:'object complete 结果与 totalCount 不一致'}};
  if (diagnostics && snapshot.totalCount !== undefined &&
    totalCountMismatch(count, snapshot.totalCount, source.source.resultScope, diagnostics)) {
    console.warn('[MetricCanvas][TOTAL_COUNT_MISMATCH] 查询结果总数与返回行数不一致；继续使用已返回数据', {
      code: 'TOTAL_COUNT_MISMATCH', ...diagnostics, ...options?.describeSource?.(), completeness: 'unverified', rowCount: count,
      totalCount: snapshot.totalCount, resultScope: source.source.resultScope
    });
  }
  return snapshot;
}
/** A static limit without offset is a business selection unless a table owns its window. */
export function isBusinessSelection(source:DataSource,mutableWindow:boolean):boolean {
  if(source.source.type!=='query'||mutableWindow||declaredPaginationLimit(source.source.query)===undefined)return false;
  return queryLeaves(source.source.query).every(query=>{const order=query.body.dsl_list[0].order;
  return typeof order==='object'&&order!==null&&!Array.isArray(order)&&!('offset' in order);});
}
export function correctedPageIndex(query: EffectiveQuery, snapshot: DataSnapshot): number | undefined {
  if (!query.pagination || snapshot.status === 'error' || snapshot.status === 'loading') return undefined;
  // A stale total must never replace a non-empty returned window with another page.
  if (snapshot.status === 'ready' && snapshot.rows.length > 0) return undefined;
  const total = snapshot.totalCount;
  if (total === undefined || (total > 0 && query.pagination.offset < total) || (total === 0 && query.pagination.offset === 0)) return undefined;
  return Math.max(0, Math.ceil(total / query.pagination.limit) - 1);
}
export async function fetchComplete(query: EffectiveQuery, runner: QueryRunner, scope: string, signal: AbortSignal | undefined, diagnostics: QueryDiagnosticContext, trustedComplete = false, describeSource?: () => ExportSourceDetails, allowPartial = false, allowZeroTotal?: boolean): Promise<DataSnapshot> {
  const { frozen, declared, limit } = exportReadWindow(query);
  const strict = isObjectDqeItem(query.body.dsl_list[0]);
  let paged = declared !== undefined, offset = 0, expected: number | undefined;
  const rows: Row[] = [];
  while (true) {
    signal?.throwIfAborted();
    const result = await runner.run({ ...frozen, ...(paged ? { pagination: { offset, limit } } : {}) }, diagnostics, scope, signal);
    signal?.throwIfAborted();
    if (result.status === 'error' || result.status === 'loading') {
      return failedPage(result);
    }
    const chunk = result.status === 'ready' ? result.rows : [];
    assertExportTotal(result.totalCount, expected);
    expected ??= result.totalCount;
    if (requiresPagedRead(paged, expected, chunk.length)) { paged = true; continue; }
    assertExportChunk(paged, expected, chunk.length, limit);
    rows.push(...chunk);
    assertExportRowLimit(rows.length);
    if (expected !== undefined && rows.length > expected) {
      return excessRows(chunk.length);
    }
    assertExportCompleteness(paged, expected, trustedComplete);
    if (!paged || rows.length === expected) return rawSnapshot(rows, rows.length);
    if (!chunk.length) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '导出分页提前结束');
    offset = rows.length;
  }
  function failedPage(result: DataSnapshot): DataSnapshot {
    if (strict || !allowPartial || !rows.length) return result;
    console.warn('[MetricCanvas][EXPORT_PARTIAL_DATA] 后续分页取数失败；导出已取得的数据，完整性未确认', {
      code: 'EXPORT_PARTIAL_DATA', ...diagnostics, ...describeSource?.(),
      accumulatedRowCount: rows.length, expectedTotalCount: expected,
      pagination: { offset, limit }, completeness: 'unverified'
    });
    return rawSnapshot(rows, rows.length);
  }
  function excessRows(pageRowCount: number): DataSnapshot {
    // Screen reads retain the contradictory total; strict full reads still fail.
    if (allowZeroTotal && expected === 0) return rawSnapshot(rows, expected);
    if(strict)throw new SourceRangeError('EXPORT_INCOMPLETE_DATA','object 完整结果行数超过 totalCount');
    const sourceDetails = describeSource?.();
    const location = sourceDetails ? ` [数据源 ${sourceDetails.dataSourceId}；组件 ${sourceDetails.components.map(component => `${component.componentTitle ?? component.componentType} (${component.componentId})`).join('、') || '无组件引用'}]` : '';
    console.warn(`[MetricCanvas][EXPORT_TOTAL_COUNT_MISMATCH]${location} 导出行数超出结果总数；继续导出已取得的数据，完整性未确认`, {
      code: 'EXPORT_TOTAL_COUNT_MISMATCH',
      pageId: diagnostics.pageId,
      pageRevisionId: diagnostics.pageRevisionId,
      dataSourceIds: diagnostics.dataSourceIds,
      ...sourceDetails,
      expectedTotalCount: expected,
      accumulatedRowCount: rows.length,
      pageRowCount,
      pagination: paged ? { offset, limit } : undefined,
      completeness: 'unverified'
    });
    // The reported total cannot guide further reads. Retain received rows without
    // truncating or guessing row identity, and stop before repeating more pages.
    return rawSnapshot(rows, rows.length);
  }
}

function changedInitialView(view: TableQueryView): boolean {
  return !!(view.pageIndex !== 0 || view.sort.length || view.predicates.length || view.search?.query.trim());
}
function totalCountMismatch(count: number, total: number, resultScope: 'complete' | undefined, diagnostics: QueryDiagnosticContext & { pagination?: EffectiveQuery['pagination'] }): boolean {
  return (count > 0 && total < (diagnostics.pagination?.offset ?? 0) + count) || (resultScope === 'complete' && total !== count);
}
function exportReadWindow(query: EffectiveQuery) {
  const frozen = structuredClone(query);
  const declared = frozen.pagination?.limit ?? declaredPaginationLimit({ language: frozen.language, body: frozen.body });
  const limit = Math.min(declared ?? 500, 500);
  return { frozen, declared, limit };
}
function assertExportTotal(total: number | undefined, expected: number | undefined): void {
  if (total !== undefined && (!Number.isSafeInteger(total) || total < 0)) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '导出结果总数不合法');
  if (total !== undefined && total > EXPORT_MAX_ROWS) throw new SourceRangeError('EXPORT_ROW_LIMIT', '导出单表超过 10000 行');
  if (expected !== undefined && total !== expected) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '导出分页期间结果总数发生变化');
}
function requiresPagedRead(paged: boolean, expected: number | undefined, count: number): boolean {
  return !paged && expected !== undefined && expected > count;
}
function assertExportChunk(paged: boolean, expected: number | undefined, count: number, limit: number): void {
  if (paged && expected === undefined) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '完整导出分页需要 totalCount');
  if (paged && count > limit) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '导出分页返回行数超出请求范围');
}
function assertExportRowLimit(count: number): void {
  if (count > EXPORT_MAX_ROWS) throw new SourceRangeError('EXPORT_ROW_LIMIT', '导出单表超过 10000 行');
}
function assertExportCompleteness(paged: boolean, expected: number | undefined, trusted: boolean): void {
  if (!paged && expected === undefined && !trusted) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '完整导出需要 totalCount 或显式完整结果契约');
}

function incompleteObjectSource(source: DataSource, count: number, total: number | undefined, allowZeroTotal?: boolean): boolean {
  if (allowZeroTotal && total === 0 && count > 0) return false;
  return source.source.type==='query' && source.source.resultScope==='complete' && total!==undefined && count!==total && queryLeaves(source.source.query).some(query=>isObjectDqeItem(query.body.dsl_list[0]));
}

const reportedInitialWarnings = new WeakSet<object>();
export function reportInitialWarnings(source: DataSource, diagnostics: QueryDiagnosticContext): void {
  if (source.source.type !== 'query') return;
  const initial = source.source.initial;
  if (!initial?.warnings?.length || reportedInitialWarnings.has(initial)) return;
  reportedInitialWarnings.add(initial);
  console.warn('[MetricCanvas][QUERY_VALUE_FALLBACK] 初始查询标量异常；保留可用数据', { ...diagnostics, warnings: initial.warnings });
}

export function reportInitialSnapshotWarnings(source: DataSource, snapshot: DataSnapshot | undefined, diagnostics: QueryDiagnosticContext): void {
  if (source.source.type !== 'query' || snapshot?.status !== 'ready') return;
  if (snapshot.rows[0] === source.source.initial?.rows[0]) reportInitialWarnings(source, diagnostics);
}

function incompleteInitialWindow(source:DataSource,initial:EmbeddedInitialRows,view:TableQueryView|undefined,windowed:boolean):boolean{
  const combined=source.source.type==='pagedJoin'||source.source.type==='pagedUnion';
  return !!((windowed||combined)&&view&&initial.totalCount!==undefined&&initial.rows.length!==Math.min(view.pageSize,initial.totalCount));
}
