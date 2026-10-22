import { ordinaryQuery, hasQuerySelection } from './query-selection';
import { isPeriodSelection, resolvePeriodSelection } from './period-filter';
import { canonicalizeJson } from './canonical-json';
import { record, pointer } from './inline-query-params';
import { matchesParamDeclaration, pageParamDeclarations, type PageParamDeclaration, type PageParamValue } from './page-param';
import type { PageDocument } from './page-document';
import type { FilterDeclaration } from './filter';
import type { DqeQueryDefinition } from './query';
import type { ExtractionContext, PageParamExtraction, ParameterCandidate } from './extract-page-params';

type AddCandidate = (identity: string, declaration: PageParamDeclaration, value: PageParamValue, location: ParameterCandidate['locations'][number]) => void;
type Skipped = PageParamExtraction['skipped'];
type DateFilter = Extract<FilterDeclaration, { type: 'timePoint' | 'timeRange' }>;
type DateField = { granularity: 'month' | 'date'; valueFormat?: 'iso' | 'compact'; identity?: string };

export function collectParameterCandidates(source: PageDocument, context: ExtractionContext): Pick<PageParamExtraction, 'candidates' | 'skipped'> {
  const queries = Object.keys(source.dataSources).filter(id => source.dataSources[id].source.type === 'query' && !hasQuerySelection((source.dataSources[id].source as { query: import('./query').PageQuery }).query)).sort();
  const groups = new Map<string, ParameterCandidate>();
  const skipped: Skipped = [];
  const add: AddCandidate = (identity, declaration, value, location) => {
    const signature = canonicalizeJson({ identity, type: declaration.type, value });
    const group = groups.get(signature) ?? { id: '', identity: signature, declaration, originalValue: value, locations: [], coveredQueries: [], uncoveredQueries: [], defaultSelected: false };
    group.locations.push(location);
    groups.set(signature, group);
  };
  for (const id of queries) collectQueryCandidates(source, id, context, add, skipped);
  for (const filter of source.filters ?? []) {
    if (filter.type === 'timePoint' || filter.type === 'timeRange') collectFilterCandidates(source, queries, filter, add, skipped);
  }
  const occupied = new Set(pageParamDeclarations(source.params).map(p => p.id));
  const candidates = [...groups.values()].sort((a, b) => a.identity.localeCompare(b.identity, 'en'));
  for (const candidate of candidates) finalizeCandidate(candidate, source, queries, context, occupied);
  return { candidates, skipped };
}

function collectQueryCandidates(source: PageDocument, id: string, context: ExtractionContext, add: AddCandidate, skipped: Skipped): void {
  const ds = source.dataSources[id];
  if (ds.source.type !== 'query') return;
  const query = ds.source.query;
  const base = `/dataSources/${pointer(id)}/source/query/body/dsl_list/0/filter`;
  if (Object.keys(query.paramBindings ?? {}).length) { skipped.push({ path: base, reason: '旧绑定须先显式迁移' }); return; }
  const rawFilter = ordinaryQuery(query).body.dsl_list[0].filter;
  const filter: Record<string, any> = record(rawFilter) ? rawFilter : {};
  if (Array.isArray(filter.dims)) for (const [index, dim] of filter.dims.entries()) {
    collectDimensionCandidate(source, id, dim, filter.dims, `${base}/dims/${index}/dim_value_list`, query, context, add, skipped);
  }
  if (record(filter.time)) collectTimeCandidate(id, filter.time, query, base, context, add, skipped);
}

function simpleDimension(dim: any, dims: any[]): boolean {
  return record(dim) && !Object.keys(dim).some(k => !['dim_name', 'dim_value_list'].includes(k)) &&
    typeof dim.dim_name === 'string' && Array.isArray(dim.dim_value_list) && !!dim.dim_value_list.length &&
    dim.dim_value_list.every((value: unknown) => typeof value === 'string' && value.length) &&
    new Set(dim.dim_value_list).size === dim.dim_value_list.length && dims.filter(value => value?.dim_name === dim.dim_name).length === 1;
}

function collectDimensionCandidate(source: PageDocument, id: string, dim: any, dims: any[], path: string, query: DqeQueryDefinition, context: ExtractionContext, add: AddCandidate, skipped: Skipped): void {
  if (!simpleDimension(dim, dims)) { skipped.push({ path, reason: '仅提取无歧义的简单字符串维度谓词' }); return; }
  const typed = Object.values(source.dataSources[id].fields).find(field => field.type === 'date' && 'queryField' in field && field.queryField === dim.dim_name);
  const dateField = context.timePointFields?.[id]?.[dim.dim_name] ?? (typed ? { granularity: 'date' as const } : undefined);
  if (Object.values(query.filterBindings ?? {}).some(b => b.target === 'timePoint' && b.queryField === dim.dim_name)) return;
  if (dateField && collectDatePredicate(id, dim, dateField, path, add)) return;
  const multiple = dim.dim_value_list.length > 1;
  const identity = context.dimensionIdentities?.[id]?.[dim.dim_name] ?? `${id}:${dim.dim_name}`;
  add(identity, { id: '', type: 'dimension', required: true, label: dim.dim_name, ...(multiple ? { multiple: true } : {}) }, multiple ? [...dim.dim_value_list] : dim.dim_value_list[0], { dataSourceId: id, path, queryField: dim.dim_name });
}

function collectDatePredicate(id: string, dim: any, dateField: DateField, path: string, add: AddCandidate): boolean {
  if (dim.dim_value_list.length !== 1 || typeof dim.dim_value_list[0] !== 'string') return false;
  const raw = dim.dim_value_list[0];
  const value = dateField.valueFormat === 'compact' ? dateField.granularity === 'month' ? `${raw.slice(0, 4)}-${raw.slice(4)}` : `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}` : raw;
  const declaration: PageParamDeclaration = { id: '', type: 'timeRange', required: true, label: dim.dim_name, granularity: dateField.granularity };
  if (!matchesParamDeclaration({ start: value, end: value }, declaration)) return false;
  add(dateField.identity ?? `date:${id}:${dim.dim_name}`, declaration, { start: value, end: value }, { dataSourceId: id, path, queryField: dim.dim_name, valueFormat: dateField.valueFormat, datePredicate: true });
  return true;
}

function collectTimeCandidate(id: string, time: Record<string, any>, query: DqeQueryDefinition, base: string, context: ExtractionContext, add: AddCandidate, skipped: Skipped): void {
  const granularity = time.period === 'month' ? 'month' : time.period === 'day' ? 'date' : undefined;
  const declaration: PageParamDeclaration = { id: '', type: 'timeRange', required: true, label: '报告期间', granularity };
  const value = { start: time.start, end: time.end, granularity };
  if (granularity && matchesParamDeclaration(value, declaration) && !Object.values(query.filterBindings ?? {}).some(b => b.target === 'time')) {
    add(context.timeIdentities?.[id] ?? `time:${id}:${granularity}`, declaration, value, { dataSourceId: id, path: `${base}/time` });
  } else skipped.push({ path: `${base}/time`, reason: '只提取明确合法的固定月/日区间，不推断窗口关系' });
}

function absoluteFilterPeriod(filter: DateFilter, granularity: 'month' | 'date') {
  if (filter.type !== 'timeRange' || filter.display !== 'period' || !isPeriodSelection(filter.default) || filter.default.mode === 'last12Months' || !filter.default.value) return undefined;
  return resolvePeriodSelection(filter.default, new Date(2026, 0, 1), granularity);
}

function initialFilterValue(source: PageDocument, filter: DateFilter, granularity: 'month' | 'date') {
  const existing = filter.initialParam ? pageParamDeclarations(source.params).find(p => p.id === filter.initialParam) : undefined;
  const period = absoluteFilterPeriod(filter, granularity);
  if (period) return { start: period.from, end: period.to };
  if (existing?.type === 'timeRange' && typeof existing.value === 'object' && !Array.isArray(existing.value)) return existing.value;
  if (filter.type === 'timePoint') return { start: filter.default, end: filter.default };
  return filter.default && typeof filter.default === 'object' && 'from' in filter.default ? { start: filter.default.from, end: filter.default.to } : undefined;
}

function consumesDateFilter(filter: DateFilter, binding: NonNullable<DqeQueryDefinition['filterBindings']>[string] | undefined): boolean {
  if (!binding) return false;
  return filter.type === 'timePoint' ? binding.target === 'timePoint' || (binding.target === 'time' && !!binding.window) : binding.target === 'time';
}

function collectFilterCandidates(source: PageDocument, queries: string[], filter: DateFilter, add: AddCandidate, skipped: Skipped): void {
  const granularity = filter.type === 'timePoint' ? filter.granularity : filter.precision ?? 'date';
  if (granularity === 'datetime') return;
  const initial = initialFilterValue(source, filter, granularity);
  if (!initial || !matchesParamDeclaration(initial, { id: '', type: 'timeRange', required: true, granularity })) { skipped.push({ path: `/filters/${filter.id}/default`, reason: '相对时间须先在可信基线中明确为绝对日期' }); return; }
  const declaration: PageParamDeclaration = { id: '', type: 'timeRange', required: true, label: filter.label ?? '报告期间', granularity };
  for (const id of queries) {
    const ds = source.dataSources[id];
    if (ds.source.type !== 'query') continue;
    const binding = ds.source.query.filterBindings?.[filter.id];
    if (!consumesDateFilter(filter, binding) || !binding) continue;
    add(`filter:${filter.id}`, declaration, initial as PageParamValue, { dataSourceId: id, path: `/filters/${filter.id}/default`, filterId: filter.id,
      ...(binding.target === 'timePoint' ? { queryField: binding.queryField } : {}),
      ...(binding.target === 'time' && binding.window ? { window: binding.window } : {}) });
  }
}

function candidateHint(candidate: ParameterCandidate): string {
  return candidate.declaration.type === 'timeRange' ? 'report-period' : String(JSON.parse(candidate.identity).identity).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dimension';
}

function assignCandidateId(candidate: ParameterCandidate, source: PageDocument, context: ExtractionContext, occupied: Set<string>): void {
  const previous = context.previousCandidates?.find(p => p.identity === candidate.identity && canonicalizeJson(p.locations) === canonicalizeJson(candidate.locations));
  const filterId = candidate.locations.find(l => l.filterId)?.filterId;
  const existing = source.filters?.find(f => f.id === filterId && 'initialParam' in f);
  candidate.existingParamId = existing && 'initialParam' in existing ? existing.initialParam : undefined;
  const base = candidate.existingParamId ?? previous?.id ?? candidateHint(candidate);
  let id = base, suffix = 2;
  while (occupied.has(id) && id !== candidate.existingParamId) id = `${base}-${suffix++}`;
  occupied.add(id);
  candidate.id = id;
  candidate.declaration.id = id;
}

function finalizeCandidate(candidate: ParameterCandidate, source: PageDocument, queries: string[], context: ExtractionContext, occupied: Set<string>): void {
  assignCandidateId(candidate, source, context, occupied);
  if (candidate.declaration.type === 'timeRange') {
    const original = candidate.originalValue as { start: string; end: string };
    candidate.dateForm = `${candidate.declaration.granularity}${original.start === original.end ? '' : 'Range'}` as ParameterCandidate['dateForm'];
  }
  candidate.coveredQueries = [...new Set(candidate.locations.map(l => l.dataSourceId))].sort();
  candidate.uncoveredQueries = queries.filter(id => !candidate.coveredQueries.includes(id));
  candidate.defaultSelected = candidate.coveredQueries.length > 1 && candidate.coveredQueries.length > queries.length / 2;
}
