import { dqeRecord, type EffectiveQuery, type Row } from '@metriccanvas/page/internal';
import { candidateKey, localColumnCandidates } from '../column-candidates';
import type { ColumnCandidatesPage, ColumnCandidatesQuery, DataGateway, DataGatewayResult, QueryDiagnosticContext } from '../ports';

export interface FullQueryCandidatesConfig {
  mode: 'fullQuery';
  /** Source rows per HTTP read, independent of table and candidate display pages. */
  batchSize?: number;
  /** Maximum original-result rows to scan; larger ranges require an explicit override. */
  maxRows?: number;
}

const rowError = (message: string) => Object.assign(new Error(message), { code: 'DQE_ROW_CONTRACT_ERROR' });

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw Object.assign(new Error('列候选读取已取消'), { code: 'DQE_CANCELLED' });
}

/** A limit without offset selects a business TopN; table windows carry an offset. */
function businessLimit(query: EffectiveQuery): number | undefined {
  const order = dqeRecord(query.body.dsl_list[0].order);
  if (order.offset !== undefined || order.limit === undefined) return undefined;
  if (!Number.isSafeInteger(order.limit) || Number(order.limit) < 1) throw rowError('候选查询的业务窗口不合法');
  return Number(order.limit);
}

function checkedTotal(result: DataGatewayResult, expected: number | undefined, offset: number, limit: number): number {
  const total = result.totalCount;
  if (total === undefined || !Number.isSafeInteger(total) || total < 0) throw rowError('完整列候选查询需要准确的原始结果总数');
  if (expected !== undefined && total !== expected) throw rowError('列候选分批读取期间总数变化，请重试');
  if (result.rows.length !== Math.min(limit, Math.max(0, total - offset))) throw rowError('列候选原始结果被截断，不能使用部分候选');
  return total;
}

function collectValues(values: Map<string, Row>, rows: readonly Row[], field: string): void {
  for (const row of rows) {
    const value = row[field];
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    values.set(candidateKey(value), { [field]: value });
  }
}

function positiveSize(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw Object.assign(new Error(`列候选${name}必须为正安全整数`), { code: 'DQE_CONFIG_ERROR' });
  return value;
}

function assertWithinBudget(total: number, top: number | undefined, maxRows: number): void {
  if (Math.min(total, top ?? total) > maxRows) throw Object.assign(
    new Error(`候选数据超过${maxRows}条查询上限，无法提供完整选项；请缩小筛选范围，或联系管理员显式提高上限。`),
    { code: 'DQE_CANDIDATE_LIMIT_EXCEEDED' });
}

/** Preserve the original projection and grain; deduplicate only after reading its full range. */
export async function fullQueryColumnCandidates(
  request: ColumnCandidatesQuery,
  fetchData: DataGateway['fetchData'],
  config: FullQueryCandidatesConfig,
  context?: QueryDiagnosticContext,
  signal?: AbortSignal
): Promise<ColumnCandidatesPage> {
  const batchSize = positiveSize(config.batchSize ?? 200, '批量大小');
  const maxRows = positiveSize(config.maxRows ?? 1000, '查询上限');
  const query = structuredClone(request.query), top = businessLimit(query);
  const values = new Map<string, Row>();
  let offset = 0, total: number | undefined;
  do {
    assertActive(signal);
    const limit = Math.min(batchSize, maxRows - offset, (top ?? maxRows) - offset);
    const result = await fetchData({ ...query, pagination: { offset, limit } }, context, signal);
    assertActive(signal);
    total = checkedTotal(result, total, offset, limit);
    assertWithinBudget(total, top, maxRows);
    collectValues(values, result.rows, request.field);
    offset += result.rows.length;
    // A fast transport must still give input/paint tasks a turn between source batches.
    if (offset < Math.min(total, top ?? total)) await new Promise<void>(resolve => setTimeout(resolve, 0));
  } while (offset < Math.min(total, top ?? total));
  return localColumnCandidates([...values.values()], request.field,
    { pageIndex: 0, pageSize: request.limit, sort: [], predicates: [] }, request.search, request.offset, request.limit);
}
