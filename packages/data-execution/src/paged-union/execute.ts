import { queryResultFieldContract, restoreCellFallbacks, validateContractRows, type Row, type RowContractIssue } from '@metriccanvas/page/internal';
import { rawSnapshot } from '../snapshots';
import { intersectQueryFilters } from '../intersect-filters';
import type { QueryRunner } from '../query-runner';
import { EXPORT_MAX_ROWS, SourceRangeError } from '../source-program/range-policy';
import { unionError, unionMemberError, unionKeyLabel, unionSortLabel, unionRow, type UnionMemberPlan, type UnionPlan } from './plan';
import { compareUnionRows } from './order';

interface Cursor { member: UnionMemberPlan; rows: Row[]; index: number; offset: number; total: number; previous?: Row; seen: Map<string, number>; }
interface Progress { cursors: Cursor[]; position: number; total: number; }
const BATCH = 200, MAX_SCAN = 100_000;
export function createUnionReader(runner: QueryRunner) {
  const checkpoints = new Map<string, Progress>();
  let serial = 0;
  async function read(plan: UnionPlan, scope: string, signal: AbortSignal, complete = false) {
    const key = `${scope}:${plan.key}`;
    for (let attempt = 0; ; attempt++) {
      const operationScope = `${scope}:union:${++serial}`;
      try { return await readOnce(plan, key, operationScope, signal, complete); }
      catch (cause) {
        checkpoints.delete(key);
        if (signal.aborted) throw unionError('合并读取已取消或超时', signal.reason?.name === 'TimeoutError' ? 'DQE_TIMEOUT' : 'DQE_CANCELLED');
        if (attempt || !(cause instanceof CountChanged)) throw cause;
      } finally { runner.forgetScope(operationScope); }
    }
  }
  async function readOnce(plan: UnionPlan, key: string, scope: string, signal: AbortSignal, complete: boolean) {
    const requested = plan.view.pageIndex * plan.view.pageSize;
    const saved = checkpoints.get(key);
    let progress = !complete && saved && saved.position <= requested ? cloneProgress(saved) : await open(plan, scope, signal);
    assertReadSize(complete, progress.total);
    const pageIndex = Math.min(plan.view.pageIndex, Math.max(0, Math.ceil(progress.total / plan.view.pageSize) - 1));
    const offset = complete ? 0 : pageIndex * plan.view.pageSize;
    if (progress.position > offset) progress = await open(plan, scope, signal);
    const end = complete ? progress.total : Math.min(progress.total, offset + plan.view.pageSize);
    assertScanSize(end);
    const rows: Row[] = [];
    while (progress.position < end) {
      signal.throwIfAborted();
      await Promise.all(progress.cursors.map(cursor => refill(plan, cursor, runner, scope, signal)));
      const cursor = first(progress.cursors, plan);
      if (!cursor) throw unionError('合并分页提前结束');
      const row = cursor.rows[cursor.index++];
      if (progress.position++ >= offset) rows.push(row);
    }
    if (!complete) { checkpoints.delete(key); checkpoints.set(key, cloneProgress(progress)); trim(checkpoints, 4); }
    const snapshot = rawSnapshot(rows, progress.total);
    return { snapshot, viewCorrection: pageIndex === plan.view.pageIndex ? undefined : { ...plan.view, pageIndex } };
  }
  return { read, clear() { checkpoints.clear(); } };
  async function open(plan: UnionPlan, scope: string, signal: AbortSignal): Promise<Progress> {
    const cursors = await Promise.all(plan.members.map(async member => {
      const cursor: Cursor = { member, rows: [], index: 0, offset: 0, total: -1, seen: new Map() };
      await refill(plan, cursor, runner, scope, signal);
      return cursor;
    }));
    const total = cursors.reduce((sum, cursor) => sum + cursor.total, 0);
    if (!Number.isSafeInteger(total)) throw unionError('合并总数不是安全整数');
    return { cursors, position: 0, total };
  }
}
function trim<K, V>(map: Map<K, V>, size: number): void {
  while (map.size > size) map.delete(map.keys().next().value!);
}
function cloneProgress(progress: Progress): Progress {
  return { ...progress, cursors: progress.cursors.map(cursor => ({ ...cursor, rows: [...cursor.rows], seen: new Map(cursor.seen) })) };
}
async function refill(plan: UnionPlan, cursor: Cursor, runner: QueryRunner, scope: string, signal: AbortSignal): Promise<void> {
  if (cursor.index < cursor.rows.length || (cursor.total >= 0 && cursor.offset >= cursor.total)) return;
  const query = { ...cursor.member.query, pagination: { offset: cursor.offset, limit: BATCH } };
  const result = intersectQueryFilters(query) ? await runner.run(query, { pageId: plan.page.id, dataSourceIds: [plan.id, cursor.member.member.source] }, scope, signal) : { status: 'empty' as const, totalCount: 0 };
  signal.throwIfAborted();
  if (result.status === 'error') throw unionError(result.error.message, result.error.code);
  if (result.status === 'loading') throw unionError('来源结果尚未就绪');
  const raw = result.status === 'ready' ? result.rows : [];
  restoreCellFallbacks(raw, result.status === 'ready' ? result.cellFallbacks : undefined);
  assertBatch(cursor, raw.length, result.totalCount);
  cursor.total = result.totalCount!;
  const rows = projectedRows(plan, cursor, raw);
  for (const [index, row] of rows.entries()) validateRowOrder(plan, cursor, row, cursor.offset + index + 1);
  cursor.rows = rows; cursor.index = 0; cursor.offset += rows.length;
}
function assertBatch(cursor: Cursor, length: number, total: number | undefined): void {
  if (total === undefined || !Number.isSafeInteger(total) || total < 0) throw unionError('来源未返回准确匹配总数');
  if (cursor.total >= 0 && total !== cursor.total) throw new CountChanged();
  if (length !== Math.min(BATCH, Math.max(0, total - cursor.offset))) throw unionError('来源未返回完整分页');
}
function validateRowOrder(plan: UnionPlan, cursor: Cursor, row: Row, rowNumber: number): void {
  const key = String(row[plan.data.source.rowKey]);
  const firstRow = cursor.seen.get(key);
  if (firstRow !== undefined) {
    const advice = firstRow > cursor.offset
      ? '页面用这个字段区分每条记录，因此不能重复。请改用能区分每条记录的字段。'
      : '这次翻页返回的数据与前面有重复标识。请检查查询是否重复返回了数据，以及这个字段是否能区分每条记录。';
    throw unionMemberError(plan, cursor.member, `同一个查询返回的第 ${firstRow} 条和第 ${rowNumber} 条记录，“${unionKeyLabel(cursor.member)}”相同。${advice}\n分页定位：offset=${cursor.offset}`);
  }
  if (cursor.seen.size >= MAX_SCAN + BATCH) throw unionError('来源扫描超过资源限制', 'DQE_QUERY_REJECTED');
  cursor.seen.set(key, rowNumber);
  if (cursor.previous && compareUnionRows(cursor.previous, row, plan.view.sort) > 0) throw unionMemberError(plan, cursor.member, `查询返回的第 ${rowNumber - 1} 条和第 ${rowNumber} 条记录顺序不符合表格要求。请检查查询是否按${unionSortLabel(plan)}返回，并把空值放在最后。\n排序定位：offset=${cursor.offset}，排序=${JSON.stringify(plan.view.sort)}`);
  cursor.previous = row;
}
function first(cursors: Cursor[], plan: UnionPlan): Cursor | undefined {
  let result: Cursor | undefined;
  for (const cursor of cursors) {
    if (cursor.index >= cursor.rows.length) continue;
    if (!result || compareHeads(cursor, result, plan) < 0) result = cursor;
  }
  return result;
}
function compareHeads(left: Cursor, right: Cursor, plan: UnionPlan): number {
  const compared = compareUnionRows(left.rows[left.index], right.rows[right.index], plan.view.sort);
  if (compared) return compared;
  return left.member.id < right.member.id ? -1 : left.member.id > right.member.id ? 1 : 0;
}

class CountChanged extends Error {
  readonly code = 'DQE_QUERY_REJECTED';
  constructor() { super('读取中来源总数持续变化，请刷新重试'); }
}

function assertReadSize(complete: boolean, total: number): void {
  if (complete && total > EXPORT_MAX_ROWS) throw new SourceRangeError('EXPORT_ROW_LIMIT', '合并导出超过 10000 行');
}
function assertScanSize(end: number): void {
  if (end > MAX_SCAN) throw unionError('首次深页扫描超过 100000 行，请缩小筛选范围', 'DQE_QUERY_REJECTED');
}

function projectedRows(plan: UnionPlan, cursor: Cursor, raw: Row[]): Row[] {
  const member = cursor.member;
  const fields = Object.fromEntries(Object.entries(member.input.fields).map(([id, field]) => [id, queryResultFieldContract(field)]));
  const inputResult = validateContractRows(raw, fields);
  if (!inputResult.ok) throw unionMemberError(plan, member, contractIssueMessage('来源行违反原始结果字段契约', inputResult.issues[0], cursor.offset, fields));
  const rows = raw.map((row, index) => unionRow(plan, member, row, cursor.offset + index + 1));
  const output = Object.fromEntries(Object.entries(plan.data.fields).map(([id, field]) => [id, queryResultFieldContract(field)]));
  const outputResult = validateContractRows(rows, output);
  if (!outputResult.ok) throw unionMemberError(plan, member, contractIssueMessage('合并行违反最终结果字段契约', outputResult.issues[0], cursor.offset, output));
  return rows;
}

function contractIssueMessage(message: string, issue: RowContractIssue, offset: number, fields: Readonly<Record<string, { label?: string }>>): string {
  const row = 'rowIndex' in issue ? `第 ${offset + issue.rowIndex + 1} 条记录` : '记录';
  const field = 'fieldId' in issue ? `中的“${fields[issue.fieldId]?.label ?? '字段'}”` : '';
  return `查询返回的${row}${field}不符合页面要求的数据格式。请检查查询返回的数据。\n格式定位：${message}，${JSON.stringify(issue)}（offset=${offset}）`;
}
