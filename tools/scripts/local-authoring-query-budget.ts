import { digest } from './local-authoring-knowledge-core';
import type { KnowledgeQuery, QueryResult } from './local-authoring-query-types';

export const FIND_BYTES = 1024;
export const SHOW_BYTES = 2048;
export const RESOLVE_BYTES = 8192;
export const jsonBytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value)) + 1;

/** Cursor binds the exact request and result; a changed package/source cannot reuse it. */
export function queryPage(result: QueryResult, options: KnowledgeQuery, command: string, revision = ''): QueryResult {
  const budget = {find: FIND_BYTES, resolve: RESOLVE_BYTES}[command] ?? SHOW_BYTES;
  const query = Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'cursor')
    .sort(([left], [right]) => left.localeCompare(right)));
  const signature = digest(JSON.stringify({command, query, result, revision})).slice(0, 16);
  const start = cursorStart(options.cursor, signature);
  const selected = expandableValue(result, budget);
  if (!Array.isArray(selected.items)) return boundedObject(selected, budget);
  if (start > selected.items.length) throw new TypeError('Cursor outside query result');
  return itemPage(selected, options, budget, signature, start);
}

function expandableValue(result: QueryResult, budget: number): QueryResult {
  if (jsonBytes(result) <= budget || !result.value || typeof result.value !== 'object' || typeof result.at !== 'string') return result;
  const {value, ...metadata} = result;
  const items = Object.entries(value).map(([key, child]) => ({
    at: `${result.at}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
    type: Array.isArray(child) ? 'array' : typeof child, bytes: jsonBytes(child)
  }));
  return {...metadata, status: 'needs-expand', complete: false, items};
}

function cursorStart(cursor: string | undefined, signature: string): number {
  if (!cursor) return 0;
  const match = /^([a-f0-9]{16}):(0|[1-9]\d*)$/.exec(cursor);
  if (!match || match[1] !== signature) throw new TypeError('Stale or mismatched query cursor; repeat the initial query');
  const offset = Number(match[2]);
  if (!Number.isSafeInteger(offset)) throw new TypeError('Invalid cursor offset');
  return offset;
}

function itemPage(result: QueryResult, options: KnowledgeQuery, budget: number, signature: string, start: number): QueryResult {
  const source = result.items as unknown[];
  const page: QueryResult = {...result, items: [], total: source.length, offset: start, complete: false};
  const limit = options.limit ?? 5;
  let end = start;
  while (end < source.length && end - start < limit) {
    const candidate = {...page, items: [...page.items as unknown[], source[end]], complete: responseComplete(result, end + 1 === source.length),
      ...(end + 1 < source.length ? {next: `${signature}:${end + 1}`} : {})};
    if (jsonBytes(candidate) > budget) break;
    page.items = candidate.items; end++;
  }
  page.complete = responseComplete(result, end === source.length);
  if (end < source.length) page.next = `${signature}:${end}`;
  if (end === start && end < source.length) return oversizedItem(result, source[end], budget, start);
  return boundedObject(page, budget);
}

function responseComplete(result: QueryResult, pageComplete: boolean): boolean {
  return pageComplete && result.complete !== false && !String(result.status ?? '').startsWith('needs-');
}

function oversizedItem(result: QueryResult, item: unknown, budget: number, offset: number): QueryResult {
  return boundedObject({id: result.id, kind: result.kind, status: 'needs-expand', complete: false, offset,
    bytes: jsonBytes(item), target: itemIdentity(item), available: result.available,
    message: 'The next item exceeds this view budget. Select its returned id/path or a narrower facet; no content was truncated.'}, budget);
}

function itemIdentity(item: unknown): unknown {
  if (!item || typeof item !== 'object') return undefined;
  const value = item as Record<string, unknown>;
  return Object.fromEntries(['id', 'at', 'path', 'pointer', 'owner', 'documentAt', 'componentId'].filter(key => typeof value[key] === 'string').map(key => [key, value[key]]));
}

function boundedObject(result: QueryResult, budget: number): QueryResult {
  if (jsonBytes(result) <= budget) return result;
  return {id: result.id, kind: result.kind, status: 'needs-expand', complete: false, bytes: jsonBytes(result),
    message: 'Select a specific object/branch or facet. The complete value was not emitted.'};
}
