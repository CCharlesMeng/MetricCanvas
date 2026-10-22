import {ordinaryQuery} from './time-mode';
import { queryResultWhereErrors } from './query-result-where';
import type { Page } from './page';
import type { TypedError } from './errors';
import { hasQueryFieldMapping } from './field';
import { bindingQueryFields, type PageQuery, type QueryResultBinding } from './query';
import type { QuerySource } from './data-source';
import { computeDependencies } from './compute';
import { queryResultDependencies, isBoundedResultSource } from './query-dependencies';
import { flattenPageComponents } from './component-walk';

export function queryResultBindingErrors(page: Page): TypedError[] {
  const errors: TypedError[] = [];
  const fail = (path: string, message: string) => errors.push({ type: 'SCHEMA_ERROR', path, message });
  const paged = new Set(flattenPageComponents(page).flatMap(component =>
    component.type === 'table' && component.props.pagination?.mode === 'query' ? [component.data.main] : []));
  for (const [id, source] of Object.entries(page.dataSources)) {
    if (source.source.type !== 'query') continue;
    const query = source.source.query;
    const targets = occupiedDimensionTargets(query);
    for (const [index, binding] of (query.resultBindings ?? []).entries()) {
      const path = `/dataSources/${id}/source/query/resultBindings/${index}`;
      const upstream = page.dataSources[binding.source];
      checkUpstream(binding, path);
      if (binding.where) errors.push(...queryResultWhereErrors(binding.where, upstream?.fields ?? {}, `${path}/where`));
      if (targets.has(binding.queryField)) fail(`${path}/queryField`, '结果输入与已有维度条件重复');
      targets.add(binding.queryField);
    }
  }
  function checkUpstream(binding: QueryResultBinding, path: string): void {
    const upstream = page.dataSources[binding.source];
    const field = upstream?.fields[binding.field];
    if (!upstream || upstream.source.type !== 'query' || !field || !hasQueryFieldMapping(field) ||
      field.role !== 'dimension' || !['string', 'number'].includes(field.type)) {
      fail(path, '结果输入必须引用查询源的原始string或number维度字段');
      return;
    }
    const window = paged.has(binding.source);
    if (invalidInputRange(upstream.source, window, binding.source)) {
      fail(path, '结果输入要求完整查询、显式有限选择或声明正整数limit的查询分页窗口；分页窗口不能声明complete');
    }
    if ((window || isBoundedResultSource(page.dataSources, binding.source)) && (upstream.compute ?? []).some(op =>
      ['grandTotal', 'groupSubtotal', 'timeFill'].includes(op.op))) fail(path, '有限选择源不能作为全量统计输入');
  }
  function invalidInputRange(source: QuerySource, window: boolean, id: string): boolean {
    const order = ordinaryQuery(source.query).body.dsl_list[0].order;
    const limit = orderRecord(order) ? order.limit : undefined;
    const invalidOffset = orderRecord(order) && (window ? order.offset !== 0 : 'offset' in order);
    return invalidOffset || (window
      ? source.resultScope === 'complete' || !Number.isSafeInteger(limit) || Number(limit) <= 0
      : !isBoundedResultSource(page.dataSources, id) && source.resultScope !== 'complete');
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string, stage: 'query' | 'compute') {
    const key = `${stage}:${id}`;
    if (visiting.has(key)) { fail(`/dataSources/${id}`, '查询或计算阶段依赖成环'); return; }
    if (visited.has(key) || !Object.hasOwn(page.dataSources, id)) return;
    visiting.add(key);
    const source = page.dataSources[id];
    if (stage === 'compute') {
      visit(id, 'query');
      for (const dependency of computeDependencies(source.compute ?? [])) visit(dependency, 'compute');
    } else for (const dependency of queryResultDependencies(source)) visit(dependency, 'query');
    visiting.delete(key); visited.add(key);
  }
  for (const id of Object.keys(page.dataSources)) visit(id, 'compute');
  return errors;
}

function orderRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function occupiedDimensionTargets(query: PageQuery): Set<string> {
  const filter = ordinaryQuery(query).body.dsl_list[0].filter;
  const staticDims = filter && typeof filter === 'object' && !Array.isArray(filter) ? filter.dims : undefined;
  return new Set([
    ...Object.values(query.filterBindings ?? {}).flatMap(bindingQueryFields),
    ...Object.values(query.paramBindings ?? {}).flatMap(binding => binding.target === 'dimension' ? [binding.queryField] : []),
    ...(Array.isArray(staticDims) ? staticDims.flatMap(dim => dim && typeof dim === 'object' && !Array.isArray(dim) && typeof dim.dim_name === 'string' ? [dim.dim_name] : []) : [])
  ]);
}
