import { tableHeaders, type EffectiveQuery, type TablePredicate } from '@metriccanvas/page/internal';
import { composeEffectiveQuery } from '../effective-query';
import type { PagedJoinPlan } from './plan';

export function memberQuery(plan: PagedJoinPlan, id: string, pageIndex?: number): EffectiveQuery {
  const member = plan.source.source.members[id];
  const sort = pageIndex === undefined ? [] : plan.view.sort.map(rule => ({ ...rule, field: plan.source.source.projection[rule.field].field }));
  if (pageIndex !== undefined && !sort.some(rule => rule.field === member.key.field)) sort.push({ field: member.key.field, direction: 'asc' });
  const predicates: TablePredicate[] = pageIndex === undefined ? [] : plan.view.predicates.map(p => ({ ...p, field: plan.source.source.projection[p.field].field }));
  return composeEffectiveQuery({ dataSource: plan.members.get(id)!, ...(pageIndex === undefined ? {} : { pagination: { limit: plan.view.pageSize } }) }, plan.conditions, pageIndex ?? 0, sort, tableHeaders(predicates));
}
/** Explicit key intersection preserves static and page conditions. Empty never means unfiltered. */
export function restrictKeys(query: EffectiveQuery, queryField: string, keys: readonly (string | number)[]): (string | number)[] {
  let allowed = [...keys];
  const item = query.body.dsl_list[0];
  const filter = item.filter as { dims?: Array<{ dim_name?: string; dim_value_list?: unknown; operator?:unknown }> } | undefined;
  for (const entry of filter?.dims ?? []) if (entry.dim_name === queryField) {
    if (entry.operator!==undefined || !Array.isArray(entry.dim_value_list)) throw Object.assign(new Error('编码静态条件无法安全求交集'), { code: 'DQE_QUERY_REJECTED' });
    const values = entry.dim_value_list;
    if (values.length) allowed = allowed.filter(key => values.includes(key));
  }
  for (const value of query.filterValues) if (value.target === 'dimension' && value.queryField === queryField && value.values.length) allowed = allowed.filter(key => value.values.includes(key));
  query.filterValues = query.filterValues.filter(value => value.target !== 'dimension' || value.queryField !== queryField);
  if (allowed.length) query.filterValues.push({ target: 'dimension', queryField, values: allowed });
  return allowed;
}
