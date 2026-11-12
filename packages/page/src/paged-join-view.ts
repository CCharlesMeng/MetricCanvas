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
  const searchOwner = pagedJoinSearchOwner(data, view);
  if (searchOwner) owners.add(searchOwner);
  if (owners.has(undefined) || owners.size > 1) throw pagedJoinUnavailable('同一轮排序和过滤须来自同一个查询源');
  return [...owners][0] ?? data.source.domainMember;
}

/** Search is a single-member operation, just like query-page sorting and filtering. */
export function pagedJoinSearchOwner(data: PagedJoinDataSource, view: TableQueryView): string | undefined {
  if (!view.search?.query.trim()) return undefined;
  const owners = new Set<string | undefined>(view.search.fields.map(field => data.source.projection[field]?.member));
  if (view.search.data && view.search.data !== 'main') throw pagedJoinUnavailable('组合搜索须引用最终表格字段');
  if (owners.has(undefined) || owners.size !== 1) throw pagedJoinUnavailable('搜索字段须来自同一个查询源');
  return [...owners][0];
}

export function pagedJoinPausedFields(data: PagedJoinDataSource, view: TableQueryView): string[] {
  const owner = pagedJoinSearchOwner(data, view);
  return owner ? Object.keys(data.source.projection).filter(field => data.source.projection[field].member !== owner) : [];
}

function searchMemberView(data: PagedJoinDataSource, next: TableQueryView, field?: string, previous?: TableQueryView): TableQueryView {
  const owner = pagedJoinSearchOwner(data, next);
  if (owner) {
    if (field && data.source.projection[field]?.member !== owner) throw pagedJoinUnavailable('搜索期间暂停其他来源的排序与筛选，请先清空搜索');
    return { ...next, sort: next.sort.filter(rule => data.source.projection[rule.field]?.member === owner),
      predicates: next.predicates.filter(rule => data.source.projection[rule.field]?.member === owner) };
  }
  if (previous?.search?.query.trim()) return { ...next, sort: structuredClone(data.source.ordering.default), predicates: [], pageIndex: 0 };
  return next;
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
  const next=pagedJoinMemberView(data,searchMemberView(data,view,field),field);
  return {...next,sort:[],predicates:next.predicates.filter(rule=>rule.field!==field)};
}

export function reconcilePagedJoinView(data: PagedJoinDataSource, next: TableQueryView, field?: string, previous?: TableQueryView): TableQueryView {
  const searched = searchMemberView(data, next, field, previous);
  let view = field ? pagedJoinMemberView(data, searched, field) : structuredClone(searched);
  if (!view.sort.length && !view.predicates.length && !view.search?.query.trim()) view = { ...view, sort: structuredClone(data.source.ordering.default) };
  const owner = pagedJoinViewOwner(data, view);
  if(view.predicates.some(rule=>rule.op==='isNull'))throw pagedJoinUnavailable('该列的为空条件尚无完整后端查询能力，不能用当前页代替全局过滤');
  if (!data.source.members[owner]?.canSelectPage) throw pagedJoinUnavailable('该查询源暂不支持完整行域的后端分页');
  if (data.source.records && owner !== data.source.domainMember) throw pagedJoinUnavailable('该列暂不支持按基准记录分页，请使用基准查询源的列');
  return view;
}
