import { canonicalizeJson, copyFieldFallback, selectQuerySource, tableHeaders, type EffectiveQuery, type Page, type PagedUnionDataSource, type PagedUnionMember, type QueryDataSource, type Row, type TableQueryView } from '@metriccanvas/page/internal';
import { composeEffectiveQuery } from '../effective-query';
import { filterTableRows, searchTableRows } from '../table-view';
import type { FilterValues } from '../filter-values';

export const unionError = (message: string, code = 'DQE_ROW_CONTRACT_ERROR') => Object.assign(new Error(message), { code });
export interface UnionMemberPlan { id: string; member: PagedUnionMember; input: QueryDataSource; query: EffectiveQuery; }
export interface UnionPlan { page: Page; id: string; data: PagedUnionDataSource; view: TableQueryView; members: UnionMemberPlan[]; key: string; }
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
export function unionRow(plan: UnionPlan, member: UnionMemberPlan, raw: Row): Row {
  const key = raw[member.member.rowKey];
  const keyType = member.input.fields[member.member.rowKey].type;
  if (typeof key !== keyType || (typeof key === 'string' && !key.trim()) || (typeof key === 'number' && !Number.isFinite(key))) throw unionError('来源内行键缺失或类型错误');
  const row: Row = Object.fromEntries([[plan.data.source.rowKey, JSON.stringify([member.id, key])], [plan.data.source.sourceField, member.id],
    ...Object.entries(member.member.projection).map(([field, projection]) => [field, 'field' in projection ? raw[projection.field] : projection.value])]);
  for (const [field, projection] of Object.entries(member.member.projection)) {
    if ('field' in projection) copyFieldFallback(raw, projection.field, row, field);
  }
  return row;
}
