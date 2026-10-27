import { dqeDimensionConditions, isObjectDqeItem, tableHeaders, type EffectiveQuery, type TablePredicate } from '@metriccanvas/page/internal';
import { composeEffectiveQuery, bindQueryResultValues } from '../effective-query';
import type { PagedJoinPlan } from './plan';

export function memberQuery(plan: PagedJoinPlan, id: string, pageIndex?: number): EffectiveQuery {
  const sort = pageIndex === undefined ? [] : plan.view.sort.map(rule => ({ ...rule, field: plan.source.source.projection[rule.field].field }));
  const predicates: TablePredicate[] = pageIndex === undefined ? [] : plan.view.predicates.map(p => ({ ...p, field: plan.source.source.projection[p.field].field }));
  return composeEffectiveQuery({ now:plan.now,filters:plan.page.filters, dataSource: plan.members.get(id)!, ...(pageIndex === undefined ? {} : { pagination: { limit: plan.view.pageSize } }) }, plan.conditions, pageIndex ?? 0, sort, tableHeaders(predicates));
}
/** Explicit key intersection preserves static and page conditions. Empty never means unfiltered. */
export function restrictKeys(query: EffectiveQuery, queryField: string, keys: readonly (string | number)[]): (string | number)[] {
  let allowed = [...keys];
  const item = query.body.dsl_list[0];
  for (const entry of dqeDimensionConditions(item)) if (entry.dim_name === queryField) {
    assertKeyCondition(entry,isObjectDqeItem(item));
    const values=entry.dim_value_list as unknown[];
    if (values.length) allowed=allowed.filter(key=>values.includes(key));
  }
  for (const value of query.filterValues) if (value.target === 'dimension' && value.queryField === queryField && value.values.length) allowed = allowed.filter(key => value.values.includes(key));
  if (allowed.length) bindQueryResultValues(query, [{ target: 'dimension', queryField, values: allowed }]);
  return allowed;
}

function assertKeyCondition(entry: import('@metriccanvas/page/internal').JsonObject, object: boolean): void {
  const validOperator=entry.operator===undefined || (object && entry.operator==='=');
  if(!validOperator || !Array.isArray(entry.dim_value_list) || (object && entry.is_exclude===true)) throw Object.assign(new Error('编码静态条件无法安全求交集'),{code:'DQE_QUERY_REJECTED'});
}
