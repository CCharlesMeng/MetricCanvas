import { walkDocumentComponents } from '../../packages/page/src/component-walk';
import { fieldBindingLeaves, fieldName, fieldSlot } from '../../packages/page/src/field';
import type { MetricCardProps, MetricCardRow } from '../../packages/page/src/page';

type DocumentObject = Record<string, unknown>;
type QueryKey = { queryField: string; schemaId?: string; dimensions?: Record<string, string[]> };
type CatalogEntry = { code: string; source: string; query: QueryKey };
type MetricCatalog = ReadonlyMap<string, readonly CatalogEntry[]>;
type MetricRequest = {
  dataSource: string;
  field: string;
  queryField: string;
  schemaId?: string;
  dimensions: Record<string, string[]>;
};
type BoundMetric = { request: MetricRequest; contract: DocumentObject };

function record(value: unknown): DocumentObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as DocumentObject : undefined;
}

function key(query: Pick<QueryKey, 'schemaId' | 'queryField'>): string {
  return JSON.stringify([query.schemaId ?? null, query.queryField]);
}

export function indexMetricDirectory(input: unknown): MetricCatalog {
  const metrics = record(input)?.metrics;
  if (!Array.isArray(metrics) || !metrics.length) throw new TypeError('指标说明目录需提供非空 metrics 数组');
  const catalog = new Map<string, CatalogEntry[]>();
  for (const [index, value] of metrics.entries()) {
    for (const entry of catalogEntries(value, index)) {
      const identity = key(entry.query);
      const entries = catalog.get(identity) ?? [];
      entries.push(entry);
      catalog.set(identity, entries);
    }
  }
  return catalog;
}

function catalogEntries(value: unknown, index: number): CatalogEntry[] {
  const metric = record(value);
  const code = metric?.code;
  const source = metric?.source;
  const queries = metric?.queries;
  if (typeof code !== 'string' || !/^\S+$/.test(code) || typeof source !== 'string' || !source.trim()
    || !Array.isArray(queries) || !queries.length) {
    throw new TypeError(`metrics[${index}] 需提供 code、source 和非空 queries 数组`);
  }
  return queries.map((value, queryIndex) => ({ code, source, query: catalogQuery(value, `metrics[${index}].queries[${queryIndex}]`) }));
}

function catalogQuery(value: unknown, path: string): QueryKey {
  const query = record(value);
  const queryField = query?.queryField;
  const schemaId = query?.schemaId;
  if (typeof queryField !== 'string' || !queryField.trim() || (schemaId !== undefined && (typeof schemaId !== 'string' || !schemaId.trim()))) {
    throw new TypeError(`${path} 需提供 queryField，并可选填 schemaId`);
  }
  if (query?.dimensions === undefined) return { queryField, schemaId };
  return { queryField, schemaId, dimensions: catalogDimensions(query.dimensions, path) };
}

function catalogDimensions(value: unknown, path: string): Record<string, string[]> {
  const dimensions = record(value);
  if (!dimensions) throw new TypeError(`${path}.dimensions 需为固定维度映射`);
  return Object.fromEntries(Object.entries(dimensions).map(([name, values]) => {
    if (!name.trim() || !Array.isArray(values) || !values.length || !values.every(value => typeof value === 'string')) {
      throw new TypeError(`${path}.dimensions.${name} 需为非空字符串数组`);
    }
    return [name, values];
  }));
}

function dynamicDimensions(query: DocumentObject): Set<unknown> {
  const declarations = [query.filterBindings, query.paramBindings, query.queryResultBindings];
  return new Set(declarations.flatMap(value => Object.values(record(value) ?? {}))
    .map(record).filter(binding => binding?.target === 'dimension').map(binding => binding?.queryField));
}

function fixedDimensions(item: DocumentObject, query: DocumentObject): Record<string, string[]> {
  const conditions = record(item.filter)?.dims;
  if (!Array.isArray(conditions)) return {};
  const dynamic = dynamicDimensions(query);
  const fixed = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const condition of conditions) {
    const dim = record(condition);
    const name = dim?.dim_name;
    if (typeof name !== 'string' || dynamic.has(name)) continue;
    const values = dimensionValues(dim);
    if (!seen.has(name) && values) fixed.set(name, values);
    else fixed.delete(name);
    seen.add(name);
  }
  return Object.fromEntries(fixed);
}

function dimensionValues(dimension: DocumentObject | undefined): string[] | undefined {
  if (!dimension || Object.keys(dimension).some(key => key !== 'dim_name' && key !== 'dim_value_list')) return;
  const values = dimension.dim_value_list;
  if (Array.isArray(values) && values.length && values.every(value => typeof value === 'string')) return values;
}

function measureField(source: DocumentObject | undefined, field: string): DocumentObject | undefined {
  const fields = record(source?.fields);
  const flatField = record(fields?.[field]);
  return flatField?.role === 'measure' ? flatField : record(record(fields?.measures)?.[field]);
}

function singleMetricQuery(source: DocumentObject | undefined) {
  const definition = record(source?.source);
  const query = record(definition?.query);
  if (definition?.type !== 'query' || query?.language !== 'dqe' || query.queryModes || query.timeModes) return;
  const items = record(query.body)?.dsl_list;
  if (!Array.isArray(items) || items.length !== 1) return;
  const item = record(items[0]);
  if (!item || (item.schema_id !== undefined && typeof item.schema_id !== 'string')) return;
  return { query, item, schemaId: item.schema_id };
}

function sourceMetricRequest(source: DocumentObject | undefined, dataSource: string, field: string): BoundMetric | undefined {
  const contract = measureField(source, field);
  if (!contract || typeof contract.queryField !== 'string') return;
  const metric = singleMetricQuery(source);
  if (!metric) return;
  const { queryField } = contract;
  const { item, query, schemaId } = metric;
  const outputs = item.output_metrics;
  if (!Array.isArray(outputs) || !outputs.includes(queryField) || outputs.some(output => record(output)?.alias === queryField)) return;
  return {
    request: { dataSource, field, queryField, schemaId, dimensions: fixedDimensions(item, query) },
    contract
  };
}

function rowRequests(page: DocumentObject, card: DocumentObject, row: MetricCardRow) {
  const sources = record(page.dataSources);
  const slots = record(card.data);
  return fieldBindingLeaves(row.valueField).map(binding => {
    const sourceId = slots?.[fieldSlot(binding)];
    return typeof sourceId === 'string' ? sourceMetricRequest(record(sources?.[sourceId]), sourceId, fieldName(binding)) : undefined;
  });
}

function compareScope(query: QueryKey, request: MetricRequest): 'match' | 'miss' | 'unknown' {
  let missing = false;
  for (const [dimension, expected] of Object.entries(query.dimensions ?? {})) {
    const actual = Object.hasOwn(request.dimensions, dimension) ? request.dimensions[dimension] : undefined;
    if (!actual) missing = true;
    else if (JSON.stringify([...new Set(actual)].sort()) !== JSON.stringify([...new Set(expected)].sort())) return 'miss';
  }
  return missing ? 'unknown' : 'match';
}

function matchRequest(catalog: MetricCatalog, request: MetricRequest) {
  const exact: CatalogEntry[] = [];
  const possible = new Set<string>();
  for (const entry of catalog.get(key(request)) ?? []) {
    const scope = compareScope(entry.query, request);
    if (scope === 'match') exact.push(entry);
    if (scope !== 'miss') possible.add(entry.code);
  }
  return { exact, possible };
}

function matchBoundMetric(catalog: MetricCatalog, metric: BoundMetric) {
  const { exact, possible } = matchRequest(catalog, metric.request);
  if (possible.size > 1) return { reason: 'ambiguous-catalog' };
  if (!exact.length) return { reason: 'catalog-match-required' };
  const code = exact[0].code;
  const existing = metric.contract.metricCode;
  if (existing !== undefined && existing !== code) return { reason: 'metric-code-conflict', existing, code };
  return { code, sources: [...new Set(exact.map(entry => entry.source))] };
}

function planRow(page: DocumentObject, card: DocumentObject, row: MetricCardRow, path: string, catalog: MetricCatalog | undefined) {
  const at = { path: `${path}/showDefinition` };
  if (row.showDefinition !== undefined) {
    return { ...at, status: row.showDefinition ? 'existing' : 'disabled' } as const;
  }
  const bindings = rowRequests(page, card, row);
  const metrics = bindings.filter(metric => metric !== undefined);
  const requests = metrics.map(metric => metric.request);
  if (!metrics.length || metrics.length !== bindings.length) {
    return { ...at, status: 'review', reason: 'unsupported-binding', requests } as const;
  }
  if (!catalog) return { ...at, status: 'review', reason: 'catalog-required', requests } as const;
  const matches = metrics.map(metric => ({ metric, match: matchBoundMetric(catalog, metric) }));
  const checks = matches.map(({ metric, match }) => ({ ...metric.request, ...match }));
  if (matches.some(({ match }) => match.reason)) {
    return { ...at, status: 'review', requests: checks } as const;
  }
  for (const { metric, match } of matches) metric.contract.metricCode ??= match.code;
  row.showDefinition = true;
  return { ...at, status: 'ready', requests: checks } as const;
}

/** Input has passed the product validator. Each row is written after all its bindings match. */
export function planMetricTips(page: DocumentObject, catalog?: MetricCatalog) {
  const cards: unknown[] = [];
  let changes = 0;
  const candidate = structuredClone(page);
  walkDocumentComponents(candidate, (card, path) => {
    if (card.type !== 'metricCard') return;
    const props = card.props as MetricCardProps;
    const at = { componentId: card.id, path: `${path}/props` };
    if (props.tipCode !== undefined) {
      cards.push({ ...at, status: 'existing', code: props.tipCode });
      return;
    }
    const rows = (['rows', 'secondaryRows'] as const).flatMap(key =>
      (props[key] ?? []).map((row, index) => planRow(candidate, card, row, `${at.path}/${key}/${index}`, catalog))
    );
    changes += rows.filter(row => row.status === 'ready').length;
    cards.push({ ...at, rows });
  });
  return { cards, changes, candidate };
}
