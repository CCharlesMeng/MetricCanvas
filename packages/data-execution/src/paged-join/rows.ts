import { validateContractRows, type DataSnapshot, type Row } from '@metriccanvas/page/internal';
import type { PagedJoinPlan } from './plan';
export const rowFailure = (message: string) => Object.assign(new Error(message), { code: 'DQE_ROW_CONTRACT_ERROR' });
export function memberRows(plan: PagedJoinPlan, id: string, result: DataSnapshot, keys?: readonly (string | number)[], window?: { offset: number; limit: number }): Map<string | number, Row> {
  if (result.status === 'error') throw Object.assign(new Error(result.error.message), { code: result.error.code });
  if (result.status === 'loading') throw rowFailure('成员结果尚未完成');
  const rows = result.status === 'ready' ? result.rows : [], total = result.totalCount;
  if (total !== undefined && (!Number.isSafeInteger(total) || total < rows.length)) throw rowFailure('成员总数不合法');
  if (!window && (rows.length > plan.source.source.fallback.maxRows || (total !== undefined && total > plan.source.source.fallback.maxRows))) throw Object.assign(new Error('完整关联范围超过声明上限'), { code: 'DQE_QUERY_REJECTED' });
  if (window) {
    if (total === undefined || rows.length !== Math.min(window.limit, Math.max(0, total - window.offset))) throw rowFailure('选页结果缺少完整窗口或总数');
  } else if (total !== undefined && total !== rows.length) throw rowFailure('完整补列结果被截断');
  if (!validateContractRows(rows, plan.members.get(id)!.fields).ok) throw rowFailure('成员结果违反原始字段契约');
  const member = plan.source.source.members[id], type = plan.members.get(id)!.fields[member.key.field].type;
  const resultRows = new Map<string | number, Row>();
  for (const row of rows) {
    const key = row[member.key.field];
    if ((typeof key !== 'string' && typeof key !== 'number') || typeof key !== type || (typeof key === 'string' ? !key.trim() : !Number.isFinite(key))) throw rowFailure('成员行键缺失或类型错误');
    if (resultRows.has(key) || (keys && !keys.includes(key))) throw rowFailure('成员返回重复键或未请求编码');
    resultRows.set(key, row);
  }
  return resultRows;
}
export function projectRows(plan: PagedJoinPlan, keys: readonly (string | number)[], members: ReadonlyMap<string, Map<string | number, Row>>): Row[] {
  const domain = members.get(plan.source.source.domainMember)!;
  const rows = keys.map(key => {
    if (!domain.has(key)) throw rowFailure('选页编码不在业务行域');
    const row: Row = {};
    for (const [field, projection] of Object.entries(plan.source.source.projection)) row[field] = members.get(projection.member)?.get(key)?.[projection.field] ?? null;
    if (plan.source.source.ordinalField) row[plan.source.source.ordinalField] = 0;
    return row;
  });
  if (!validateContractRows(rows, plan.source.fields).ok) throw rowFailure('最终投影违反字段契约');
  return rows;
}
export function ordinalRows(plan: PagedJoinPlan, rows: Row[], offset: number): Row[] {
  const ordinal = plan.source.source.ordinalField;
  return ordinal ? rows.map((row, index) => ({ ...row, [ordinal]: offset + index + 1 })) : rows;
}
