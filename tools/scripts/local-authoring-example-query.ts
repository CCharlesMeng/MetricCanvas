import path from 'node:path';
import { walkDocumentComponents } from '../../packages/page/src/component-walk';
import { conditionSourceIds, sourceFilterIds } from '../../packages/page/src/data-source-references';
import type { DataSources } from '../../packages/page/src/data-source';
import { digest } from './local-authoring-knowledge-core';
import { componentSchemaOwner, rulesForOwners } from './local-authoring-query-rules';
import { textWindows } from './local-authoring-text-windows';
import { guideCard } from './local-authoring-guide-query';
import type { ExampleLoader, ExampleObject, KnowledgeExample, KnowledgeQuery, QueryKnowledge, QueryResult } from './local-authoring-query-types';

type Json = Record<string, any>;
const exampleSelections = ['card', 'outline', 'snippet', 'dependencies', 'applicability', 'expectations', 'guides', 'data', 'query'];
const encode = (key: string): string => key.replaceAll('~', '~0').replaceAll('/', '~1');
const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value));

function record(value: unknown): Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
}

function ownValue(value: Json, key: string): unknown {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}

function assertExampleOptions(options: KnowledgeQuery, command: 'find' | 'show'): void {
  const shared = ['kind', 'limit', 'cursor'];
  const allowed = command === 'find' ? [...shared, 'owner', 'query'] : [...shared, 'id', 'select', 'at'];
  const unsupported = Object.keys(options).filter(key => options[key as keyof KnowledgeQuery] !== undefined && !allowed.includes(key));
  if (unsupported.length) throw new TypeError(`Unsupported example ${command} option: ${unsupported.join(', ')}`);
  if (options.kind !== undefined && options.kind !== 'example') throw new TypeError('Example queries require kind example');
}

function completePage(value: unknown): value is Json {
  const page = record(value);
  return typeof page.id === 'string' && typeof page.schemaVersion === 'string' && Array.isArray(page.sections) && !!page.dataSources;
}

function exampleObjects(document: Json): ExampleObject[] {
  const objects: ExampleObject[] = [];
  walkDocumentComponents(document, (component, location) => {
    if (typeof component.id === 'string' && typeof component.type === 'string') objects.push({id: component.id, type: component.type, path: location});
  });
  return objects;
}

function indexExample(file: string, content: string): KnowledgeExample | undefined {
  const document: unknown = JSON.parse(content);
  if (!completePage(document)) return undefined;
  const name = path.posix.basename(file, '.json');
  return {id: `example:${name}`, file: `references/page-metadata/${file}`, pageId: document.id,
    title: String(document.meta?.title ?? document.id), layout: String(document.layout ?? 'report'),
    bytes: Buffer.byteLength(content), sha256: digest(content), objects: exampleObjects(document),
    sourceTypes: [...new Set(Object.values(record(document.dataSources)).map(source => String(record(record(source).source).type)))]};
}

/** The index retains page identities and object positions, never business rows. */
export function buildExampleIndex(reference: Map<string, string>): KnowledgeExample[] {
  return [...reference].filter(([file]) => file.startsWith('examples/') && file.endsWith('.json'))
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([file, content]) => { const entry = indexExample(file, content); return entry ? [entry] : []; });
}

function matchesExample(entry: KnowledgeExample, options: KnowledgeQuery): boolean {
  if (options.owner && !entry.objects.some(object => object.type === options.owner)) return false;
  const searchable = [entry.id, entry.pageId, entry.title, entry.layout, ...entry.sourceTypes,
    ...entry.objects.flatMap(object => [object.id, object.type]),
    ...(entry.guides ?? []).flatMap(guide => [guide.fields.purpose.summary, guide.fields.boundary.summary])].join(' ').toLocaleLowerCase();
  return (options.query ?? '').toLocaleLowerCase().split(/\s+/).filter(Boolean).every(word => searchable.includes(word));
}

function exampleCard(entry: KnowledgeExample): QueryResult {
  return {id: entry.id, kind: 'example', title: entry.title, pageId: entry.pageId,
    layout: entry.layout, sourceTypes: entry.sourceTypes, bytes: entry.bytes, guideCount: entry.guides?.length ?? 0};
}

export function findExamples(model: QueryKnowledge, options: KnowledgeQuery): QueryResult {
  assertExampleOptions(options, 'find');
  return {kind: 'example', items: (model.examples ?? []).filter(entry => matchesExample(entry, options)).map(exampleCard)};
}

function entryFor(model: QueryKnowledge, id: string | undefined): KnowledgeExample {
  const entry = model.examples?.find(candidate => candidate.id === id);
  if (!entry) throw new TypeError(`Unknown example: ${String(id)}`);
  return entry;
}

function valueAt(document: unknown, pointer: string): unknown {
  if (!pointer.startsWith('/')) throw new TypeError('Example position must be an absolute JSON Pointer');
  return pointer.slice(1).split('/').reduce<unknown>((value, part) => {
    const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) throw new TypeError(`Unknown example position: ${pointer}`);
    return (value as Json)[key];
  }, document);
}

function loadedPage(entry: KnowledgeExample, loader: ExampleLoader): Json {
  const page = loader(entry);
  if (!completePage(page) || page.id !== entry.pageId) throw new Error(`Example identity mismatch: ${entry.id}`);
  return page;
}

function childDirectory(value: unknown, at: string): QueryResult[] {
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).map(([key, child]) => ({at: `${at}/${encode(key)}`,
    type: Array.isArray(child) ? 'array' : typeof child, bytes: bytes(child)}));
}

function needsPosition(entry: KnowledgeExample): QueryResult {
  return {id: entry.id, status: 'needs-context', required: ['at'], next: {select: 'outline'}};
}

function payloadSelection(at: string): string | undefined {
  const parts = at.slice(1).split('/');
  if (parts[0] !== 'dataSources') return undefined;
  if (parts[2] === 'initial') return 'data';
  if (parts[2] !== 'source') return undefined;
  if (parts[3] === 'rows' || parts[3] === 'initial') return 'data';
  if (parts[3] === 'query') return 'query';
  return undefined;
}

function sourceDirectory(at: string, value: unknown): boolean {
  const parts = at.slice(1).split('/');
  return parts[0] === 'dataSources' && parts[2] !== 'fields' && value !== null && typeof value === 'object';
}

function selectedValue(entry: KnowledgeExample, at: string, value: unknown): QueryResult {
  if (typeof value === 'string' && bytes(value) > 750) {
    return {id: entry.id, at, representation: 'text-windows', length: value.length, complete: true,
      items: textWindows(value), note: 'Read all ordered text windows to reconstruct this exact scalar value.'};
  }
  return {id: entry.id, at, complete: true, value};
}

function selectedSnippet(entry: KnowledgeExample, page: Json, options: KnowledgeQuery): QueryResult {
  if (!options.at) return needsPosition(entry);
  const value = valueAt(page, options.at), selection = payloadSelection(options.at);
  if (selection) return {id: entry.id, status: 'needs-selection', at: options.at, required: [selection]};
  if (sourceDirectory(options.at, value)) {
    return {id: entry.id, status: 'needs-expand', at: options.at, items: childDirectory(value, options.at)};
  }
  if (typeof value === 'string') return selectedValue(entry, options.at, value);
  if (bytes(value) > 1536) return {id: entry.id, status: 'needs-expand', at: options.at, bytes: bytes(value), items: childDirectory(value, options.at)};
  return selectedValue(entry, options.at, value);
}

function selectedPayload(entry: KnowledgeExample, page: Json, options: KnowledgeQuery): QueryResult {
  if (!options.at) return needsPosition(entry);
  const expected = payloadSelection(options.at);
  if (expected !== options.select) throw new TypeError(`Select ${options.select} requires a ${options.select} position`);
  const value = valueAt(page, options.at);
  if (Array.isArray(value)) return {id: entry.id, at: options.at, items: value.map((item, index) => ({at: `${options.at}/${index}`, value: item}))};
  return selectedValue(entry, options.at, value);
}

function selectedOutline(entry: KnowledgeExample, page: Json, options: KnowledgeQuery): QueryResult {
  return {id: entry.id, page: {schemaVersion: page.schemaVersion, id: page.id, layout: page.layout ?? entry.layout},
    items: options.at ? childDirectory(valueAt(page, options.at), options.at) : entry.objects};
}

function ownerFor(entry: KnowledgeExample, at: string): ExampleObject {
  const owner = entry.objects.filter(object => at === object.path || at.startsWith(object.path + '/'))
    .sort((left, right) => right.path.length - left.path.length)[0];
  if (!owner) throw new TypeError(`Example position has no component context: ${at}`);
  return owner;
}

interface FieldUse { slot: string; field: string }
function fieldUses(value: unknown): FieldUse[] {
  if (Array.isArray(value)) return value.flatMap(fieldUses);
  const item = record(value), uses: FieldUse[] = [];
  const keys = ['field', 'valueField', 'categoryField', 'secondaryField', 'badgeField', 'rowKey'];
  for (const key of keys) if (typeof item[key] === 'string') uses.push({slot: String(item.data ?? 'main'), field: item[key]});
  return [...uses, ...Object.values(item).filter(child => child !== null && typeof child === 'object').flatMap(fieldUses)];
}

function fieldDependency(page: Json, slots: Json, use: FieldUse): QueryResult {
  const sourceId = ownValue(slots, use.slot), source = record(ownValue(record(page.dataSources), String(sourceId)));
  const contract = ownValue(record(source.fields), use.field);
  const field = {kind: 'field', role: 'understanding', slot: use.slot, field: use.field};
  if (typeof sourceId !== 'string') return {...field, missing: true};
  if (contract === undefined) return {...field, source: sourceId, missing: true};
  return {...field, source: sourceId, contract,
    at: `/dataSources/${encode(sourceId)}/fields/${encode(use.field)}`};
}

function filterDependency(page: Json, id: string): QueryResult {
  const index = (page.filters ?? []).findIndex((filter: Json) => filter.id === id);
  return index < 0 ? {kind: 'filter', role: 'runtime', id, missing: true}
    : {kind: 'filter', role: 'runtime', id, at: `/filters/${index}`};
}

function runtimeDependencies(page: Json, sourceId: string): QueryResult[] {
  const source = record(ownValue(record(page.dataSources), sourceId));
  if (!source.source) return [{kind: 'source', role: 'runtime', id: sourceId, missing: true}];
  const filterIds = sourceFilterIds(source as DataSources[string]);
  const query = record(record(source.source).query);
  const params = Object.keys(record(query.paramBindings)).map(id => ({kind: 'param', role: 'runtime', id,
    at: `/dataSources/${encode(sourceId)}/source/query/paramBindings/${encode(id)}`}));
  return [{kind: 'source', role: 'runtime', id: sourceId, type: source.source.type,
    at: `/dataSources/${encode(sourceId)}/source`}, ...filterIds.map(id => filterDependency(page, id)), ...params];
}

function sourceClosure(page: Json, sourceId: string): string[] {
  const sources: DataSources = Object.assign(Object.create(null), record(page.dataSources));
  return [...conditionSourceIds({dataSources: sources}, sourceId)];
}

function componentDependencies(page: Json, componentAt: string, value: unknown): QueryResult[] {
  const slots = record(record(valueAt(page, componentAt)).data);
  if (!Object.keys(slots).length) return [];
  const fields = fieldUses(value).map(use => fieldDependency(page, slots, use));
  const sources = [...new Set(Object.values(slots).flatMap(id => sourceClosure(page, String(id))))];
  return [...fields, ...sources.flatMap(id => runtimeDependencies(page, id))];
}

function ancestorDependencies(page: Json, at: string): QueryResult[] {
  const parts = at.slice(1).split('/');
  return parts.flatMap((_, index) => {
    const path = '/' + parts.slice(0, index + 1).join('/'), ancestor = record(valueAt(page, path));
    return Object.hasOwn(ancestor, 'visibleWhen') ? [{kind: 'condition', role: 'runtime', at: path + '/visibleWhen'}] : [];
  });
}

function selectedDependencies(entry: KnowledgeExample, page: Json, options: KnowledgeQuery): QueryResult {
  if (!options.at) return needsPosition(entry);
  const value = valueAt(page, options.at), owner = ownerFor(entry, options.at);
  const children = entry.objects.filter(object => object.path.startsWith(options.at! + '/'));
  const own = componentDependencies(page, owner.path, value);
  const nested = children.flatMap(object => componentDependencies(page, object.path, valueAt(page, object.path)));
  const items = [...own, ...nested, ...ancestorDependencies(page, options.at)];
  return {id: entry.id, at: options.at, complete: true, dependenciesResolved: 'not-assessed',
    scope: 'declared component dependencies; read runtime entries before transplant',
    items: [...new Map(items.map(item => [JSON.stringify(item), item])).values()]};
}

function applicability(entry: KnowledgeExample): QueryResult {
  const base = {id: entry.id, layout: entry.layout, sourceTypes: entry.sourceTypes,
    authorConditions: 'not-provided', required: ['Verify target field types, query scope and interaction prerequisites'],
    source: entry.file};
  if (!entry.guides?.length) return base;
  return {...base, authorConditions: 'see-guide-fields', items: entry.guides.map(guideCard)};
}

function expectations(entry: KnowledgeExample): QueryResult {
  const base = {id: entry.id, status: 'not-provided', source: entry.file,
    verification: {schema: 'not-run-by-reader', browser: 'not-provided', export: 'not-provided', realData: 'not-provided'}};
  if (!entry.guides?.length) return base;
  return {...base, status: 'see-guide-fields', items: entry.guides.map(guideCard)};
}

function exampleContext(model: QueryKnowledge, entry: KnowledgeExample, at: string | undefined): QueryResult {
  if (!at) return {};
  const object = entry.objects.filter(item => at === item.path || at.startsWith(item.path + '/'))
    .sort((left, right) => right.path.length - left.path.length)[0];
  if (!object) return {};
  const owner = componentSchemaOwner(model, object.type);
  return {contextRules: owner ? rulesForOwners(model, [owner]) : [], transplantReady: 'not-assessed'};
}

/** Full files stay local; each selection exposes only its declared reading surface. */
export function showExample(model: QueryKnowledge, options: KnowledgeQuery, loader: ExampleLoader): QueryResult {
  assertExampleOptions(options, 'show');
  const entry = entryFor(model, options.id), select = options.select ?? 'card';
  if (!exampleSelections.includes(select)) throw new TypeError(`Unknown example selection: ${select}`);
  if (select === 'card') return {...exampleCard(entry), available: exampleSelections};
  if (select === 'applicability') return applicability(entry);
  if (select === 'expectations') return expectations(entry);
  if (select === 'guides') return {id: entry.id, kind: 'example', select, items: (entry.guides ?? []).map(guideCard)};
  const page = loadedPage(entry, loader);
  const handlers: Record<string, () => QueryResult> = {
    outline: () => selectedOutline(entry, page, options), snippet: () => selectedSnippet(entry, page, options),
    dependencies: () => selectedDependencies(entry, page, options), data: () => selectedPayload(entry, page, options),
    query: () => selectedPayload(entry, page, options)
  };
  const result = handlers[select]!();
  return select === 'snippet' || select === 'dependencies' ? {...result, ...exampleContext(model, entry, options.at)} : result;
}
