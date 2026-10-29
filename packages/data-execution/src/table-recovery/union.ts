import type { Row } from '@metriccanvas/page/internal';
import { unionRow, type UnionPlan } from '../paged-union/plan';
import type { QueryRunner } from '../query-runner';
import { EXPORT_MAX_ROWS } from '../source-program/range-policy';
import { recoveryContext, recoveryRows, recoveryView, warn } from './read';

/** Complete normalization precedes deduplication, global sorting, counting and paging. */
export async function recoverUnion(plan: UnionPlan, runner: QueryRunner, scope: string, signal: AbortSignal, complete: boolean) {
  const context = recoveryContext(plan.page.id, plan.id, signal);
  context.maxScan = complete ? EXPORT_MAX_ROWS : 100_000;
  const rows: Row[] = [];
  for (const member of [...plan.members].sort((left, right) => left.id < right.id ? -1 : 1)) {
    const input = await recoveryRows(member.query, runner, scope, context, member.member.source, complete ? EXPORT_MAX_ROWS : 100_000);
    const seen = new Set<unknown>();
    warn(context, member.member.source, '已按可用数据重新整理；异常单元格显示为空');
    for (const [index, raw] of input.entries()) {
      let row: Row;
      try {
        if (Object.values(raw).every(value => value === null)) throw new Error('空行');
        row = unionRow(plan, member, raw, index + 1);
      } catch {
        warn(context, member.member.source, '已跳过无效行或缺失行标识');
        continue;
      }
      const key = row[plan.data.source.rowKey];
      if (seen.has(key)) { warn(context, member.member.source, '重复行标识仅保留第一条'); continue; }
      seen.add(key); rows.push(row);
    }
  }
  return recoveryView(context, rows, plan.view, complete);
}
