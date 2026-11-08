import type { Page } from './page';
import type { QueryDataSource } from './data-source';
import type { TypedError } from './errors';
import type { DqeQueryDefinition } from './query';
import { hasQueryFieldMapping } from './field';
import { flattenPageComponents } from './component-walk';
import { isObjectDqeItem } from './dqe-object';

function issue(path: string, message: string): TypedError {
  return { type: 'SCHEMA_ERROR', path, message };
}
function queryErrors(page: Page, query: DqeQueryDefinition, path: string): TypedError[] {
  const errors: TypedError[] = [];
  const id = query.periodAggregation!.filterId;
  const filter = page.filters?.find(filter => filter.id === id);
  if (filter?.type !== 'timeRange' || filter.display !== 'period' || !filter.required) {
    errors.push(issue(path + '/filterId', '期间聚合必须引用 required 的 display=period 时间筛选'));
  } else if (filter.periodModes && !filter.periodModes.includes('last12Months')) {
    errors.push(issue(path + '/filterId', '期间聚合筛选必须支持近一年'));
  }
  const binding = query.filterBindings?.[id];
  if (binding?.target !== 'time') return [...errors, issue(path + '/filterId', '期间聚合必须绑定同一个时间筛选')];
  if (binding.queryField || binding.window || binding.periodComparison) errors.push(issue(path, '期间聚合不能叠加自定义时间字段、window 或 periodComparison'));
  if (!supportsMonth(binding.periodPolicy)) errors.push(issue(path, '期间聚合查询策略必须支持 month 粒度'));
  if (Object.values(query.filterBindings ?? {}).filter(binding => binding.target === 'time').length !== 1) errors.push(issue(path, '期间聚合只能消费一个时间范围'));
  return errors;
}
function supportsMonth(policy: import('./period-query').PeriodQueryPolicy | undefined): boolean {
  if (!policy) return true;
  return policy.kind === 'fixed' ? policy.period === 'month' : policy.supportedPeriods.includes('month');
}
function fieldErrors(source: QueryDataSource, path: string): TypedError[] {
  const errors: TypedError[] = [];
  const config = source.source.query.periodAggregation!.cases.last12Months;
  const fields = new Set(config.groupBy);
  for (const [index, id] of config.groupBy.entries()) {
    const field = source.fields[id];
    if (!field || field.role !== 'dimension' || !hasQueryFieldMapping(field)) errors.push(issue(`${path}/groupBy/${index}`, 'groupBy 必须引用当前查询的维度字段'));
  }
  for (const [index, entry] of config.aggregations.entries()) {
    const field = source.fields[entry.field];
    const location = `${path}/aggregations/${index}/field`;
    if (fields.has(entry.field)) errors.push(issue(location, '聚合字段不能重复或同时作为分组字段'));
    fields.add(entry.field);
    if (!field || field.role !== 'measure' || !['number', 'money'].includes(field.type) || !hasQueryFieldMapping(field)) errors.push(issue(location, '聚合必须引用当前查询的数值度量字段'));
  }
  for (const [id, field] of Object.entries(source.fields)) {
    if (hasQueryFieldMapping(field) && !fields.has(id)) errors.push(issue(path, `期间聚合必须明确处理全部查询输出字段:${id}`));
  }
  return errors;
}
function sourceErrors(page: Page, id: string, source: QueryDataSource): TypedError[] {
  const query = source.source.query;
  const path = `/dataSources/${id.replaceAll('~', '~0').replaceAll('/', '~1')}/source/query/periodAggregation`;
  if (!query.body || query.timeModes || query.queryModes) return [issue(path, '期间聚合首版只支持普通指标查询，不与模式查询叠加')];
  const errors = [...queryErrors(page, query, path), ...fieldErrors(source, path + '/cases/last12Months')];
  if (source.source.resultScope !== 'complete') errors.push(issue(path, '期间聚合需要 resultScope: complete 的完整月度结果'));
  if (source.source.initial) errors.push(issue(path, '期间聚合不接受缺少聚合口径证明的 initial'));
  const item = query.body.dsl_list[0];
  if (isObjectDqeItem(item)) errors.push(issue(path, '期间聚合只支持指标查询'));
  const order = item.order as Record<string, unknown> | undefined;
  if (order && ('limit' in order || 'offset' in order)) errors.push(issue(path, '期间聚合查询不能携带明细窗口，请在完整聚合结果上分页'));
  const filter = item.filter as { metrics?: unknown[] } | undefined;
  if (filter?.metrics?.length) errors.push(issue(path, '期间聚合不接受静态指标阈值，请使用聚合后的表头筛选'));
  return errors;
}
function consumerErrors(page: Page, ids: Set<string>): TypedError[] {
  const errors: TypedError[] = [];
  for (const component of flattenPageComponents(page)) {
    if (component.type === 'table' && ids.has(component.data.main) && component.props.pagination?.mode === 'query') {
      errors.push(issue(`/dataSources/${component.data.main}/source/query/periodAggregation`, '期间聚合表格使用完整结果的本地分页，不能先按月度明细选页'));
    }
  }
  for (const [id, data] of Object.entries(page.dataSources)) {
    if (data.source.type !== 'pagedJoin' && data.source.type !== 'pagedUnion') continue;
    if (Object.values(data.source.members).some(member => ids.has(member.source))) errors.push(issue(`/dataSources/${id}/source/members`, '期间聚合源首版不作为分页组合查询成员'));
  }
  return errors;
}
export function periodAggregationErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [], ids = new Set<string>();
  for (const [id, data] of Object.entries(page.dataSources)) {
    if (data.source.type !== 'query' || !data.source.query.periodAggregation) continue;
    ids.add(id);
    errors.push(...sourceErrors(page, id, data as QueryDataSource));
  }
  return [...errors, ...consumerErrors(page, ids)];
}
