/** Explicit, no-I/O reading facets over existing product scan facts. */
import { walkDocumentComponents } from '../../../packages/page/src/component-walk';
import { affectedSourceIds, conditionSourceIds } from '../../../packages/page/src/data-source-references';
import { scanPageData, type DataUse } from './data-scan';
import { configReading, contractReading, sampleReading, fieldContractItems } from './data-read-values';
import { within, encode, pointerValue } from './data-read-location';

type Json = Record<string, any>;
export interface DataReadOptions {
  at?: string; component?: string; select: string; fields?: string[]; source?: string;
  limit?: number; cursor?: string;
}
export interface DataReadLocation { id: string; type: string; path: string; component: Json }
export function componentLocations(page: Json): DataReadLocation[] {
  const result: DataReadLocation[] = [];
  walkDocumentComponents(page, (component, path) => result.push({ id: String(component.id ?? ''), type: String(component.type ?? ''), path, component }));
  return result;
}
function selectedLocation(page: Json, options: DataReadOptions, locations: DataReadLocation[]): DataReadLocation {
  if (Boolean(options.at) === Boolean(options.component)) throw new TypeError('Select exactly one --at or unique --component');
  if (options.component !== undefined) {
    const matches = locations.filter(location => location.id === options.component);
    if (matches.length !== 1) throw new TypeError('Component id is missing or ambiguous; use the component directory and an exact --at');
    return matches[0]!;
  }
  pointerValue(page, options.at!);
  const matches = locations.filter(location => within(options.at!, location.path)).sort((a, b) => b.path.length - a.path.length);
  if (!matches.length) throw new TypeError('--at must locate a real component or its configuration');
  return matches[0]!;
}
function trustedUse(page: Json, use: DataUse): boolean {
  if (use.source !== undefined && typeof use.source !== 'string') return false;
  if (use.kind !== 'data-slot') return true;
  const marker = use.path.lastIndexOf('/data/');
  if (marker < 0) return false;
  const data = pointerValue(page, use.path.slice(0, marker) + '/data');
  const slot = use.path.slice(marker + 6).replaceAll('~1', '/').replaceAll('~0', '~');
  return Boolean(data && typeof data === 'object' && !Array.isArray(data) && typeof data[slot] === 'string' && data[slot] === use.source);
}
function selectedUses(page: Json, uses: DataUse[], at: string): DataUse[] {
  return uses.filter(use => within(use.path, at) && trustedUse(page, use));
}

function graphSource(definition: Json): boolean {
  const source = definition?.source;
  if (!source || typeof source.type !== 'string') return false;
  if (definition.compute !== undefined && !Array.isArray(definition.compute)) return false;
  if (source.type === 'query') return Boolean(source.query && (!source.query.resultBindings || Array.isArray(source.query.resultBindings)));
  if (source.type === 'pagedJoin' || source.type === 'pagedUnion') return Boolean(source.members && Object.values(source.members).every((member: any) => typeof member?.source === 'string'));
  return true;
}
function graphSources(page: Json): Json {
  return Object.fromEntries(Object.entries(page.dataSources ?? {}).filter(([, definition]) => graphSource(definition as Json)));
}
function sourceIds(page: Json, uses: DataUse[], selected: DataReadLocation): string[] {
  const slots = selected.component.data;
  const direct = Object.values(slots && typeof slots === 'object' && !Array.isArray(slots) ? slots : {}).filter((id): id is string => typeof id === 'string' && id.length > 0);
  const seeds = [...direct, ...uses.flatMap(use => typeof use.source === 'string' && use.source ? [use.source] : [])];
  const ids = seeds.flatMap(id => [...conditionSourceIds({ dataSources: graphSources(page) }, id)]);
  return [...new Set([...seeds, ...ids])];
}
function fieldItems(scan: ReturnType<typeof scanPageData>, ids: string[], options: DataReadOptions, schema: Json): Json[] {
  const selected = options.source === undefined ? ids : [options.source];
  const items = selected.flatMap(source => Object.entries(scan.sources[source]?.fields ?? {}).flatMap(([field, contract]) => {
    if (options.fields && !options.fields.includes(field)) return [];
    return fieldContractItems(source, field, `/dataSources/${encode(source)}/fields/${encode(field)}`, contractReading(contract, schema));
  }));
  for (const field of options.fields ?? []) if (!items.some(item => item.field === field)) throw new TypeError(`Unknown selected field: ${field}`);
  return items;
}
function bindingItems(uses: DataUse[], fields: string[] | undefined): Json[] {
  return uses.filter(use => !fields || fields.includes(use.field ?? '')).map(use => ({
    at: use.path, kind: use.kind, ...(use.source === undefined ? {} : { source: use.source }),
    ...(use.slot === undefined ? {} : { slot: use.slot }), ...(use.field === undefined ? {} : { field: use.field }),
    ...(use.recordListField === undefined ? {} : { recordListField: use.recordListField })
  }));
}
function consumerItems(uses: DataUse[], ids: string[], locations: DataReadLocation[]): Json[] {
  return locations.filter(location => uses.some(use => ids.includes(use.source ?? '') && within(use.path, location.path)))
    .map(({ id, type, path }) => ({ componentId: id, type, at: path }));
}
function validateFacet(options: DataReadOptions): void {
  if (!['config', 'bindings', 'fields', 'consumers', 'samples'].includes(options.select)) throw new TypeError('Unknown scan reading facet');
  if (options.select === 'samples') {
    if (!options.source || !options.fields?.length || options.limit === undefined) throw new TypeError('samples requires explicit --source, --field and --limit');
  } else if (options.source && options.select !== 'fields') throw new TypeError('--source is only accepted by fields or samples');
  if (options.fields && !['fields', 'bindings', 'samples'].includes(options.select)) throw new TypeError('--field is only accepted by fields, bindings or samples');
}
function bindingGaps(scan: ReturnType<typeof scanPageData>, at: string): Json[] {
  return scan.diagnostics.filter(diagnostic => typeof diagnostic.path === 'string' && within(diagnostic.path, at))
    .map(diagnostic => ({ type: diagnostic.type, at: diagnostic.path }));
}
function pageMetadata(page: Json): Json {
  const keys = ['id', 'schemaVersion', 'layout'];
  const values = keys.flatMap(key => typeof page[key] === 'string' && [...page[key]].length <= 120 ? [[key, page[key]]] : []);
  return { ...Object.fromEntries(values), ...(values.length === keys.length ? {} : { status: 'partial' }) };
}
function sourceItems(scan: ReturnType<typeof scanPageData>, ids: string[]): Json[] {
  return ids.map(id => {
    const type = scan.sources[id]?.source?.type;
    const known = typeof type === 'string' && type.length > 0 && type.length <= 40;
    return { kind: 'source', id, type: known ? type : 'unknown', ...(known ? {} : { status: 'unknown' }) };
  });
}
function readBase(page: Json, options: DataReadOptions, at: string, componentAt: string, scan: ReturnType<typeof scanPageData>, ids: string[]): Json {
  const gaps = bindingGaps(scan, at);
  const missing = sourceItems(scan, ids).filter(item => item.status === 'unknown').map(item => ({ type: 'UNKNOWN_SOURCE', source: item.id }));
  const graphGaps = ids.filter(id => !graphSource(page.dataSources?.[id])).map(source => ({ type: 'UNRESOLVED_SOURCE_GRAPH', source }));
  const unresolved = options.select !== 'config' && gaps.length + missing.length + graphGaps.length > 0 ? { status: 'unresolved', complete: false, unresolved: [...gaps, ...missing, ...graphGaps] } : {};
  return { kind: 'target', select: options.select, documentAt: at, componentAt, page: pageMetadata(page), complete: true, ...unresolved };
}
/** Only returns requested facts; paging and document/schema identity belong to the CLI adapter. */
export function readPageData(page: Json, schema: Json, options: DataReadOptions): Json {
  validateFacet(options);
  const locations = componentLocations(page), selected = selectedLocation(page, options, locations);
  const at = options.at ?? selected.path;
  const scan = scanPageData(page, schema), uses = selectedUses(page, scan.uses, at), ids = sourceIds(page, uses, selected);
  if (options.source && !ids.includes(options.source)) throw new TypeError('Selected source is outside the component reading scope');
  const base = readBase(page, options, at, selected.path, scan, ids);
  switch (options.select) {
    case 'config': return { ...base, ...configReading(page, at) };
    case 'bindings': if (options.fields) fieldItems(scan, ids, options, schema); return { ...base, items: [...sourceItems(scan, ids), ...bindingItems(uses, options.fields)] };
    case 'fields': return { ...base, items: fieldItems(scan, ids, options, schema) };
    case 'consumers': return { ...base, items: consumerItems(scan.uses.filter(use => trustedUse(page, use)), [...affectedSourceIds(graphSources(page), ids)], locations) };
    case 'samples': fieldItems(scan, ids, options, schema); return { ...base, ...sampleReading(page, options) };
    default: throw new TypeError('Unknown scan reading facet');
  }
}
