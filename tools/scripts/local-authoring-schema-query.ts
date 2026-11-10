import type { KnowledgeQuery, QueryKnowledge, QueryResult } from './local-authoring-query-types';
import { rulesForOwners } from './local-authoring-query-rules';

type Schema = Record<string, any>;
interface Location {
  pointer: string; owner: string; path: string; parent?: string;
  branches: string[]; parentRequired: string[]; enclosing: ConstraintContext[];
}
interface ConstraintContext { id: string; operator: string; required: string[]; constraints: Schema }
interface LocatedNode extends Location { schema: Schema }
const branchKeys = ['anyOf', 'oneOf', 'allOf'] as const;
const schemaKeys = new Set(['properties', 'patternProperties', 'items', 'definitions', '$defs',
  '$ref', 'description', 'title', 'required', 'enum', ...branchKeys, 'if', 'then', 'else', 'not', 'contains']);
const facets = ['placement', 'shape', 'rules', 'example', 'explain'];

const token = (value: string) => value.replaceAll('~', '~0').replaceAll('/', '~1');
const schemaId = (pointer: string) => `schema:${pointer}`;
const definitionName = (pointer: string) => pointer.split('/')[2]?.replaceAll('~1', '/').replaceAll('~0', '~') ?? 'page';

function schemaAt(model: QueryKnowledge, pointer: string): Schema {
  if (pointer === '#') return model.schema;
  if (!pointer.startsWith('#/')) throw new TypeError(`Unknown schema pointer: ${pointer}`);
  let value: any = model.schema;
  for (const part of pointer.slice(2).split('/')) {
    const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!value || !Object.hasOwn(value, key)) throw new TypeError(`Unknown schema pointer: ${pointer}`);
    value = value[key];
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Not a schema object: ${pointer}`);
  return value;
}

function resourcePointer(id: string | undefined): string {
  if (!id?.startsWith('schema:')) throw new TypeError('Expected --id schema:<Schema Pointer>');
  return id.slice('schema:'.length);
}

function propertyName(pointer: string): string {
  const match = /\/(?:properties|patternProperties)\/([^/]+)(?:\/|$)/g;
  return [...pointer.matchAll(match)].at(-1)?.[1]?.replaceAll('~1', '/').replaceAll('~0', '~') ?? definitionName(pointer);
}

function parentObject(model: QueryKnowledge, pointer: string): Schema | undefined {
  const index = pointer.lastIndexOf('/properties/');
  return index < 0 ? undefined : schemaAt(model, pointer.slice(0, index));
}

function seed(model: QueryKnowledge, pointer: string, owner: string): LocatedNode {
  return { pointer, owner, path: owner, branches: [], parentRequired: [], enclosing: [], schema: schemaAt(model, pointer) };
}

function ownerSeeds(model: QueryKnowledge, owner: string): LocatedNode[] {
  if (owner === 'page') return [seed(model, '#', owner)];
  if (Object.hasOwn(model.schema.definitions ?? {}, owner)) return [seed(model, `#/definitions/${token(owner)}`, owner)];
  const roots = model.nodes.filter(node => node.module === owner && /^#\/definitions\/[^/]+$/.test(node.pointer));
  if (!roots.length) throw new TypeError(`Unknown schema owner: ${owner}`);
  return roots.map(node => seed(model, node.pointer, definitionName(node.pointer)));
}

function childLocation(parent: LocatedNode, pointer: string, path: string): LocatedNode {
  return { pointer, owner: parent.owner, path, parent: parent.pointer, branches: parent.branches,
    parentRequired: parent.schema.required ?? [], enclosing: parent.enclosing, schema: {} };
}

function propertyChildren(node: LocatedNode): LocatedNode[] {
  const children: LocatedNode[] = [];
  for (const [name, schema] of Object.entries(node.schema.properties ?? {})) {
    children.push({ ...childLocation(node, `${node.pointer}/properties/${token(name)}`, `${node.path}.${name}`), schema: schema as Schema });
  }
  for (const [name, schema] of Object.entries(node.schema.patternProperties ?? {})) {
    children.push({ ...childLocation(node, `${node.pointer}/patternProperties/${token(name)}`, `${node.path}{${name}}`), schema: schema as Schema });
  }
  return children;
}

function branchChildren(node: LocatedNode): LocatedNode[] {
  return branchKeys.flatMap(keyword => (node.schema[keyword] ?? []).map((schema: Schema, index: number) => ({
    ...node, schema, pointer: `${node.pointer}/${keyword}/${index}`,
    branches: [...node.branches, schemaId(`${node.pointer}/${keyword}/${index}`)],
    enclosing: [...node.enclosing, ...branchContext(node, keyword)]
  })));
}

function branchContext(node: LocatedNode, operator: string): ConstraintContext[] {
  const ownConstraints = constraints(node.schema), required: string[] = node.schema.required ?? [];
  if (!required.length && !Object.keys(ownConstraints).length) return [];
  return [{ id: schemaId(node.pointer), operator, required, constraints: ownConstraints }];
}

function referenceChildren(model: QueryKnowledge, node: LocatedNode): LocatedNode[] {
  if (!node.schema.$ref) return [];
  return [{ ...node, pointer: node.schema.$ref, schema: schemaAt(model, node.schema.$ref) }];
}

function otherChildren(node: LocatedNode): LocatedNode[] {
  const children: LocatedNode[] = [];
  for (const keyword of ['items', 'additionalProperties', 'if', 'then', 'else', 'not', 'contains']) {
    const schema = node.schema[keyword];
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) continue;
    const path = keyword === 'items' ? `${node.path}[]` : node.path;
    children.push({ ...childLocation(node, `${node.pointer}/${keyword}`, path), schema });
  }
  return children;
}

/** One shortest usage path per canonical node keeps recursive definitions finite. */
function usages(model: QueryKnowledge, owner: string): LocatedNode[] {
  const queue = ownerSeeds(model, owner), result: LocatedNode[] = [], seen = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index]!;
    if (seen.has(node.pointer)) continue;
    seen.add(node.pointer); result.push(node);
    queue.push(...propertyChildren(node), ...branchChildren(node), ...referenceChildren(model, node), ...otherChildren(node));
  }
  return result;
}

function canonicalNodes(model: QueryKnowledge): LocatedNode[] {
  return model.nodes.map(node => ({ pointer: node.pointer, owner: definitionName(node.pointer), path: node.path,
    branches: [], parentRequired: parentObject(model, node.pointer)?.required ?? [], enclosing: [], schema: schemaAt(model, node.pointer) }));
}

function queryWords(query: string): string[] {
  const words = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(query.toLowerCase())];
  return words.filter(word => word.isWordLike).map(word => word.segment);
}

function searchScore(model: QueryKnowledge, node: LocatedNode, query: string, words: string[]): number {
  const note = model.nodes.find(item => item.pointer === node.pointer)?.note ?? '';
  const name = propertyName(node.pointer).toLowerCase();
  const text = `${name} ${note} ${node.schema.title ?? ''} ${node.schema.description ?? ''}`.toLowerCase();
  const exact = name === query.toLowerCase() ? 100 : 0;
  return exact + words.filter(word => text.includes(word)).length;
}

function placement(node: LocatedNode): QueryResult {
  return { owner: node.owner, path: node.path, parent: node.parent ? schemaId(node.parent) : undefined,
    parentRequired: node.parentRequired, branches: node.branches, enclosing: node.enclosing };
}

function rejectOptions(options: KnowledgeQuery, names: Array<keyof KnowledgeQuery>): void {
  for (const name of names) if (options[name] !== undefined) throw new TypeError(`Schema query does not accept --${name}`);
}

/** Owner-scoped search follows references; unrelated structures never enter its result. */
export function findSchema(model: QueryKnowledge, options: KnowledgeQuery): QueryResult {
  rejectOptions(options, ['id', 'select', 'at', 'branch']);
  const nodes = options.owner ? usages(model, options.owner) : canonicalNodes(model);
  const query = options.query ?? '', words = queryWords(query);
  const properties = nodes.filter(node => /\/(?:properties|patternProperties)\/[^/]+$/.test(node.pointer));
  const matches = properties.map(node => ({ node, score: query ? searchScore(model, node, query, words) : 1 }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.node.path.localeCompare(b.node.path));
  return { kind: 'schema', owner: options.owner, scope: options.owner
    ? 'one shortest usage path per canonical schema node' : 'schema definition locations; pass owner to resolve a usage path',
    items: matches.map(({ node }) => ({ id: schemaId(node.pointer), ...placement(node) })) };
}

function locatedResource(model: QueryKnowledge, pointer: string, owner: string | undefined): LocatedNode {
  const schema = schemaAt(model, pointer);
  if (owner) {
    const found = usages(model, owner).find(node => node.pointer === pointer);
    if (!found) throw new TypeError(`Schema node is not reachable from owner ${owner}: ${pointer}`);
    return found;
  }
  const known = model.nodes.find(node => node.pointer === pointer);
  const parent = pointer.includes('/properties/') ? pointer.slice(0, pointer.lastIndexOf('/properties/')) : undefined;
  return { pointer, schema, owner: definitionName(pointer), path: known?.path ?? pointer, parent,
    parentRequired: parentObject(model, pointer)?.required ?? [], branches: [], enclosing: [] };
}

function selectedResource(model: QueryKnowledge, options: KnowledgeQuery): LocatedNode {
  const pointer = resourcePointer(options.id), located = locatedResource(model, pointer, options.owner);
  if (!options.branch) return located;
  const branch = resourcePointer(options.branch);
  const available = [...branchChildren(located), ...referenceChildren(model, located)];
  const selected = available.find(node => node.pointer === branch);
  if (!selected) throw new TypeError(`Unknown branch of ${options.id}: ${options.branch}`);
  return selected;
}

function constraints(schema: Schema): Schema {
  return Object.fromEntries(Object.entries(schema).filter(([key, value]) => !schemaKeys.has(key)
    && !(key === 'additionalProperties' && typeof value === 'object')));
}

function nodeSummary(schema: Schema): Schema {
  const result = constraints(schema);
  if (schema.$ref) result.reference = schemaId(schema.$ref);
  if (schema.enum) result.enumCount = schema.enum.length;
  return result;
}

function shapeItems(model: QueryKnowledge, node: LocatedNode): QueryResult[] {
  const properties = propertyChildren(node).map(child => ({ kind: 'property', id: schemaId(child.pointer),
    name: propertyName(child.pointer), required: (node.schema.required ?? []).includes(propertyName(child.pointer)),
    ...nodeSummary(child.schema) }));
  const branches = branchChildren(node).map(child => ({ kind: 'branch', id: schemaId(child.pointer),
    operator: child.pointer.split('/').at(-2), ...nodeSummary(child.schema) }));
  const references = referenceChildren(model, node).map(child => ({ kind: 'reference', id: schemaId(child.pointer) }));
  const nested = otherChildren(node).map(child => ({ kind: 'nested', id: schemaId(child.pointer), name: child.pointer.split('/').at(-1) }));
  const values = (node.schema.enum ?? []).map((value: unknown) => ({ kind: 'enum', value }));
  return [...properties, ...branches, ...references, ...nested, ...values];
}

function semanticModule(model: QueryKnowledge, node: LocatedNode): string | undefined {
  return model.nodes.find(item => item.pointer === node.pointer)?.module;
}

function literalWords(schema: Schema): string[] {
  return Object.values(schema.properties ?? {}).flatMap((property: any) => typeof property.const === 'string' ? [property.const] : []);
}

function ruleItems(model: QueryKnowledge, node: LocatedNode): QueryResult[] {
  const module = semanticModule(model, node), source = module ? model.modules[module] : undefined;
  if (!source) return [];
  const literals = literalWords(node.schema), property = propertyName(node.pointer);
  const terms = literals.length ? literals : [property];
  return source.semantics.flatMap((text, index) => terms.some(term => text.toLowerCase().includes(term.toLowerCase()))
    ? [{ id: `semantic:${module}:${index}`, title: text.split('\n')[0]!.replace(/^#+\s*/, '') }] : []);
}

function exampleItems(model: QueryKnowledge, node: LocatedNode): QueryResult[] {
  const module = semanticModule(model, node), files = module ? model.modules[module]?.examples ?? [] : [];
  const terms = [propertyName(node.pointer), ...literalWords(node.schema)];
  return files.filter(file => terms.some(term => file.toLowerCase().includes(term.toLowerCase())))
    .map(file => ({ id: `example:${file.split('/').at(-1)!.replace(/\.json$/, '')}` }));
}

/** Facets deliberately expose directories; the caller chooses the next exact node. */
export function showSchema(model: QueryKnowledge, options: KnowledgeQuery): QueryResult {
  rejectOptions(options, ['at', 'query']);
  const node = selectedResource(model, options), select = options.select ?? 'card';
  const contextRules = rulesForOwners(model, [node.owner, definitionName(node.pointer)]);
  const base = { id: schemaId(node.pointer), kind: 'schema', select, owner: node.owner };
  if (select === 'card') return { ...base, name: propertyName(node.pointer), available: facets, contextRules };
  if (select === 'placement') return { ...base, ...placement(node), contextRules, scope: options.owner
    ? 'selected owner usage; other uses may exist' : 'schema definition location; pass owner to resolve a usage path' };
  if (select === 'shape') return { ...base, constraints: constraints(node.schema), required: node.schema.required ?? [],
    parentRequired: node.parentRequired, enclosing: node.enclosing, contextRules, items: shapeItems(model, node),
    scope: 'direct shape; child and branch ids remain to be read' };
  if (select === 'rules') return { ...base, items: [...contextRules, ...ruleItems(model, node)],
    scope: 'registered owner rules and matching semantic references; empty is not proof that no other rule applies' };
  if (select === 'example') return { ...base, items: exampleItems(model, node), scope: 'matching example references' };
  if (select === 'explain') return { ...base, description: node.schema.description, items: ruleItems(model, node) };
  throw new TypeError(`Unknown schema selection: ${select}`);
}
