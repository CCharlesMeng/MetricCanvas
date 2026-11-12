import { aiSummaryRelatedData, definitionSourceIds, flattenPageComponents, hasColumnConditions, hasPeriodComparison, hasQueryFieldMapping, resultSourceIds, type Component, type ConditionContext, type DataSource, type DqeQueryDefinition, type EffectiveQuery, type Page, type QueryDataSource } from '@metriccanvas/page/internal';
import { chartPresentation } from './chart-presentation';
import { tableColumnPresentation } from './table-presentation';

function conditionalProjection(page: Page, component: Component, context: ConditionContext): Component | undefined {
  if (component.type === 'table' && hasColumnConditions(component.props.columns)) return tableColumnPresentation(page, component, context).component;
  if ((component.type === 'barChart' || component.type === 'lineChart') && component.props.series.some(series => series.visibleWhen)) return chartPresentation(page, component, context);
}

function strings(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === 'string') found.add(value);
  else if (Array.isArray(value)) value.forEach(item => strings(item, found));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => strings(item, found));
  return found;
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
export function presentationQuerySources(page: Page, context: ConditionContext): Map<string, DataSource> {
  const full = new Set<string>();
  const required = new Map<string, Set<string>>();
  for (const source of Object.values(page.dataSources)) [...resultSourceIds(source), ...definitionSourceIds(source)].forEach(id => full.add(id));
  const components = flattenPageComponents({ sections: page.sections, detailViews: page.detailViews?.filter(view => view.mode === 'snapshot') });
  for (const component of components) {
    const projected = conditionalProjection(page, component, context);
    if (!projected) Object.values(component.data ?? {}).forEach(id => full.add(id));
    else for (const id of Object.values(projected.data ?? {})) {
      const fields = required.get(id) ?? new Set<string>();
      strings(projected.props).forEach(value => fields.add(value));
      required.set(id, fields);
    }
    if (component.type === 'aiSummary') Object.values(aiSummaryRelatedData(page, component.props, {}, component.id)).forEach(value => full.add(value.source));
  }
  return new Map(Object.entries(page.dataSources).map(([id, source]) => [id, full.has(id) || !required.has(id) ? source : projectQuery(source, required.get(id)!)]));
}

/** Frozen exports keep captured predicates/windows and apply the same metric projection. */
export function projectCapturedQuery(query: EffectiveQuery | undefined, source: QueryDataSource): EffectiveQuery | undefined {
  if (!query || Object.keys(query.fieldMappings).length === Object.keys(source.fields).length) return query;
  const metrics = source.source.query.body?.dsl_list[0]?.output_metrics;
  if (!Array.isArray(metrics)) return query;
  const allowed = new Set(metrics.filter(metric => typeof metric === 'string'));
  const body = structuredClone(query.body);
  for (const item of body.dsl_list) if (Array.isArray(item.output_metrics)) item.output_metrics = item.output_metrics.filter(metric => typeof metric !== 'string' || allowed.has(metric));
  return { ...query, body, fieldMappings: source.fields };
}
