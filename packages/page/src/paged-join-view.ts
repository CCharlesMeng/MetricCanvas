import type { PagedJoinDataSource, PagedJoinSource } from './paged-join';
import type { TableQueryView } from './table/query-view';

/** Explicit opt-in: pageSize alone retains the historical execution contract. */
export function isPagedJoinQuery(source: { type: string }): source is PagedJoinSource & { pagination: { mode: 'query'; pageSize: number; batchSize: number } } {
  return source.type === 'pagedJoin' && 'pagination' in source &&
    typeof source.pagination === 'object' && source.pagination !== null &&
    'mode' in source.pagination && source.pagination.mode === 'query';
}

export function pagedJoinViewOwner(data: PagedJoinDataSource, view: TableQueryView): string {
  const owners = new Set<string | undefined>([...view.sort, ...view.predicates].map(rule => data.source.projection[rule.field]?.member));
  if (owners.has(undefined) || owners.size > 1) throw pagedJoinUnavailable('同一轮排序和过滤须来自同一个查询源');
  return [...owners][0] ?? data.source.domainMember;
}

export function pagedJoinUnavailable(message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code: 'DQE_QUERY_REJECTED' });
}

/** One transition is one commit; menu previews call this without changing the session. */
export function pagedJoinMemberView(data: PagedJoinDataSource, view: TableQueryView, field: string): TableQueryView {
  const owner = data.source.projection[field]?.member;
  if (!owner) throw pagedJoinUnavailable('操作字段没有查询来源');
  return { ...view, pageIndex: 0,
    sort: view.sort.filter(rule => data.source.projection[rule.field]?.member === owner),
    predicates: view.predicates.filter(rule => data.source.projection[rule.field]?.member === owner)
  };
}

export function pagedJoinCandidateView(data:PagedJoinDataSource,view:TableQueryView,field:string):TableQueryView{
  const next=pagedJoinMemberView(data,view,field);
  return {...next,sort:[],predicates:next.predicates.filter(rule=>rule.field!==field)};
}

export function reconcilePagedJoinView(data: PagedJoinDataSource, next: TableQueryView, field?: string): TableQueryView {
  let view = field ? pagedJoinMemberView(data, next, field) : structuredClone(next);
  if (!view.sort.length && !view.predicates.length) view = { ...view, sort: structuredClone(data.source.ordering.default) };
  const owner = pagedJoinViewOwner(data, view);
  if(view.predicates.some(rule=>rule.op==='isNull'))throw pagedJoinUnavailable('该列的为空条件尚无完整后端查询能力，不能用当前页代替全局过滤');
  if (!data.source.members[owner]?.canSelectPage) throw pagedJoinUnavailable('该查询源暂不支持完整行域的后端分页');
  if (data.source.records && owner !== data.source.domainMember) throw pagedJoinUnavailable('该列暂不支持按基准记录分页，请使用基准查询源的列');
  if (view.search?.query.trim()) throw pagedJoinUnavailable('组合查询分页暂不支持表格搜索');
  return view;
}
