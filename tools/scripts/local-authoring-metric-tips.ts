import { walkDocumentComponents } from '../../packages/page/src/component-walk';
import { fieldBindingLeaves, type FieldBinding } from '../../packages/page/src/field';
import { metricCardTipAnchor } from '../../packages/page/src/metric-card';
import type { MetricCardProps } from '../../packages/page/src/page';

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

function sourceMetricRequest(source: DocumentObject | undefined, dataSource: string, field: string): MetricRequest | undefined {
  const definition = record(source?.source);
  const query = record(definition?.query);
  if (definition?.type !== 'query' || query?.language !== 'dqe' || query.queryModes || query.timeModes) return;
  const fields = record(source?.fields);
  const flatField = record(fields?.[field]);
  const measure = record(record(fields?.measures)?.[field]);
  const queryField = flatField?.role === 'measure' ? flatField.queryField : measure?.queryField;
  const items = record(query.body)?.dsl_list;
  if (!Array.isArray(items) || items.length !== 1 || typeof queryField !== 'string') return;
  const item = record(items[0]);
  if (!item || !Array.isArray(item.output_metrics) || !item.output_metrics.includes(queryField)
    || item.output_metrics.some(output => record(output)?.alias === queryField)) return;
  if (item.schema_id !== undefined && typeof item.schema_id !== 'string') return;
  return { dataSource, field, queryField, schemaId: item.schema_id, dimensions: fixedDimensions(item, query) };
}

function cardRequests(page: DocumentObject, card: DocumentObject, props: MetricCardProps) {
  const rows = [...props.rows, ...(props.secondaryRows ?? [])];
  const bindings: FieldBinding[] = rows.flatMap(row => [row.valueField, ...(row.changes ?? []).map(change => change.field)]);
  if (props.progress) bindings.push(props.progress.valueField);
  const sources = record(page.dataSources);
  const slots = record(card.data);
  return bindings.flatMap(fieldBindingLeaves).map(binding => {
    const { data, field } = typeof binding === 'string' ? { data: 'main', field: binding } : binding;
    const dataSource = slots?.[data];
    return typeof dataSource === 'string' ? sourceMetricRequest(record(sources?.[dataSource]), dataSource, field) : undefined;
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

function resolveRequests(requests: (MetricRequest | undefined)[], catalog: MetricCatalog | undefined) {
  const resolved = requests.filter(request => request !== undefined);
  if (!resolved.length || resolved.length !== requests.length) {
    return { status: 'review' as const, reason: 'unsupported-binding', requests: resolved };
  }
  if (!catalog) return { status: 'review' as const, reason: 'catalog-required', requests: resolved };
  const matches = resolved.map(request => matchRequest(catalog, request));
  if (matches.some(match => match.possible.size > 1)) {
    return { status: 'review' as const, reason: 'ambiguous-catalog', requests: resolved };
  }
  if (matches.some(match => !match.exact.length)) {
    return { status: 'review' as const, reason: 'catalog-match-required', requests: resolved };
  }
  const entries = matches.flatMap(match => match.exact);
  const codes = new Set(entries.map(entry => entry.code));
  if (codes.size !== 1) return { status: 'review' as const, reason: 'multiple-metrics', requests: resolved };
  return { status: 'ready' as const, code: entries[0].code, sources: [...new Set(entries.map(entry => entry.source))], requests: resolved };
}

/** Input has already passed the product page validator. Candidate writes change one property per card. */
export function planMetricTips(page: DocumentObject, catalog?: MetricCatalog) {
  const cards: unknown[] = [];
  let changes = 0;
  const candidate = structuredClone(page);
  walkDocumentComponents(candidate, (card, path) => {
    if (card.type !== 'metricCard') return;
    const props = card.props as MetricCardProps;
    const at = { componentId: card.id, path: `${path}/props/tipCode` };
    if (props.tipCode !== undefined) {
      cards.push({ ...at, status: 'existing', code: props.tipCode });
      return;
    }
    const anchor = metricCardTipAnchor(props);
    const result = resolveRequests(cardRequests(candidate, card, props), catalog);
    if (anchor && result.status === 'ready') {
      props.tipCode = result.code;
      changes++;
    }
    cards.push({ ...at, ...result, ...(!anchor ? { status: 'review', reason: 'anchor-required' } : { anchor }) });
  });
  return { cards, changes, candidate };
}
