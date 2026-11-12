import { restoreCellFallbacks, type DataSnapshot, type EffectiveQuery, type Row } from '@metriccanvas/page/internal';
import type { QueryRunner } from '../query-runner';

export const SLOT_SEARCH_MAX_ROWS = 100_000;
export const SLOT_SEARCH_MAX_BYTES = 64 * 1024 * 1024;
export const SLOT_SEARCH_TIMEOUT_MS = 180_000;
export interface SearchBudget { rows: number; bytes: number; signal: AbortSignal }
export const searchFailure = (message: string, code = 'DQE_QUERY_REJECTED'): never => { throw Object.assign(new Error(message), { code }); };

export function searchKey(value: unknown): string | number {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return searchFailure('跨槽搜索结果缺少有效的关联行键', 'DQE_ROW_CONTRACT_ERROR');
}

function charge(budget: SearchBudget, rows: Row[]): void {
  budget.rows += rows.length;
  budget.bytes += new TextEncoder().encode(JSON.stringify(rows)).byteLength;
  if (budget.rows > SLOT_SEARCH_MAX_ROWS) searchFailure('跨槽搜索累计读取超过 100000 行，请缩小范围');
  if (budget.bytes > SLOT_SEARCH_MAX_BYTES) searchFailure('跨槽搜索累计读取超过 64 MiB，请缩小范围');
}

function checkedBatch(snapshot: DataSnapshot, offset: number, limit: number, expected: number | undefined, budget: SearchBudget) {
  if (snapshot.status === 'error') return searchFailure(snapshot.error.message, snapshot.error.code);
  if (snapshot.status === 'loading') return searchFailure('跨槽搜索结果尚未就绪');
  const total = snapshot.totalCount, rows = snapshot.status === 'ready' ? snapshot.rows : [];
  if (total === undefined || !Number.isSafeInteger(total) || total < 0) return searchFailure('跨槽搜索缺少准确的匹配总数', 'DQE_ROW_CONTRACT_ERROR');
  if (expected !== undefined && expected !== total) return searchFailure('跨槽搜索期间匹配总数变化，请重试', 'DQE_ROW_CONTRACT_ERROR');
  if (budget.rows + total - offset > SLOT_SEARCH_MAX_ROWS) return searchFailure('跨槽搜索累计读取超过 100000 行，请缩小范围');
  if (rows.length !== Math.min(limit, Math.max(0, total - offset))) return searchFailure('跨槽搜索返回的分页不完整', 'DQE_ROW_CONTRACT_ERROR');
  if (snapshot.status === 'ready') restoreCellFallbacks(rows, snapshot.cellFallbacks);
  return { rows, total };
}

/** All stages share one cumulative budget and deadline; no partial receipt can escape. */
export async function readSearchBatches(query: EffectiveQuery, runner: QueryRunner, scope: string, budget: SearchBudget, pageId: string, ids: string[]): Promise<Row[]> {
  const rows: Row[] = [];
  let expected: number | undefined;
  do {
    budget.signal.throwIfAborted();
    const limit = 200;
    const snapshot = await runner.run({ ...query, pagination: { offset: rows.length, limit } }, { pageId, dataSourceIds: ids }, scope, budget.signal);
    budget.signal.throwIfAborted();
    const batch = checkedBatch(snapshot, rows.length, limit, expected, budget);
    expected = batch.total;
    charge(budget, batch.rows);
    rows.push(...batch.rows);
  } while (rows.length < expected);
  return rows;
}
