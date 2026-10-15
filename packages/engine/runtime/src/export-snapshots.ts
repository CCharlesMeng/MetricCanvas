import { createSourceProgram, visibleSourceIds, SourceRangeError, type SourceProgram } from '@metriccanvas/data-execution/runtime';
import type { Page, DataSnapshot, EffectiveQuery, TableQueryView } from '@metriccanvas/page/internal';
import type { DataGateway, QueryDiagnosticContext } from './ports';
import type { FilterValues } from './filter-state';
export { EXPORT_MAX_ROWS, EXPORT_PREPARATION_TIMEOUT_MS } from '@metriccanvas/data-execution/runtime';
export class ExportViewError extends Error {
  constructor(public readonly code: 'EXPORT_NOT_READY' | 'EXPORT_BUSY' | 'EXPORT_ROW_LIMIT' | 'EXPORT_TIMEOUT' | 'EXPORT_INCOMPLETE_DATA' | 'EXPORT_RENDER_FAILED' | 'EXPORT_CANCELLED', message: string) { super(message); this.name = 'ExportViewError'; }
}
/** A thin complete-read adapter. Existing callers may supply captured ordinary queries. */
export async function prepareExportSnapshots(page: Page, gateway: DataGateway, queries: ReadonlyMap<string, EffectiveQuery>, filters: FilterValues, signal: AbortSignal, diagnosticBase?: QueryDiagnosticContext, currentYear = new Date().getFullYear(), completeSources: readonly string[] = [], views?: ReadonlyMap<string, TableQueryView>, sharedProgram?: SourceProgram, options: { allowPartial?: boolean } = {}): Promise<Map<string, DataSnapshot>> {
  const program = sharedProgram ?? createSourceProgram(page, { gateway, diagnostics: diagnosticBase });
  const result = new Map<string, DataSnapshot>();
  try {
    for await (const update of program.read({ roots: [...visibleSourceIds(page)], conditions: filters, queries, views, purpose: 'complete', freshness: 'refresh', signal, currentYear, completeSources, allowPartial: options.allowPartial })) result.set(update.sourceId, update.snapshot);
    if (!options.allowPartial) for (const value of result.values()) if (value.status === 'error' || value.status === 'loading') throw new ExportViewError('EXPORT_INCOMPLETE_DATA', '导出查询或数据计算未完成');
    return result;
  } catch (cause) {
    if (cause instanceof SourceRangeError) throw new ExportViewError(cause.code, cause.message);
    if (cause instanceof Error && cause.name==='TimeoutError') throw new ExportViewError('EXPORT_TIMEOUT','导出准备超过 60 秒');
    if (!signal.aborted && !(cause instanceof ExportViewError)) throw new ExportViewError('EXPORT_INCOMPLETE_DATA', '导出查询或数据计算未完成');
    throw cause;
  } finally { if (!sharedProgram) program.dispose(); }
}
