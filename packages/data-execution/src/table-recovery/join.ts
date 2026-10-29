import { copyFieldFallback, projectSnapshotRows, validUnionKeyPart, type Row } from '@metriccanvas/page/internal';
import type { QueryRunner } from '../query-runner';
import type { PagedJoinPlan } from '../paged-join/plan';
import { executePagedJoin } from '../paged-join/execute';
import { exportPagedJoin } from '../paged-join/export';
import { memberQuery, restrictKeys } from '../paged-join/member-query';
import { memberKey } from '../paged-join/member-diagnostics';
import { filterRecordTimes, recordReadOrder } from '../paged-join/record-rows';
import { ordinalRows } from '../paged-join/rows';
import { recoveryContext, recoveryRows, recoveryView, warn, withTableRecovery, type RecoveryContext } from './read';

export function readRecoverableJoin(plan: PagedJoinPlan, runner: QueryRunner, scope: string, signal?: AbortSignal, complete = false, allowPartial = false) {
  return withTableRecovery(
    () => complete ? exportPagedJoin(plan, runner, scope, signal, allowPartial) : executePagedJoin(plan, runner, scope, signal),
    () => recoverJoin(plan, runner, scope, signal, complete), signal);
}
export async function recoverJoin(plan: PagedJoinPlan, runner: QueryRunner, scope: string, signal?: AbortSignal, complete = false) {
  const records = plan.source.source.records;
  const context = recoveryContext(plan.page.id, plan.sourceId, signal, records?.timeoutMs, records?.maxBytes);
  const domainId = plan.source.source.domainMember;
  const maxRows = records ? records.maxRows ?? 100_000 : plan.source.source.fallback.maxRows;
  const raw = await recoveryRows(recordReadOrder(plan, domainId, memberQuery(plan, domainId)), runner, scope, context, plan.source.source.members[domainId].source, maxRows);
  const domain = recoverDomain(plan, context, raw);
  const keys = [...new Set(domain.map((row, index) => memberKey(plan, domainId, row, index)))];
  const members = new Map<string, Map<string | number, Row>>();
  for (const id of plan.members.keys()) {
    if (id !== domainId) members.set(id, await recoverSupplement(plan, context, id, keys, runner, scope));
  }
  const rows = recoverProjection(plan, context, domain, members);
  const sort = [...plan.view.sort];
  if (!sort.some(rule => rule.field === plan.source.source.rowKey)) sort.push({ field: plan.source.source.rowKey, direction: 'asc' });
  const result = recoveryView(context, rows, { ...plan.view, sort }, complete);
  if (result.snapshot.status === 'ready') result.snapshot = projectSnapshotRows(result.snapshot,
    ordinalRows(plan, result.snapshot.rows, complete ? 0 : (result.viewCorrection?.pageIndex ?? plan.view.pageIndex) * plan.view.pageSize));
  return result;
}
function recoverDomain(plan: PagedJoinPlan, context: RecoveryContext, rows: Row[]): Row[] {
  const id = plan.source.source.domainMember, seen = new Set<string | number>();
  if (plan.source.source.records) filterRecordTimes(plan, [], true);
  return rows.filter((row, index) => {
    try {
      const key = memberKey(plan, id, row, index);
      if (!plan.source.source.records && seen.has(key)) { warn(context, plan.source.source.members[id].source, '重复行标识仅保留第一条'); return false; }
      seen.add(key);
      return !plan.source.source.records || filterRecordTimes(plan, [row], true).length > 0;
    } catch {
      warn(context, plan.source.source.members[id].source, '已跳过无效行标识或时间');
      return false;
    }
  });
}
async function recoverSupplement(plan: PagedJoinPlan, context: RecoveryContext, id: string, keys: (string | number)[], runner: QueryRunner, scope: string) {
  const index = new Map<string | number, Row>(), size = plan.source.source.records?.batchSize ?? 1000;
  const sourceId = plan.source.source.members[id].source;
  for (let offset = 0; offset < keys.length; offset += size) {
    const query = recordReadOrder(plan, id, memberQuery(plan, id));
    const allowed = restrictKeys(query, plan.source.source.members[id].key.queryField, keys.slice(offset, offset + size));
    if (!allowed.length) continue;
    const rows = await recoveryRows(query, runner, scope, context, sourceId, plan.source.source.records ? 100_000 : plan.source.source.fallback.maxRows);
    for (const [rowIndex, row] of rows.entries()) {
      let key: string | number;
      try { key = memberKey(plan, id, row, rowIndex); }
      catch { warn(context, sourceId, '已忽略无效的补充行标识'); continue; }
      if (!allowed.includes(key)) { warn(context, sourceId, '已忽略本次关联范围外的记录'); continue; }
      if (index.has(key)) { warn(context, sourceId, '重复关联标识仅保留第一条'); continue; }
      index.set(key, row);
    }
  }
  return index;
}
function recoverProjection(plan: PagedJoinPlan, context: RecoveryContext, domain: Row[], members: Map<string, Map<string | number, Row>>): Row[] {
  const source = plan.source.source, seen = new Set<unknown>(), rows: Row[] = [];
  warn(context, plan.sourceId, '已按可用数据重新整理；异常或缺失单元格显示为空');
  for (const [index, input] of domain.entries()) {
    const key = memberKey(plan, source.domainMember, input, index), row: Row = {};
    for (const [field, projection] of Object.entries(source.projection)) {
      const raw = projection.member === source.domainMember ? input : members.get(projection.member)?.get(key);
      row[field] = raw?.[projection.field] ?? null;
      copyFieldFallback(raw, projection.field, row, field);
    }
    if (source.records && !source.projection[source.rowKey]) row[source.rowKey] = String(index).padStart(12, '0');
    if (source.ordinalField) row[source.ordinalField] = 0;
    const identity = row[source.rowKey];
    if (!validUnionKeyPart(identity, plan.source.fields[source.rowKey].type) || seen.has(identity)) {
      warn(context, plan.sourceId, '已跳过无效或重复的结果行标识'); continue;
    }
    seen.add(identity); rows.push(row);
  }
  return rows;
}
