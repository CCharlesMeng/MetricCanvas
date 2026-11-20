import { declaredPaginationLimit, hasQueryFieldMapping, type DimensionFilterDeclaration, type Page, type QueryDataSource } from '@metriccanvas/page/internal';
import type { FilterValues } from './filter-values';
import type { FilterCandidatesRequest } from './ports';

export type CompleteCandidateReason = 'complete-candidate-read' | 'not-a-flat-dropdown' | 'intersection-reconciliation' |
  'not-a-query-source' | 'complete-result-declared' | 'computed-source' | 'unsupported-query-shape' |
  'unsupported-value-field' | 'no-single-dimension-query-window';

type Window = {kind:'window';source:QueryDataSource; sourceId:string; field:string; limit:number};
type Plan = Window | {kind:'complete';reason:CompleteCandidateReason};

/** Read the paging declaration at its owner. Keep complete consumers on their existing path. */
export function inspectSourceCandidateWindow(page: Page, filter: DimensionFilterDeclaration):Plan {
  const spec = filter.candidates;
  if (!spec || spec.parentField || filter.hierarchy || filter.display && filter.display !== 'select') return complete('not-a-flat-dropdown');
  if (filter.candidateContext?.reconcile === 'intersection') return complete('intersection-reconciliation');
  const source = page.dataSources[spec.dataSource];
  if (!source || source.source.type !== 'query') return complete('not-a-query-source');
  if (source.source.resultScope === 'complete') return complete('complete-result-declared');
  if (source.compute?.length) return complete('computed-source');
  return candidateQueryWindow(source as QueryDataSource, spec);
}

function complete(reason:CompleteCandidateReason):Extract<Plan,{kind:'complete'}> {
  return {kind:'complete',reason};
}

export function sourceCandidateWindow(page:Page, filter:DimensionFilterDeclaration):Window|undefined {
  const plan = inspectSourceCandidateWindow(page,filter);
  return plan.kind === 'window' ? plan : undefined;
}

function candidateQueryWindow(source: QueryDataSource, spec: NonNullable<DimensionFilterDeclaration['candidates']>):Plan {
  const query = source.source.query;
  if (!query.body || query.timeModes || query.queryModes || query.resultBindings?.length || query.periodAggregation) return complete('unsupported-query-shape');
  const field = source.fields[spec.valueField];
  if (field?.type !== 'string' || field.role !== 'dimension' || !hasQueryFieldMapping(field) || spec.labelField && spec.labelField !== spec.valueField) return complete('unsupported-value-field');
  const limit = declaredPaginationLimit(query);
  const item = query.body.dsl_list[0];
  if (!item || !limit || !Number.isSafeInteger(limit) || !singleDimension(item, field.queryField)) return complete('no-single-dimension-query-window');
  return {kind:'window', source, sourceId:spec.dataSource, field:spec.valueField, limit};
}

export function withSourceCandidateSelection(page: Page | undefined, filter: DimensionFilterDeclaration, values: FilterValues, request: FilterCandidatesRequest): FilterCandidatesRequest {
  if (!page || !sourceCandidateWindow(page, filter)) return request;
  const selected = values.get(filter.id);
  return {...request, sourceRead:{kind:'selection', values:selected?.type === 'dimension' ? [...new Set(selected.values)].sort() : []}};
}

function singleDimension(item: Record<string, unknown>, field: string): boolean {
  const {output_dims: dimensions, output_metrics: metrics, order} = item;
  if (!Array.isArray(dimensions) || dimensions.length !== 1 || dimensions[0] !== field || !Array.isArray(metrics)) return false;
  if (!order || typeof order !== 'object' || Array.isArray(order)) return false;
  const window = order as Record<string, unknown>;
  return window.offset === 0 && window.order_by_field === field && /^(asc|desc)$/i.test(String(window.type));
}
