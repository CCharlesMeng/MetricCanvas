import { resolveDocumentContext, type DocumentContext } from './local-authoring-document-context';
import { digest } from './local-authoring-knowledge-core';
import { showSchema } from './local-authoring-schema-query';
import { textWindows } from './local-authoring-text-windows';
import type { KnowledgeQuery, QueryKnowledge, QueryResult } from './local-authoring-query-types';

export interface ContractRegistration {
  owners: string[];
  targets: string[];
  scope: string;
  coverage: 'registered' | 'partial';
  structures: string[];
  semantics: Array<{ module: string; headings: string[]; overview?: boolean }>;
  examples: string[];
}
interface ContractSource { id: string; module: string; section: number; file: string; sha256: string }
export interface ContractBinding extends Omit<ContractRegistration, 'semantics'> {
  aspect: string;
  semantics: ContractSource[];
}

function semanticSources(model: QueryKnowledge, selection: ContractRegistration['semantics'][number]): ContractSource[] {
  const module = model.modules[selection.module];
  if (!module) throw new Error(`Unknown contract module: ${selection.module}`);
  const sections = selection.overview ? [0] : [];
  for (const heading of selection.headings) {
    const index = module.semantics.findIndex(text => text.split('\n')[0] === `## ${heading}`);
    if (index < 0) throw new Error(`Missing contract heading: ${selection.module}: ${heading}`);
    sections.push(index);
  }
  return [...new Set(sections)].map(section => ({ id: `semantic:${selection.module}:${section}`,
    module: selection.module, section, file: module.file, sha256: digest(module.semantics[section]!) }));
}

function validateRegistration(model: QueryKnowledge, aspect: string, entry: ContractRegistration): void {
  if (!entry.owners.length || !entry.targets.length || !entry.scope || !entry.semantics.length) throw new Error(`Incomplete contract: ${aspect}`);
  if (!['registered', 'partial'].includes(entry.coverage)) throw new Error(`Invalid contract coverage: ${aspect}`);
  for (const owner of entry.owners) {
    if (!Object.hasOwn(model.schema.definitions ?? {}, owner)) throw new Error(`Unknown contract owner: ${owner}`);
  }
  for (const pointer of [...entry.targets, ...entry.structures]) showSchema(model, { id: `schema:${pointer}`, select: 'shape' });
  for (const id of entry.examples) {
    if (!model.examples?.some(example => example.id === id)) throw new Error(`Unknown contract example: ${id}`);
  }
}

/** Associations are authored; protocol prose and structure remain in their product sources. */
export function buildContractBindings(model: QueryKnowledge, registrations: Record<string, ContractRegistration> = {}): ContractBinding[] {
  return Object.entries(registrations).map(([aspect, entry]) => {
    validateRegistration(model, aspect, entry);
    const semantics = entry.semantics.flatMap(selection => semanticSources(model, selection));
    return { ...entry, aspect, semantics: [...new Map(semantics.map(source => [source.id, source])).values()] };
  });
}

function applies(entry: ContractBinding, context: DocumentContext): boolean {
  const pointer = context.id?.replace(/^schema:/u, '') ?? '';
  return entry.owners.some(owner => context.enclosingOwners.includes(owner))
    && entry.targets.includes(pointer);
}

function textItems(model: QueryKnowledge, source: ContractSource): QueryResult[] {
  const text = model.modules[source.module]?.semantics[source.section];
  if (text === undefined || digest(text) !== source.sha256) throw new Error(`Stale contract source: ${source.id}`);
  return textWindows(text).map(window => ({ kind: 'semantic', source: source.id, ...window }));
}

function structureItems(model: QueryKnowledge, entry: ContractBinding): QueryResult[] {
  return entry.structures.map(pointer => {
    const shape = showSchema(model, { id: `schema:${pointer}`, select: 'shape' });
    const items = shape.items as QueryResult[];
    const values = items.filter(item => item.kind === 'enum').map(item => item.value);
    return { ...shape, kind: 'structure', items: items.filter(item => item.kind !== 'enum'),
      ...(values.length ? { enum: values } : {}) };
  });
}

function documentValue(document: unknown, at: string): unknown {
  return at.slice(1).split('/').reduce((value: any, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], document);
}

function childContexts(model: QueryKnowledge, document: unknown, at: string): DocumentContext[] {
  const value = documentValue(document, at);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).map(key => resolveDocumentContext(model, document,
    `${at}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`));
}

/** Follow Schema roles, not the spelling of the object's keys. */
function staticBindingLocations(model: QueryKnowledge, document: unknown, context: DocumentContext): QueryResult[] {
  if (context.status !== 'resolved') return [];
  if (context.owner === 'staticFieldBinding') return [{ kind: 'binding', documentAt: context.documentAt, schema: context.id }];
  if (!context.enclosingOwners.includes('fieldBinding')) return [];
  return childContexts(model, document, context.documentAt).flatMap(child => staticBindingLocations(model, document, child));
}

function bindingProblem(model: QueryKnowledge, document: unknown, context: DocumentContext, aspect: string): QueryResult | undefined {
  const children = childContexts(model, document, context.documentAt);
  const unresolved = children.find(child => child.status !== 'resolved');
  if (unresolved) return unresolvedResult(unresolved, aspect, 'Resolve the actual target branch before applying this contract');
  const conditional = children.find(child => child.owner === 'fieldBinding');
  if (!conditional) return undefined;
  return { ...unresolvedResult(context, aspect, 'Conditional binding: select the actual static case binding; this response does not cover filter selection'),
    status: 'needs-context', items: staticBindingLocations(model, document, conditional) };
}

function unresolvedResult(context: DocumentContext, aspect: string, reason: string): QueryResult {
  return { kind: 'contract', aspect, status: context.status === 'resolved' ? 'unregistered' : context.status,
    documentContext: context, coverage: 'partial', complete: false, acceptance: 'not-assessed',
    unresolved: [reason], items: [] };
}

/** Resolve a registered question at an actual Schema position without searching examples. */
export function resolveDocumentContract(model: QueryKnowledge, options: KnowledgeQuery, document: unknown): QueryResult {
  if (options.at === undefined || !options.aspect) throw new TypeError('resolve requires --at and --aspect');
  const entries = model.contracts ?? [];
  if (!entries.some(entry => entry.aspect === options.aspect)) throw new TypeError(`Unknown contract aspect: ${options.aspect}; available: ${entries.map(entry => entry.aspect).join(', ')}`);
  const context = resolveDocumentContext(model, document, options.at);
  if (context.status !== 'resolved') return unresolvedResult(context, options.aspect, 'Resolve target context before selecting contract rules');
  const entry = model.contracts?.find(candidate => candidate.aspect === options.aspect && applies(candidate, context));
  if (!entry) return unresolvedResult(context, options.aspect, 'No registered association for this aspect and exact Schema position');
  const problem = bindingProblem(model, document, context, options.aspect);
  if (problem) return problem;
  return { kind: 'contract', aspect: entry.aspect, status: 'resolved', documentContext: context,
    coverage: entry.coverage, scope: entry.scope, acceptance: 'not-assessed',
    complete: true, unresolved: entry.coverage === 'partial' ? ['Association coverage is partial'] : [],
    sources: entry.semantics.map(({ id, file, sha256 }) => ({ id, file, sha256 })),
    examples: entry.examples, items: [...structureItems(model, entry), ...entry.semantics.flatMap(source => textItems(model, source))] };
}
