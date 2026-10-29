import { canonicalizeJson, copyFieldFallback, selectQuerySource, tableHeaders, type EffectiveQuery, type Page, type PagedUnionDataSource, type PagedUnionMember, type QueryDataSource, type Row, type TableQueryView } from '@metriccanvas/page/internal';
import { composeEffectiveQuery } from '../effective-query';
import { filterTableRows, searchTableRows } from '../table-view';
import type { FilterValues } from '../filter-values';
import { describeExportSource } from '../source-program/export-diagnostics';
import { unionMemberKeyFields, validUnionKeyPart } from '@metriccanvas/page/internal';
import { createUnionUuid } from './generated-key';

export const unionError = (message: string, code = 'DQE_ROW_CONTRACT_ERROR') => Object.assign(new Error(message), { code });
export interface UnionMemberPlan { id: string; member: PagedUnionMember; input: QueryDataSource; query: EffectiveQuery; }
export interface UnionPlan { page: Page; id: string; data: PagedUnionDataSource; view: TableQueryView; members: UnionMemberPlan[]; key: string; }
export function unionKeyLabel(member: UnionMemberPlan): string {
  return unionMemberKeyFields(member.member).map(id => member.input.fields[id].label ?? '记录标识').join(' × ') || '临时行标识';
}
export function unionSortLabel(plan: UnionPlan): string {
  return plan.view.sort.map(rule => `“${plan.data.fields[rule.field].label ?? '排序字段'}”${rule.direction === 'desc' ? '从大到小' : '从小到大'}`).join('、');
}
/** Metadata and row positions only: never include the offending key or row contents. */
export function unionMemberError(plan: UnionPlan, member: UnionMemberPlan, message: string, code = 'DQE_ROW_CONTRACT_ERROR'): Error {
  const keyFields = unionMemberKeyFields(member.member);
  const queryField = keyFields.map(id => { const field = member.input.fields[id]; return 'queryField' in field ? field.queryField : id; }).join(',');
  const keyProperty = 'rowKeyGeneration' in member.member ? 'rowKeyGeneration' : 'rowKeyFields' in member.member ? 'rowKeyFields' : 'rowKey';
  const identity = keyFields.length ? `行键 ${keyFields.join(',')}（queryField=${queryField}）` : '行键由前端生成UUID';
  const pointer = [plan.id, 'source', 'members', member.id, keyProperty].map(part => part.replaceAll('~', '~0').replaceAll('/', '~1')).join('/');
  const title = describeExportSource(plan.page, plan.id).components.find(component => component.relation === 'direct' && component.componentTitle)?.componentTitle ?? plan.page.meta?.title ?? '当前表格';
  return unionError(`“${title}”无法合并数据。${message}\n技术定位：合并源 ${plan.id}，成员 ${member.id}，来源 ${member.member.source}，${identity}；配置 /dataSources/${pointer}`, code);
}
export function compileUnion(page: Page, id: string, conditions: FilterValues, input: TableQueryView, now?: Date): UnionPlan {
  const data = page.dataSources[id] as PagedUnionDataSource, view = structuredClone(input);
  if (!view.sort.length) view.sort = structuredClone(data.source.ordering.default);
  if (!Number.isSafeInteger(view.pageIndex) || view.pageIndex < 0 || view.pageSize < 1 || view.pageSize > 1000) throw unionError('合并分页范围无效', 'DQE_QUERY_REJECTED');
  for (const sort of view.sort) if (![...data.source.ordering.sortableFields, ...data.source.ordering.default.map(rule => rule.field)].includes(sort.field)) throw unionError('未声明的合并排序字段', 'DQE_QUERY_REJECTED');
  for (const predicate of view.predicates) if (!data.fields[predicate.field] || predicate.field === data.source.rowKey) throw unionError('未声明的合并筛选字段', 'DQE_QUERY_REJECTED');
  if (view.search?.fields.some(field => data.fields[field]?.type !== 'string' || field === data.source.rowKey)) throw unionError('合并搜索必须引用文本投影字段', 'DQE_QUERY_REJECTED');
  const members = Object.entries(data.source.members).flatMap(([memberId, member]) => {
    const selected = compileMember(page, data, memberId, member, view, conditions, now);
    return selected ? [selected] : [];
  });
  return { page, id, data, view, members, key: canonicalizeJson([id, [...conditions], view.sort, view.predicates, view.search ?? null, view.pageSize, members.map(m => m.query)]) };
}
function constants(data: PagedUnionDataSource, id: string, member: PagedUnionMember): Row {
  return Object.fromEntries([[data.source.sourceField, id], ...Object.entries(member.projection).flatMap(([field, projection]) => 'value' in projection ? [[field, projection.value]] : [])]);
}
function compileMember(page: Page, data: PagedUnionDataSource, id: string, member: PagedUnionMember, view: TableQueryView, conditions: FilterValues, now?: Date): UnionMemberPlan | undefined {
  const input = selectQuerySource(page.dataSources[member.source] as QueryDataSource, conditions);
  const literals = constants(data, id, member);
  const literalPredicates = view.predicates.filter(p => Object.hasOwn(literals, p.field));
  if (!filterTableRows([literals], literalPredicates).length) return;
  const predicates = view.predicates.filter(p => !Object.hasOwn(literals, p.field)).map(p => ({ ...p, field: mappedField(member, p.field) }));
  const sort = view.sort.filter(rule => !Object.hasOwn(literals, rule.field)).map(rule => ({ ...rule, field: mappedField(member, rule.field) }));
  const search = memberSearch(view, member, literals);
  if (search === false) return;
  const query = composeEffectiveQuery({ now, filters: page.filters, dataSource: input, pagination: { limit: 200 } }, conditions, 0, sort, tableHeaders(predicates), search);
  return { id, input, member, query };
}
function mappedField(member: PagedUnionMember, field: string): string {
  const projection = member.projection[field];
  if (!projection || !('field' in projection)) throw unionError('合并字段无法映射到来源', 'DQE_QUERY_REJECTED');
  return projection.field;
}
function memberSearch(view: TableQueryView, member: PagedUnionMember, literals: Row): TableQueryView['search'] | false {
  const search = view.search;
  if (!search?.query.trim() || searchTableRows([literals], search.fields, search.query, search.match).length) return undefined;
  const fields = search.fields.filter(field => !Object.hasOwn(literals, field)).map(field => mappedField(member, field));
  return fields.length ? { ...search, fields } : false;
}
export function unionRow(plan: UnionPlan, member: UnionMemberPlan, raw: Row, rowNumber: number): Row {
  const row: Row = Object.fromEntries([[plan.data.source.rowKey, memberRowIdentity(plan, member, raw, rowNumber)], [plan.data.source.sourceField, member.id],
    ...Object.entries(member.member.projection).map(([field, projection]) => [field, 'field' in projection ? raw[projection.field] : projection.value])]);
  for (const [field, projection] of Object.entries(member.member.projection)) {
    if ('field' in projection) copyFieldFallback(raw, projection.field, row, field);
  }
  return row;
}

function memberRowIdentity(plan: UnionPlan, member: UnionMemberPlan, raw: Row, rowNumber: number): string {
  if ('rowKeyGeneration' in member.member) return JSON.stringify([member.id, createUnionUuid()]);
  const values = unionMemberKeyFields(member.member).map(id => {
    const field = member.input.fields[id], value = raw[id];
    if (!validUnionKeyPart(value, field.type)) throw unionMemberError(plan, member, `查询返回的第 ${rowNumber} 条记录没有有效的“${field.label ?? '记录标识'}”。页面用这个字段区分每条记录，它必须是非空的${field.type === 'string' ? '文字' : '数字'}。请检查查询返回的数据。`);
    return value;
  });
  return JSON.stringify([member.id, 'rowKeyFields' in member.member ? values : values[0]]);
}
