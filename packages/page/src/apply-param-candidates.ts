import { ordinaryQuery } from './time-mode';
import { isPeriodSelection } from './period-filter';
import { flattenPageComponents } from './component-walk';
import { versionPolicy } from './version';
import { bindingQueryFields, type DqeQueryDefinition } from './query';
import { canonicalizeJson } from './canonical-json';
import { record, pointer } from './inline-query-params';
import { resolvePageParams, type ParamResolutionIssue } from './resolve-page-params';
import type { GroupedPageParams, PageParamValue, TextValue } from './page-param';
import type { PageDocument } from './page-document';
import type { PageParamExtraction, ParameterCandidate } from './extract-page-params';

type Failure = { ok: false; issues: ParamResolutionIssue[] };
type Location = ParameterCandidate['locations'][number];
type DocumentComponent = PageDocument['sections'][number]['components'][number];
type Header = Extract<DocumentComponent, { type: 'reportHeader' }>;
type OriginalValues = Record<string, PageParamValue>;
const fail = (message: string, path = '/dataSources'): Failure => ({ ok: false, issues: [{ code: 'INVALID_PAGE', path, message }] });
const structuralTextKeys = new Set(['id', 'type', 'param', 'filter', 'format', 'filterIds', 'data', 'layout', 'actions', 'links', 'navigate', 'writeFilter', 'hierarchyFilter']);

export function applyParameterCandidates(extraction: PageParamExtraction, selectedIds: readonly string[], textReplacements: Readonly<Record<string, TextValue>>): { ok: true; document: PageDocument; originalValues: OriginalValues; issues: [] } | Failure {
  const invalidSelection = selectionError(extraction, selectedIds);
  if (invalidSelection) return invalidSelection;
  const selected = extraction.candidates.filter(c => selectedIds.includes(c.id));
  const document = structuredClone(extraction.source);
  const invalidDocument = initializeDocument(document, selected) ?? replaceText(document, textReplacements);
  if (invalidDocument) return invalidDocument;
  const originalValues: OriginalValues = {};
  for (const candidate of selected) {
    const issue = applyCandidate(document, candidate, originalValues);
    if (issue) return issue;
  }
  const pending = remainingLiteralPaths(document, selected);
  if (pending.length) return fail(`以下文本仍含原值，须显式替换或改为参数引用：${pending.join('、')}`, pending[0]);
  if (selected.length) discardInitialData(document);
  const resolved = resolvePageParams(document, originalValues);
  if (!resolved.ok) return resolved;
  const inequivalent = originalQueryError(extraction.source, resolved.resolvedPage, selected);
  return inequivalent ?? { ok: true, document, originalValues, issues: [] };
}

function selectionError(extraction: PageParamExtraction, selectedIds: readonly string[]): Failure | undefined {
  if (canonicalizeJson(extraction.source) !== extraction.sourceKey) return fail('提取来源已改变，须重新提取');
  if (new Set(selectedIds).size !== selectedIds.length || selectedIds.some(id => !extraction.candidates.some(c => c.id === id))) return fail('选择包含未知或重复参数');
}

function initializeDocument(document: PageDocument, selected: ParameterCandidate[]): Failure | undefined {
  document.schemaVersion = selected.some(c => c.declaration.type === 'timeRange') ? versionPolicy.current : selected.length && Number(document.schemaVersion.split('.')[1]) < 11 ? '6.11' : document.schemaVersion;
  if (Array.isArray(document.params) && document.params.length) return fail('已有旧参数须先显式迁移，不能在提取时丢弃');
  if (selected.length && (!document.params || Array.isArray(document.params))) document.params = { query: {} };
}

function walkText(value: unknown, path: string, visit: (text: string, path: string) => void): void {
  if (typeof value === 'string') visit(value, path);
  else if (Array.isArray(value)) value.forEach((child, index) => walkText(child, `${path}/${index}`, visit));
  else if (record(value)) for (const [key, child] of Object.entries(value)) {
    if (!structuralTextKeys.has(key)) walkText(child, `${path}/${pointer(key)}`, visit);
  }
}

function replaceText(document: PageDocument, replacements: Readonly<Record<string, TextValue>>): Failure | undefined {
  const paths = new Set<string>();
  const collect = (_text: string, path: string) => { paths.add(path); };
  walkText(document.sections, '/sections', collect);
  walkText(document.meta, '/meta', collect);
  for (const [path, value] of Object.entries(replacements)) {
    if (!paths.has(path)) return fail('只能替换现有文本槽位', path);
    setAt(document, path, value);
  }
}

function declareCandidate(document: PageDocument, candidate: ParameterCandidate, values: OriginalValues): Failure | undefined {
  if (!document.params || Array.isArray(document.params)) return;
  const queryParams = (document.params.query ??= {});
  if (candidate.declaration.type === 'dimension') return declareDimension(document, candidate, queryParams, values);
  if (candidate.declaration.type !== 'timeRange' || !candidate.declaration.granularity || typeof candidate.originalValue !== 'object' || Array.isArray(candidate.originalValue)) return fail('分组参数不支持此提取类型');
  if (!queryParams.times?.some(t => t.id === candidate.id)) (queryParams.times ??= []).push({ id: candidate.id, granularity: candidate.declaration.granularity, label: candidate.declaration.label });
  const existing = queryParams.times?.find(t => t.id === candidate.id);
  if (existing) { delete existing.start; delete existing.end; }
  values[candidate.id] = { start: candidate.originalValue.start, end: candidate.originalValue.end };
}

function declareDimension(document: PageDocument, candidate: ParameterCandidate, queryParams: NonNullable<GroupedPageParams['query']>, values: OriginalValues): Failure | undefined {
  const names = new Set(candidate.locations.map(l => l.queryField));
  if (names.size !== 1 || !candidate.locations[0].queryField) return fail('分组维度参数的查询字段必须一致');
  if (candidate.locations.some(location => {
    const ds = document.dataSources[location.dataSourceId];
    return ds.source.type === 'query' && Object.values(ds.source.query.filterBindings ?? {}).some(binding => bindingQueryFields(binding).includes(location.queryField ?? ''));
  })) return fail('分组维度不能与页内筛选共同控制');
  (queryParams.dimensions ??= []).push({ id: candidate.id, dim_name: candidate.locations[0].queryField, label: candidate.declaration.label });
  values[candidate.id] = Array.isArray(candidate.originalValue) ? [...candidate.originalValue] : [String(candidate.originalValue)];
}

function applyCandidate(document: PageDocument, candidate: ParameterCandidate, values: OriginalValues): Failure | undefined {
  const declarationError = declareCandidate(document, candidate, values);
  if (declarationError) return declarationError;
  let dateFilterId: string | undefined;
  if (candidate.declaration.type === 'timeRange') {
    const filter = configureDateFilter(document, candidate);
    if (!filter.ok) return filter;
    dateFilterId = filter.id;
    if (document.layout !== 'dashboard') placeDateFilter(document, candidate, dateFilterId);
  }
  for (const location of candidate.locations) {
    const issue = candidate.declaration.type === 'dimension'
      ? bindDimensionLocation(document, candidate, location)
      : bindDateLocation(document, candidate, location, dateFilterId!);
    if (issue) return issue;
  }
}

function availableId(base: string, occupied: ReadonlySet<string>): string {
  let id = base, suffix = 2;
  while (occupied.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function configureDateFilter(document: PageDocument, candidate: ParameterCandidate): { ok: true; id: string } | Failure {
  let id = candidate.locations.find(l => l.filterId)?.filterId;
  if (!id) {
    id = availableId(`${candidate.id}-filter`, new Set((document.filters ?? []).map(f => f.id)));
    const original = candidate.originalValue as { start: string; end: string };
    (document.filters ??= []).push(original.start === original.end
      ? { id, type: 'timePoint', granularity: candidate.declaration.granularity!, label: candidate.declaration.label, required: true, initialParam: candidate.id }
      : { id, type: 'timeRange', precision: candidate.declaration.granularity!, label: candidate.declaration.label, required: true, initialParam: candidate.id });
  } else {
    const filter = document.filters!.find(f => f.id === id)!;
    if (filter.type !== 'timeRange' && filter.type !== 'timePoint') return fail('日期筛选类型不匹配');
    if (filter.type === 'timeRange' && filter.display === 'period' && isPeriodSelection(filter.default) && filter.default.mode !== 'last12Months') filter.initialMode = filter.default.mode;
    delete filter.default;
    filter.initialParam = candidate.id;
    filter.required = true;
  }
  return { ok: true, id };
}

function ensureReportHeader(document: PageDocument, dateFilterId: string): Header {
  const headers = document.sections.flatMap(section => section.components).filter(c => c.type === 'reportHeader');
  const existing = headers.find(c => c.type === 'reportHeader' && c.props.filterIds?.includes(dateFilterId)) ?? headers[0];
  if (existing) return existing;
  const id = availableId('report-header', new Set(flattenPageComponents(document).map(c => c.id)));
  const header: Header = { id, type: 'reportHeader', layout: { span: 12 }, props: { title: document.meta?.title ?? document.id } };
  const sectionId = availableId(`${id}-section`, new Set(document.sections.map(s => s.id)));
  document.sections.unshift({ id: sectionId, components: [header] });
  return header;
}

function placeDateFilter(document: PageDocument, candidate: ParameterCandidate, dateFilterId: string): void {
  const header = ensureReportHeader(document, dateFilterId);
  header.props.filterIds = [...new Set([...(header.props.filterIds ?? []), dateFilterId])];
  // Placement does not own authored text; replace only matching literal date captions.
  const original = candidate.originalValue as { start: string; end: string };
  const value = header.props.asOf?.value;
  if (!header.props.asOf || (typeof value === 'string' && (value === original.start || value === `${original.start} 至 ${original.end}`))) {
    header.props.asOf = { label: header.props.asOf?.label ?? '当前期间', value: { filter: dateFilterId, format: 'period' } as unknown as string };
  }
}

function bindDimensionLocation(document: PageDocument, candidate: ParameterCandidate, location: Location): Failure | undefined {
  setAt(document, location.path, { param: candidate.id });
  const ds = document.dataSources[location.dataSourceId];
  if (ds.source.type !== 'query') return;
  for (const [id, binding] of Object.entries(ds.source.query.filterBindings ?? {})) {
    if (!bindingQueryFields(binding).includes(location.queryField ?? '')) continue;
    const filter = document.filters?.find(f => f.id === id);
    if (filter?.type !== 'dimension') return fail('维度筛选类型不匹配');
    const value = Array.isArray(candidate.originalValue) ? candidate.originalValue : [candidate.originalValue];
    if (filter.default && canonicalizeJson(filter.default) !== canonicalizeJson(value)) return fail('筛选初值与已验证查询不同，须先确认查询基线');
    delete filter.default;
    filter.initialParam = candidate.id;
  }
}

function bindDateLocation(document: PageDocument, candidate: ParameterCandidate, location: Location, dateFilterId: string): Failure | undefined {
  const source = document.dataSources[location.dataSourceId].source;
  if (source.type !== 'query') return fail('来源查询已改变');
  if (location.filterId) return;
  if (location.datePredicate && location.queryField) {
    const filter = ordinaryQuery(source.query).body.dsl_list[0].filter as Record<string, any>;
    filter.dims = filter.dims.filter((dim: any) => dim.dim_name !== location.queryField);
    (source.query.filterBindings ??= {})[dateFilterId] = { target: 'timePoint', queryField: location.queryField, valueFormat: location.valueFormat };
    return;
  }
  const time = (ordinaryQuery(source.query).body.dsl_list[0].filter as Record<string, any>).time;
  delete time.start;
  delete time.end;
  const original = candidate.originalValue as { start: string; end: string };
  (source.query.filterBindings ??= {})[dateFilterId] = original.start === original.end
    ? { target: 'time', window: { kind: 'period', unit: candidate.declaration.granularity === 'month' ? 'month' : 'day' } } : { target: 'time' };
}

function originalStrings(candidate: ParameterCandidate) {
  const value = candidate.originalValue;
  return typeof value === 'string' ? [value] : Array.isArray(value) ? value : typeof value === 'object' ? [value.start, value.end] : [];
}

function remainingLiteralPaths(document: PageDocument, selected: ParameterCandidate[]): string[] {
  const pending: string[] = [];
  const collect = (text: string, path: string) => {
    if (selected.some(candidate => originalStrings(candidate).some(value => text.includes(value)))) pending.push(path);
  };
  walkText(document.sections, '/sections', collect);
  walkText(document.meta, '/meta', collect);
  return pending;
}

function discardInitialData(document: PageDocument): void {
  for (const ds of Object.values(document.dataSources)) if (ds.source.type !== 'inline') delete ds.source.initial;
}

function needsDimensionRestore(location: Location, id: string, query: DqeQueryDefinition): boolean {
  return !location.filterId && location.dataSourceId === id && !!location.queryField &&
    Object.values(query.filterBindings ?? {}).some(binding => bindingQueryFields(binding).includes(location.queryField ?? '') || (binding.target === 'timePoint' && binding.queryField === location.queryField));
}

function restoredDimensionValues(candidate: ParameterCandidate, location: Location) {
  if (candidate.declaration.type === 'timeRange') return [(candidate.originalValue as { start: string }).start.replaceAll('-', location.valueFormat === 'compact' ? '' : '-')];
  return Array.isArray(candidate.originalValue) ? candidate.originalValue : [candidate.originalValue];
}

function restoreOriginalBody(query: DqeQueryDefinition, selected: ParameterCandidate[], id: string) {
  const body = structuredClone(ordinaryQuery(query).body);
  const filter: Record<string, any> = record(body.dsl_list[0].filter) ? body.dsl_list[0].filter : {};
  const restored = selected.flatMap(candidate => candidate.locations.filter(location => needsDimensionRestore(location, id, query))
    .map(location => ({ candidate, location, index: Number(location.path.split('/').at(-2)) }))).sort((a, b) => a.index - b.index);
  for (const { candidate, location, index } of restored) {
    filter.dims ??= [];
    filter.dims.splice(index, 0, { dim_name: location.queryField, dim_value_list: restoredDimensionValues(candidate, location) });
    body.dsl_list[0].filter = filter;
  }
  restoreOriginalTimes(filter, selected, id);
  return body;
}

function restoreOriginalTimes(filter: Record<string, any>, selected: ParameterCandidate[], id: string): void {
  for (const candidate of selected) for (const location of candidate.locations) {
    if (candidate.declaration.type !== 'timeRange' || location.dataSourceId !== id || location.filterId || location.datePredicate) continue;
    const original = candidate.originalValue as { start: string; end: string };
    const time = filter.time;
    if (record(time)) { time.start = original.start; time.end = original.end; }
  }
}

function originalQueryError(before: PageDocument, after: PageDocument, selected: ParameterCandidate[]): Failure | undefined {
  for (const id of new Set(selected.flatMap(c => c.coveredQueries))) {
    const previous = before.dataSources[id].source, next = after.dataSources[id].source;
    if (previous.type !== 'query' || next.type !== 'query') return fail('来源查询已改变');
    // Filter-owned targets are compared with their initialized values reinstated.
    if (canonicalizeJson(restoreOriginalBody(next.query, selected, id)) !== canonicalizeJson(ordinaryQuery(previous.query).body)) return fail('原值回填与已验证查询不等价', `/dataSources/${pointer(id)}`);
  }
}

function setAt(root: unknown, path: string, value: unknown): void {
  const keys = path.slice(1).split('/').map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'));
  let target: any = root;
  for (const key of keys.slice(0, -1)) target = target[key];
  target[keys.at(-1)!] = structuredClone(value);
}
