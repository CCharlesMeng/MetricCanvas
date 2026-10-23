import {isObjectDqeItem,queryLeaves} from '@metriccanvas/page/internal';
import type { Row } from '@metriccanvas/page/internal';
import type { PagedJoinPlan } from './plan';
import type { QueryRunner } from '../query-runner';
import { executePagedJoin } from './execute';
import { rawSnapshot } from '../snapshots';
import { EXPORT_MAX_ROWS, SourceRangeError } from '../source-program/range-policy';
import { describeExportSource } from '../source-program/export-diagnostics';

export async function exportPagedJoin(plan: PagedJoinPlan, runner: QueryRunner, scope: string, signal?: AbortSignal, allowPartial = false): Promise<Awaited<ReturnType<typeof executePagedJoin>>> {
  if (!plan.selection) return executePagedJoin(plan, runner, scope, signal, true);
  const rows: Row[] = [], keys = new Set<unknown>();
  const canReturnPartial=partialAllowed(plan,allowPartial);
  let expected: number | undefined;
  function partial() {
    console.warn('[MetricCanvas][EXPORT_PARTIAL_DATA] 后续组合分页取数失败；导出已取得的数据，完整性未确认', {
      code: 'EXPORT_PARTIAL_DATA', pageId: plan.page.id, ...describeExportSource(plan.page, plan.sourceId),
      accumulatedRowCount: rows.length, expectedTotalCount: expected, completeness: 'unverified'
    });
    return { snapshot: rawSnapshot(rows, rows.length) };
  }
  for (let pageIndex = 0; ; pageIndex++) {
    signal?.throwIfAborted();
    let result: Awaited<ReturnType<typeof executePagedJoin>>;
    try { result = await executePagedJoin({ ...plan, view: { ...plan.view, pageIndex } }, runner, scope, signal); }
    catch (cause) {
      signal?.throwIfAborted();
      if (canReturnPartial && rows.length) return partial();
      throw cause;
    }
    const snapshot = result.snapshot;
    signal?.throwIfAborted();
    if (snapshot.status !== 'ready' && snapshot.status !== 'empty') {
      if (canReturnPartial && rows.length) return partial();
      throw new SourceRangeError('EXPORT_INCOMPLETE_DATA', '组合导出执行失败');
    }
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

function hasObjectMember(plan: PagedJoinPlan): boolean {
  return [...plan.members.values()].some(member=>queryLeaves(member.source.query).some(query=>isObjectDqeItem(query.body.dsl_list[0])));
}

function partialAllowed(plan: PagedJoinPlan, requested: boolean): boolean { return requested && !hasObjectMember(plan); }
