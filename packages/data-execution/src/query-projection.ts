import { aiSummaryRelatedData, activePageComponents, flattenPageComponents, hasColumnConditions, hasPeriodComparison, hasQueryFieldMapping, type Component, type ConditionContext, type DataSource, type DqeQueryDefinition, type EffectiveQuery, type Page, type QueryDataSource, type TabSelections, type TableQueryView } from '@metriccanvas/page/internal';
import { chartPresentation } from './chart-presentation';
import { tableColumnPresentation } from './table-presentation';
import { projectComputeDemand, referencedStrings as strings } from './compute-demand';

function conditionalProjection(page: Page, component: Component, context: ConditionContext): Component | undefined {
  if (component.type === 'table') return tableColumnPresentation(page, component, context).component;
  if (component.type === 'barChart' || component.type === 'lineChart') return chartPresentation(page, component, context);
}

function hasConditionalFields(component: Component): boolean {
  if (component.type === 'table') return hasColumnConditions(component.props.columns);
  return (component.type === 'barChart' || component.type === 'lineChart') && component.props.series.some(series => series.visibleWhen !== undefined);
}

function protectedQueryNames(source: QueryDataSource, required: ReadonlySet<string>, business: unknown): Set<string> {
  const query = source.source.query;
  const names = strings({business,filterBindings:query.filterBindings,paramBindings:query.paramBindings});
  for (const [id, field] of Object.entries(source.fields)) if (required.has(id) && hasQueryFieldMapping(field)) names.add(field.queryField);
  return names;
}

function complexDimensions(value: unknown): boolean {
  return Array.isArray(value) && value.some(dimension => typeof dimension !== 'string');
}

function requiresWholeQuery(query: DqeQueryDefinition): boolean {
  return Boolean(query.queryModes || query.timeModes || query.periodAggregation || hasPeriodComparison(query));
}

/** Only independent metric outputs are removable. Dimensions always preserve query grain. */
function projectQuery(source: DataSource, required: ReadonlySet<string>): DataSource {
  if (source.source.type !== 'query' || source.compute?.length) return source;
  const query = source.source.query;
  if (requiresWholeQuery(query) || !query.body || query.body.dsl_list.length !== 1) return source;
  const item = query.body.dsl_list[0];
  if (!Array.isArray(item.output_metrics)) return source;
  const { output_metrics: metrics, ...business } = item;
  if (metrics.some(metric => typeof metric !== 'string') || complexDimensions(item.output_dims)) return source;
  const protectedNames = protectedQueryNames(source as QueryDataSource,required,business);
  const removable = new Map(Object.entries(source.fields).flatMap(([id, field]) =>
    hasQueryFieldMapping(field) && !required.has(id) && !protectedNames.has(field.queryField) ? [[field.queryField, id] as const] : []));
  const removed = new Set(metrics.filter((metric): metric is string => typeof metric === 'string' && removable.has(metric)));
  if (!removed.size) return source;
  // Unknown/formula output shapes remain intact. Never leave an invalid empty projection.
  const outputs = metrics.filter(metric => typeof metric !== 'string' || !removed.has(metric));
  if (!outputs.length && (!Array.isArray(item.output_dims) || item.output_dims.length === 0)) return source;
  const fields = Object.fromEntries(Object.entries(source.fields).filter(([, field]) => !hasQueryFieldMapping(field) || !removed.has(field.queryField)));
  return { ...source, fields, source: { ...source.source, query: { ...query, body: { ...query.body, dsl_list: [{ ...item, output_metrics: outputs }] } } } } as QueryDataSource;
}

/** Union all consumers before narrowing a shared query; explicit execution dependencies stay full. */
export interface QueryDemandOptions { selections?: TabSelections; views?: ReadonlyMap<string, TableQueryView>; roots?: readonly string[]; presentation?: Pick<Page, 'sections' | 'detailViews'> }
export function presentationQuerySources(page: Page, context: ConditionContext, options: QueryDemandOptions = {}): Map<string, DataSource> {
  const full = new Set<string>();
  const required = new Map<string, Set<string>>();
  const metrics = new Set<string>();
  const consumerPage = options.presentation ? { ...page, ...options.presentation } : page;
  const components = options.selections ? activePageComponents(consumerPage, options.selections) : flattenPageComponents({ sections: consumerPage.sections, detailViews: consumerPage.detailViews?.filter(view => view.mode === 'snapshot') });
  for (const component of components) {
    const projected = conditionalProjection(page, component, context);
    if (hasConditionalFields(component)) Object.values(projected?.data ?? {}).forEach(id => metrics.add(id));
    if (!projected) Object.values(component.data ?? {}).forEach(id => full.add(id));
    else for (const id of Object.values(projected.data ?? {})) {
      const fields = required.get(id) ?? new Set<string>();
      strings(projected.props).forEach(value => fields.add(value));
      required.set(id, fields);
    }
    if (component.type === 'aiSummary') Object.values(aiSummaryRelatedData(page, component.props, {}, component.id)).forEach(value => full.add(value.source));
  }
  const sources = new Map(Object.entries(page.dataSources));
  let projected = projectComputeDemand(sources, required, full, options.views);
  const explicit = (options.roots ?? []).filter(root => !projected.required.has(root));
  if (explicit.length) {
    explicit.forEach(root => full.add(root));
    projected = projectComputeDemand(sources, required, full, options.views);
  }
  return new Map([...projected.sources].map(([id, source]) => [id, projected.full.has(id) || !metrics.has(id) ? source : projectQuery(source, projected.required.get(id)!)]));
}

/** Frozen exports keep captured predicates/windows and apply the same metric projection. */
export function projectCapturedQuery(query: EffectiveQuery | undefined, source: QueryDataSource): EffectiveQuery | undefined {
  if (!query || Object.keys(query.fieldMappings).length === Object.keys(source.fields).length && Object.keys(source.fields).every(id => id in query.fieldMappings)) return query;
  const metrics = source.source.query.body?.dsl_list[0]?.output_metrics;
  if (!Array.isArray(metrics)) return query;
  const allowed = new Set(metrics.filter(metric => typeof metric === 'string'));
  const body = structuredClone(query.body);
  for (const item of body.dsl_list) if (Array.isArray(item.output_metrics)) item.output_metrics = item.output_metrics.filter(metric => typeof metric !== 'string' || allowed.has(metric));
  return { ...query, body, fieldMappings: source.fields };
}
