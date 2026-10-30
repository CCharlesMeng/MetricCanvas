import { restoreCellFallbacks, copyRowFallbacks, copyFieldFallback } from '@metriccanvas/page/internal';
import { queryResultFieldContract, validateContractRows, type FieldDefinition, type DataSnapshot, type Row } from '@metriccanvas/page/internal';
import type { PagedJoinPlan } from './plan';
import {memberFailure,memberKey,memberKeyLabel} from './member-diagnostics';
export const rowFailure = (message: string) => Object.assign(new Error(message), { code: 'DQE_ROW_CONTRACT_ERROR' });
const queryResultFields = (fields: Record<string, FieldDefinition>) => Object.fromEntries(
  Object.entries(fields).map(([id, field]) => [id, queryResultFieldContract(field)])
);
export function memberRows(plan: PagedJoinPlan, id: string, result: DataSnapshot, keys?: readonly (string | number)[], window?: { offset: number; limit: number }): Map<string | number, Row> {
  try {
    if (result.status === 'error') throw Object.assign(new Error(result.error.message), { code: result.error.code });
    if (result.status === 'loading') throw rowFailure('查询尚未完成，请等待查询返回后重试。');
    const rows = result.status === 'ready' ? result.rows : [], total = result.totalCount;
    if (result.status === 'ready') restoreCellFallbacks(rows, result.cellFallbacks);
    assertMemberRange(rows.length, total, (plan.source.source.fallback?.maxRows ?? 1000), window);
    const validation=validateContractRows(rows, queryResultFields(plan.members.get(id)!.fields));
    if (!validation.ok) throw rowFailure(`查询返回的数据格式不符合页面要求。请检查下面列出的字段。\n字段检查：${JSON.stringify(validation.issues[0])}`);
    return indexMemberRows(plan,id,rows,keys);
  } catch(cause) {throw memberFailure(plan,id,cause);}
}

function indexMemberRows(plan:PagedJoinPlan,id:string,rows:Row[],keys?:readonly (string|number)[]):Map<string|number,Row> {
  const result=new Map<string|number,Row>(),positions=new Map<string|number,number>(),label=memberKeyLabel(plan,id);
  for(const [index,row] of rows.entries()) {
    const key=memberKey(plan,id,row,index);
    if(result.has(key))throw rowFailure(`第 ${index+1} 行与第 ${positions.get(key)!+1} 行的“${label}”重复，无法确定该使用哪条记录。请检查查询是否为每个编号只返回一条记录。`);
    if(keys && !keys.includes(key))throw rowFailure(`第 ${index+1} 行的“${label}”不在本次要查询的编号中。请检查补充查询是否正确应用了编号筛选。`);
    positions.set(key,index);result.set(key,row);
  }
  return result;
}

export function projectRows(plan: PagedJoinPlan, keys: readonly (string | number)[], members: ReadonlyMap<string, Map<string | number, Row>>): Row[] {
  const domain = members.get(plan.source.source.domainMember)!;
  const rows = keys.map(key => {
    if (!domain.has(key)) throw rowFailure('选页编码不在业务行域');
    const row: Row = {};
    for (const [field, projection] of Object.entries(plan.source.source.projection)) {
      const source = members.get(projection.member)?.get(key);
      row[field] = source?.[projection.field] ?? null;
      copyFieldFallback(source, projection.field, row, field);
    }
    if (plan.source.source.ordinalField) row[plan.source.source.ordinalField] = 0;
    return row;
  });
  if (!validateContractRows(rows, queryResultFields(plan.source.fields)).ok) throw rowFailure('最终投影违反字段契约');
  return rows;
}
export function ordinalRows(plan: PagedJoinPlan, rows: Row[], offset: number): Row[] {
  const ordinal = plan.source.source.ordinalField;
  return ordinal ? rows.map((row, index) => copyRowFallbacks(row, { ...row, [ordinal]: offset + index + 1 })) : rows;
}

function assertMemberRange(count: number, total: number | undefined, maxRows: number, window?: { offset: number; limit: number }): void {
  const facts=`返回 ${count} 行，totalCount=${total}，maxRows=${maxRows}`;
  if (total !== undefined && (!Number.isSafeInteger(total) || total < count)) throw rowFailure(`查询返回的总行数不正确。请检查上游返回的总行数。\n数量检查：${facts}`);
  if (!window && (count > maxRows || (total !== undefined && total > maxRows))) throw Object.assign(new Error(`需要合并的数据超过本页允许的 ${maxRows} 行。请缩小筛选范围。\n数量检查：${facts}`), { code: 'DQE_QUERY_REJECTED' });
  if (window) {
    if (total === undefined || count !== Math.min(window.limit, Math.max(0, total - window.offset))) throw rowFailure(`当前页没有收到完整数据或有效总行数。请检查查询分页结果。\n数量检查：${facts}，offset=${window.offset}，limit=${window.limit}`);
  } else if (total !== undefined && total !== count) throw rowFailure(`只收到 ${count} 行数据，但查询报告共有 ${total} 行，无法完整合并。请检查查询是否被截断。\n数量检查：${facts}`);
}
