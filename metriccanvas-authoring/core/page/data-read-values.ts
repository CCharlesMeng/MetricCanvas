/** Value projection is deliberately separate from discovery and binding resolution. */
import type { DataReadOptions } from './data-read';
import { encode, pointerValue } from './data-read-location';
type Json = Record<string, any>;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
const own = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};

type ConfigContext = 'config' | 'source' | 'query';
function sourceDescriptor(value: unknown): boolean {
  const object = own(value);
  return ['inline', 'query', 'pagedJoin', 'pagedUnion'].includes(object.type) || Array.isArray(object.rows) || Object.hasOwn(own(object.query), 'body');
}
function childContext(parent: ConfigContext, key: string, value: unknown): ConfigContext {
  if (key === 'source' && sourceDescriptor(value)) return 'source';
  return parent === 'source' && key === 'query' ? 'query' : 'config';
}
function omittedKey(key: string, context: ConfigContext): boolean {
  if (context === 'source') return key === 'rows' || key === 'initial';
  return context === 'query' && (key === 'body' || key === 'initial');
}
function configValue(value: unknown, excluded: string[], at: string, context: ConfigContext): unknown {
  if (Array.isArray(value)) return value.map((item, index) => configValue(item, excluded, `${at}/${index}`, 'config'));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
    omittedKey(key, context) ? excludedValue(excluded, `${at}/${encode(key)}`) : configValue(child, excluded, `${at}/${encode(key)}`, childContext(context, key, child))]));
}
function excludedValue(excluded: string[], at: string): unknown {
  excluded.push(at);
  return { status: 'excluded-data-payload' };
}
function configPath(page: Json, at: string): ConfigContext {
  const tokens = at.split('/').slice(1).map(token => token.replaceAll('~1', '/').replaceAll('~0', '~'));
  let value: unknown = page;
  let context: ConfigContext = 'config';
  for (const token of tokens) {
    if (omittedKey(token, context)) throw new TypeError('Data payload positions require explicit samples; source query bodies are not a config facet');
    value = (value as Json)[token];
    context = childContext(context, token, value);
  }
  return context;
}
function shortIdentity(value: unknown): string | undefined {
  return typeof value === 'string' ? [...value].slice(0, 80).join('') : undefined;
}
function directoryIdentity(value: unknown): Json {
  const object = own(value);
  const result = Object.fromEntries(['id', 'title', 'label'].flatMap(key => {
    const text = shortIdentity(object[key]);
    return text === undefined ? [] : [[key, text]];
  }));
  const field = shortIdentity(typeof object.field === 'string' ? object.field : own(object.field).field);
  return { ...result, ...(field === undefined ? {} : { field }) };
}
function directory(value: unknown, at: string): Json[] {
  return Object.entries(value as Json).map(([key, child]) => ({ at: `${at}/${encode(key)}`,
    type: Array.isArray(child) ? 'array' : typeof child, bytes: bytes(child), ...directoryIdentity(child) }));
}
function textWindows(text: string): Json[] {
  const points = [...text], result: Json[] = [];
  for (let offset = 0; offset < points.length; offset += 200) result.push({ offset, text: points.slice(offset, offset + 200).join('') });
  return result;
}
export function configReading(page: Json, at: string): Json {
  const raw = pointerValue(page, at), context = configPath(page, at);
  const excluded: string[] = [];
  const value = configValue(raw, excluded, at, context);
  if (bytes(value) <= 1100) return { value, ...(excluded.length ? { complete: false, excludedPositions: excluded } : {}) };
  if (typeof value === 'string') return { representation: 'text-windows', length: value.length, items: textWindows(value) };
  return { status: 'needs-expand', complete: false, items: directory(value, at) };
}
function schemaNode(schema: Json, ref: string): Json {
  return ref.slice(2).split('/').reduce((value, key) => value?.[key], schema);
}
function keysFor(schema: Json, node: Json, visited = new Set<string>()): string[] {
  if (!node) return [];
  if (node.$ref) {
    if (visited.has(node.$ref)) return [];
    visited.add(node.$ref);
    return keysFor(schema, schemaNode(schema, node.$ref), visited);
  }
  const keys = Object.keys(node.properties ?? {});
  for (const branch of [...(node.anyOf ?? []), ...(node.oneOf ?? []), ...(node.allOf ?? [])]) keys.push(...keysFor(schema, branch, visited));
  return keys;
}
export function contractReading(contract: unknown, schema: Json): Json {
  const keys = new Set([...keysFor(schema, schema.definitions?.field), ...keysFor(schema, schema.definitions?.queryField)]);
  const result = Object.fromEntries(Object.entries(own(contract)).filter(([key]) => keys.has(key) && key !== 'items'));
  if (own(contract).items) result.items = { fields: Object.fromEntries(Object.entries(own(own(contract).items).fields ?? {}).map(([key, child]) => [key, contractReading(child, schema)])) };
  return result;
}
function boundedSample(value: unknown): unknown {
  if (value === undefined) return { status: 'missing' };
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string' && bytes(value) <= 256) return value;
  return { status: 'omitted', reason: 'Long or structured sample value; full-value sample reading is not supported', type: Array.isArray(value) ? 'array' : typeof value, bytes: bytes(value) };
}
function existingRows(definition: Json): { rows: Json[]; origin: string } | undefined {
  if (definition.source?.type === 'inline' && Array.isArray(definition.source.rows)) return { rows: definition.source.rows, origin: 'declared-inline' };
  if (Array.isArray(definition.source?.initial)) return { rows: definition.source.initial, origin: 'source-initial' };
  if (Array.isArray(definition.initial)) return { rows: definition.initial, origin: 'data-source-initial' };
  return undefined;
}
export function sampleReading(page: Json, options: DataReadOptions): Json {
  const declared = existingRows(page.dataSources?.[options.source!] ?? {});
  if (!declared) return { status: 'not-available', complete: false, execution: 'not-run', reason: 'No declared inline/initial rows; query bodies are never sampled or executed' };
  const items = declared.rows.slice(0, options.limit).map((row: Json, index: number) => ({ index,
    values: Object.fromEntries(options.fields!.map(field => [field, boundedSample(row[field])])) }));
  const complete = items.every(item => Object.values(item.values).every(value => own(value).status !== 'omitted'));
  return { source: options.source, rowLimit: options.limit, origin: declared.origin, execution: 'not-run', complete, items };
}

export function fieldContractItems(source: string, field: string, at: string, contract: Json): Json[] {
  if (bytes(contract) <= 900) return [{ source, field, at, contract }];
  const text = JSON.stringify(contract);
  return textWindows(text).map(window => ({ source, field, at, representation: 'json-windows', length: text.length, ...window }));
}
