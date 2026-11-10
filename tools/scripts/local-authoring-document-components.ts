import { walkDocumentComponents } from '../../packages/page/src/component-walk';
import type { QueryResult } from './local-authoring-query-types';

type Json = Record<string, unknown>;
export interface DocumentComponentOptions { owner?: string; query?: string; at?: string }
export interface DocumentComponentSlot { slot: string; source: string; fieldsAt: string }
export interface DocumentComponentCard {
  componentId?: string; type?: string; documentAt: string; title?: string; tabLabels?: string[];
  slots?: DocumentComponentSlot[]; slotsStatus?: 'partial' | 'unsupported-shape'; omittedSlots?: number;
}
export type DocumentComponentDirectory = QueryResult & {
  kind: 'component'; documentAt: string; items: DocumentComponentCard[];
  read: { script: string; command: string; positionFlag: string; facets: string[] };
};
interface LocatedComponent { component: Json; documentAt: string }
interface TabContext { documentAt: string; labels: Array<string | undefined> }
const maxText = 80;
const maxSlots = 3;
const referenceId = /^[a-z0-9][a-z0-9-]*$/u;
const record = (value: unknown): Json => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const literal = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;
const encode = (value: string) => value.replaceAll('~', '~0').replaceAll('/', '~1');

function short(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const text = value.replace(/\s+/gu, ' ').trim();
  const prefix = [...text.slice(0, maxText * 2)].slice(0, maxText).join('');
  return prefix.length === text.length ? text : prefix + '…';
}

function scopePointer(at: string | undefined): string {
  const scope = at ?? '';
  if (scope !== '' && (!scope.startsWith('/') || /~(?![01])/u.test(scope))) throw new TypeError('Component scope requires a JSON Pointer');
  return scope;
}

function locatedComponents(document: unknown): LocatedComponent[] {
  const entries: LocatedComponent[] = [];
  walkDocumentComponents(document, (component, documentAt) => { entries.push({ component, documentAt }); });
  return entries;
}

function tabContexts(entries: LocatedComponent[]): TabContext[] {
  return entries.filter(entry => entry.component.type === 'tabContainer').map(entry => {
    const tabs = record(entry.component.props).tabs;
    return { documentAt: entry.documentAt, labels: Array.isArray(tabs) ? tabs.map(tab => literal(record(tab).label)) : [] };
  });
}

function ancestorLabels(documentAt: string, contexts: TabContext[]): string[] {
  return contexts.flatMap(context => {
    const prefix = `${context.documentAt}/props/tabs/`;
    if (!documentAt.startsWith(prefix)) return [];
    const index = documentAt.slice(prefix.length).split('/')[0]!;
    if (!/^(0|[1-9][0-9]*)$/u.test(index)) return [];
    const label = context.labels[Number(index)];
    return label === undefined ? [] : [label];
  });
}

function componentTitle(component: Json): string | undefined {
  const props = record(component.props), title = literal(props.title);
  if (title !== undefined) return title;
  return component.type === 'iocHeader' ? literal(record(props.identity).title) : undefined;
}

function boundedReference(value: unknown): value is string {
  return typeof value === 'string' && value.length <= maxText && referenceId.test(value);
}

/** Source bodies are never visited. These are only direct string slot references. */
function sourceSlots(component: Json): Pick<DocumentComponentCard, 'slots' | 'slotsStatus' | 'omittedSlots'> {
  if (component.data === undefined) return {};
  if (component.data === null || typeof component.data !== 'object' || Array.isArray(component.data)) return { slotsStatus: 'unsupported-shape' };
  const slots: DocumentComponentSlot[] = [];
  let omitted = 0;
  for (const [slot, source] of Object.entries(component.data)) {
    if (!boundedReference(slot) || !boundedReference(source) || slots.length === maxSlots) { omitted++; continue; }
    slots.push({ slot, source, fieldsAt: `/dataSources/${encode(source)}/fields` });
  }
  return { ...(slots.length ? { slots } : {}), ...(omitted ? { slotsStatus: 'partial', omittedSlots: omitted } : {}) };
}

function matches(entry: LocatedComponent, labels: string[], options: DocumentComponentOptions): boolean {
  if (options.owner !== undefined && entry.component.type !== options.owner) return false;
  const text = [literal(entry.component.id), literal(entry.component.type), componentTitle(entry.component), ...labels].join(' ').toLocaleLowerCase();
  const words = (options.query ?? '').toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return words.every(word => text.includes(word));
}

function card(entry: LocatedComponent, labels: string[]): DocumentComponentCard {
  const componentId = short(literal(entry.component.id)), type = short(literal(entry.component.type));
  const title = short(componentTitle(entry.component));
  return { documentAt: entry.documentAt, ...(componentId === undefined ? {} : { componentId }),
    ...(type === undefined ? {} : { type }), ...(title === undefined ? {} : { title }),
    ...(labels.length ? { tabLabels: labels.map(label => short(label)!) } : {}), ...sourceSlots(entry.component) };
}

/** A safe discovery directory over raw repair documents, independent of page validation. */
export function findDocumentComponents(document: unknown, options: DocumentComponentOptions = {}): DocumentComponentDirectory {
  const at = scopePointer(options.at), entries = locatedComponents(document), tabs = tabContexts(entries);
  const items = entries.filter(entry => entry.documentAt === at || entry.documentAt.startsWith(at + '/'))
    .flatMap(entry => {
      const labels = ancestorLabels(entry.documentAt, tabs);
      return matches(entry, labels, options) ? [card(entry, labels)] : [];
    });
  return { kind: 'component', documentAt: at, items, read: { script: 'analyze-data.mjs', command: 'scan',
    positionFlag: '--at', facets: ['config', 'bindings', 'fields', 'consumers', 'samples'] } };
}
