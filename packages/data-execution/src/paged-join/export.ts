import type { Row } from '@metriccanvas/page/internal';
import type { PagedJoinPlan } from './plan';
import type { QueryRunner } from '../query-runner';
import { executePagedJoin } from './execute';
import { rawSnapshot } from '../snapshots';
import { EXPORT_MAX_ROWS, SourceRangeError } from '../source-program/range-policy';

export async function exportPagedJoin(plan: PagedJoinPlan, runner: QueryRunner, scope: string, signal?: AbortSignal) {
  if (!plan.selection) return executePagedJoin(plan, runner, scope, signal, true);
  const rows: Row[] = [], keys = new Set<unknown>();
  let expected: number | undefined;
  for (let pageIndex = 0; ; pageIndex++) {
    signal?.throwIfAborted();
    const result = await executePagedJoin({ ...plan, view: { ...plan.view, pageIndex } }, runner, scope, signal);
    const snapshot = result.snapshot;
    if (snapshot.status !== 'ready' && snapshot.status !== 'empty') throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '组合导出执行失败');
    const total = snapshot.totalCount;
    if (total === undefined || (expected !== undefined && expected !== total) || result.viewCorrection) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '组合导出总数或窗口发生变化');
    if (total > EXPORT_MAX_ROWS) throw new SourceRangeError('EXPORT_ROW_LIMIT', '导出单表超过 10000 行');
    expected = total;
    const chunk = snapshot.status === 'ready' ? snapshot.rows : [];
    for (const row of chunk) {
      const key = row[plan.source.source.rowKey];
      if (keys.has(key)) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '组合导出出现重复业务键');
      keys.add(key); rows.push(row);
    }
    if (rows.length === expected) return { snapshot: rawSnapshot(rows, expected) };
    if (!chunk.length || rows.length > expected) throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '组合导出提前结束或超出总数');
  }
}
