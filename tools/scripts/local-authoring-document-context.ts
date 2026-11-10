import type { QueryKnowledge } from './local-authoring-query-types';

type Schema = Record<string, any>;
interface Location { pointer: string; schema: Schema; owners: string[] }
interface Surface { nodes: Location[] }
interface Condition { documentAt: string; values: unknown[] }
export interface DocumentContextCandidate { owner: string; id: string; enclosingOwners: string[] }
export interface DocumentContext {
  status: 'resolved' | 'needs-context' | 'ambiguous' | 'not-found';
  documentAt: string;
  owner?: string;
  id?: string;
  enclosingOwners: string[];
  candidates?: DocumentContextCandidate[];
  contextAt?: string;
  reason?: string;
  needs?: Condition[];
}
interface Expansion { surfaces: Surface[]; problem?: Omit<DocumentContext, 'documentAt' | 'enclosingOwners'> }
interface Frame { at: string; value: unknown }
const token = (value: string) => value.replaceAll('~', '~0').replaceAll('/', '~1');
const untoken = (value: string) => value.replaceAll('~1', '/').replaceAll('~0', '~');
const record = (value: unknown): value is Schema => value !== null && typeof value === 'object' && !Array.isArray(value);

function pointerTokens(at: string): string[] {
  if (at === '') return [];
  if (!at.startsWith('/') || /~(?![01])/u.test(at)) throw new TypeError('Expected an RFC 6901 document JSON Pointer');
  return at.slice(1).split('/').map(untoken);
}

function documentChild(value: unknown, key: string, at: string, last: boolean): unknown {
  if (Array.isArray(value)) {
    if (!/^(0|[1-9][0-9]*)$/u.test(key)) throw new TypeError(`Invalid array position: ${at}`);
    const index = Number(key);
    if (!Number.isSafeInteger(index) || !Object.hasOwn(value, index)) throw new TypeError(`Missing array position: ${at}`);
    return value[index];
  }
  if (!record(value)) throw new TypeError(`Document parent is not an object or array: ${at}`);
  if (Object.hasOwn(value, key)) return value[key];
  if (last) return undefined;
  throw new TypeError(`Missing document parent: ${at}`);
}

function documentFrames(document: unknown, keys: string[]): Frame[] {
  const frames: Frame[] = [{ at: '', value: document }];
  keys.forEach((key, index) => {
    const parent = frames[index]!, at = `${parent.at}/${token(key)}`;
    frames.push({ at, value: documentChild(parent.value, key, at, index === keys.length - 1) });
  });
  return frames;
}

function schemaLocation(model: QueryKnowledge, pointer: string, owners: string[]): Location {
  const keys = pointer === '#' ? [] : pointerTokens(pointer.slice(1));
  let schema: unknown = model.schema;
  for (const key of keys) {
    if (!record(schema) && !Array.isArray(schema)) throw new TypeError(`Unknown schema pointer: ${pointer}`);
    if (!Object.hasOwn(schema, key)) throw new TypeError(`Unknown schema pointer: ${pointer}`);
    schema = (schema as Schema)[key];
  }
  if (!record(schema)) throw new TypeError(`Not a schema object: ${pointer}`);
  const definition = /^#\/(?:definitions|\$defs)\/([^/]+)$/u.exec(pointer)?.[1];
  const nextOwners = definition ? [...new Set([...owners, untoken(definition)])] : owners;
  return { pointer, schema, owners: nextOwners };
}

function child(node: Location, keyword: string, key: string, schema: Schema): Location {
  return { ...node, pointer: `${node.pointer}/${keyword}/${token(key)}`, schema };
}

function resource(node: Location): DocumentContextCandidate {
  return { owner: node.owners.at(-1) ?? 'page', id: `schema:${node.pointer}`, enclosingOwners: node.owners };
}

function candidates(surfaces: Surface[]): DocumentContextCandidate[] {
  const entries = surfaces.flatMap(surface => surface.nodes.map(resource));
  return [...new Map(entries.map(entry => [entry.id, entry])).values()];
}

function combinations(left: Surface[], right: Surface[]): Surface[] {
  return left.flatMap(a => right.map(b => ({ nodes: [...a.nodes, ...b.nodes] })));
}

/** Expand only schema wrappers at this document position, never data or query contents. */
function surfaces(model: QueryKnowledge, node: Location, seen: Set<string>): Surface[] {
  if (seen.has(node.pointer)) return [];
  const visited = new Set([...seen, node.pointer]), schema = node.schema;
  if (schema.$ref) return surfaces(model, schemaLocation(model, schema.$ref, node.owners), visited);
  const union = schema.oneOf ?? schema.anyOf;
  if (union) return union.flatMap((item: Schema, index: number) =>
    surfaces(model, child(node, schema.oneOf ? 'oneOf' : 'anyOf', String(index), item), visited));
  let result: Surface[] = [{ nodes: [node] }];
  for (const [index, item] of (schema.allOf ?? []).entries()) {
    result = combinations(result, surfaces(model, child(node, 'allOf', String(index), item), visited));
  }
  return result;
}

function typeMatches(schema: Schema, value: unknown): boolean {
  if (!schema.type || value === undefined) return true;
  if (Array.isArray(schema.type)) return schema.type.some((type: string) => typeMatches({ type }, value));
  if (schema.type === 'object') return record(value);
  if (schema.type === 'array') return Array.isArray(value);
  if (schema.type === 'null') return value === null;
  if (schema.type === 'integer') return typeof value === 'number';
  return typeof value === schema.type;
}

function forbidsAnyValue(schema: unknown): boolean {
  return schema === false || (record(schema) && record(schema.not) && Object.keys(schema.not).length === 0);
}

function permitsPresentProperties(schema: Schema, value: unknown): boolean {
  if (!record(value)) return true;
  return Object.keys(value).every(key => !forbidsAnyValue(schema.properties?.[key]));
}

function surfaceMatches(surface: Surface, value: unknown): boolean {
  return surface.nodes.every(node => typeMatches(node.schema, value) && permitsPresentProperties(node.schema, value));
}

function literalValues(schema: Schema): unknown[] | undefined {
  if (Object.hasOwn(schema, 'const')) return [schema.const];
  return schema.enum;
}

/** Nested literal paths include source.type, but stop at arrays, unions and recursion. */
function literals(model: QueryKnowledge, node: Location, path: string, seen: Set<string>): Map<string, unknown[]> {
  if (seen.has(node.pointer)) return new Map();
  const visited = new Set([...seen, node.pointer]), result = new Map<string, unknown[]>();
  const expanded = surfaces(model, node, seen);
  if (expanded.length > 1) return result;
  for (const surface of expanded) {
    for (const part of surface.nodes) {
      const values = literalValues(part.schema);
      if (values) result.set(path, values);
      for (const [key, property] of Object.entries(part.schema.properties ?? {})) {
        const nested = child(part, 'properties', key, property as Schema);
        for (const [pointer, allowed] of literals(model, nested, `${path}/${token(key)}`, visited)) result.set(pointer, allowed);
      }
    }
  }
  return result;
}

function surfaceLiterals(model: QueryKnowledge, surface: Surface): Map<string, unknown[]> {
  return new Map(surface.nodes.flatMap(node => [...literals(model, node, '', new Set())]));
}

function atRelative(value: unknown, path: string): unknown {
  let result = value;
  for (const key of pointerTokens(path)) {
    if (!record(result) || !Object.hasOwn(result, key)) return undefined;
    result = result[key];
  }
  return result;
}

function discriminatorConditions(model: QueryKnowledge, options: Surface[]): Condition[] {
  const maps = options.map(option => surfaceLiterals(model, option));
  const paths = [...new Set(maps.flatMap(map => [...map.keys()]))];
  return paths.filter(path => maps.every(map => map.has(path))
    && new Set(maps.map(map => JSON.stringify(map.get(path)))).size > 1)
    .map(documentAt => ({ documentAt, values: [...new Set(maps.flatMap(map => map.get(documentAt)!))] }));
}

function filterDiscriminators(model: QueryKnowledge, options: Surface[], value: unknown, conditions: Condition[]): Surface[] {
  return options.filter(option => {
    const map = surfaceLiterals(model, option);
    return conditions.every(condition => {
      const actual = atRelative(value, condition.documentAt);
      return actual === undefined || map.get(condition.documentAt)!.includes(actual);
    });
  });
}

function declaredProperties(surface: Surface): Set<string> {
  return new Set(surface.nodes.flatMap(node => Object.keys(node.schema.properties ?? {})));
}

function structuralEvidence(options: Surface[], value: unknown): Surface[] {
  if (!record(value)) return [];
  const keys = options.map(declaredProperties);
  return options.filter((_, index) => Object.keys(value).some(key => keys[index]!.has(key)
    && keys.every((set, other) => other === index || !set.has(key))));
}

function missingRequiredDiscriminator(options: Surface[], value: unknown, conditions: Condition[]): boolean {
  return conditions.some(condition => {
    if (atRelative(value, condition.documentAt) !== undefined) return false;
    const path = pointerTokens(condition.documentAt);
    if (path.length !== 1) return true;
    return options.every(option => option.nodes.some(node => (node.schema.required ?? []).includes(path[0])));
  });
}

function expand(model: QueryKnowledge, node: Location, frame: Frame): Expansion {
  const all = surfaces(model, node, new Set());
  const typed = all.filter(option => surfaceMatches(option, frame.value));
  if (typed.length === 1) return { surfaces: typed };
  const conditions = discriminatorConditions(model, typed);
  const filtered = filterDiscriminators(model, typed, frame.value, conditions);
  if (filtered.length === 1) return { surfaces: filtered };
  const evidence = missingRequiredDiscriminator(filtered, frame.value, conditions)
    ? [] : structuralEvidence(filtered, frame.value);
  if (evidence.length === 1) return { surfaces: evidence };
  const possible = filtered.length ? filtered : all;
  return { surfaces: [], problem: {
    status: evidence.length > 1 ? 'ambiguous' : 'needs-context', contextAt: frame.at,
    reason: filtered.length ? 'Union branch needs distinguishing context' : 'No branch matches the declared type or discriminator',
    candidates: candidates(possible),
    needs: conditions.map(condition => ({ ...condition, documentAt: `${frame.at}${condition.documentAt}` }))
  } };
}

function objectChildren(node: Location, key: string): Location[] {
  const schema = node.schema;
  if (Object.hasOwn(schema.properties ?? {}, key)) return [child(node, 'properties', key, schema.properties[key])];
  const patterns = Object.entries(schema.patternProperties ?? {}).filter(([pattern]) => new RegExp(pattern).test(key));
  if (patterns.length) return patterns.map(([pattern, value]) => child(node, 'patternProperties', pattern, value as Schema));
  if (record(schema.additionalProperties)) return [{ ...node, pointer: `${node.pointer}/additionalProperties`, schema: schema.additionalProperties }];
  return [];
}

function navigationChildren(node: Location, key: string, value: unknown): Location[] {
  if (!Array.isArray(value)) return objectChildren(node, key);
  const items = node.schema.items;
  if (Array.isArray(items)) return items[Number(key)] ? [child(node, 'items', key, items[Number(key)])] : [];
  if (!record(items)) return [];
  return [{ ...node, pointer: `${node.pointer}/items`, schema: items }];
}

function uniqueLocations(nodes: Location[]): Location[] {
  return [...new Map(nodes.map(node => [node.pointer, node])).values()];
}

function missingContext(at: string, frame: Frame, node: Location): DocumentContext {
  return { status: 'not-found', documentAt: at, contextAt: frame.at, enclosingOwners: node.owners,
    reason: 'Property is not declared at this schema position', candidates: [resource(node)] };
}

/**
 * Resolve a raw, already parsed page by its actual schema slots. Page validity is
 * deliberately not a precondition. Only the final object property may be absent;
 * ancestors and every array position must exist. This function never loads files.
 */
export function resolveDocumentContext(model: QueryKnowledge, document: unknown, at: string): DocumentContext {
  const keys = pointerTokens(at), frames = documentFrames(document, keys);
  let node = schemaLocation(model, '#', ['page']);
  for (const [index, key] of keys.entries()) {
    const frame = frames[index]!, expanded = expand(model, node, frame);
    if (expanded.problem) return { ...expanded.problem, documentAt: at, enclosingOwners: node.owners };
    const next = uniqueLocations(expanded.surfaces.flatMap(surface => surface.nodes
      .flatMap(part => navigationChildren(part, key, frame.value))));
    if (!next.length) return missingContext(at, frame, expanded.surfaces[0]?.nodes.at(-1) ?? node);
    if (next.length > 1) return { status: 'ambiguous', documentAt: at, contextAt: frame.at,
      enclosingOwners: node.owners, reason: 'Several schema slots declare this property',
      candidates: next.map(resource) };
    node = next[0]!;
  }
  return targetContext(model, node, frames.at(-1)!, at);
}

/** The root component slot defines component identity; property names do not. */
function componentDeclarations(model: QueryKnowledge): Set<string> {
  const items = model.schema.properties?.sections?.items;
  if (!record(items)) return new Set();
  const section = { ...schemaLocation(model, '#', ['page']), pointer: '#/properties/sections/items', schema: items };
  const sections = surfaces(model, section, new Set()).flatMap(surface => surface.nodes);
  const collections = sections.flatMap(part => objectChildren(part, 'components'));
  const declarations = collections.flatMap(part => navigationChildren(part, '0', []));
  return new Set(declarations.flatMap(part => surfaces(model, part, new Set())
    .flatMap(surface => surface.nodes.map(candidate => candidate.pointer))));
}

function isComponentSlot(model: QueryKnowledge, node: Location): boolean {
  const choices = surfaces(model, node, new Set());
  if (choices.length < 2) return false;
  const declared = componentDeclarations(model);
  return choices.every(choice => choice.nodes.some(candidate => declared.has(candidate.pointer)));
}

function targetContext(model: QueryKnowledge, node: Location, frame: Frame, at: string): DocumentContext {
  // Ordinary properties keep their contract; component slots expose the actual declaration.
  const property = /\/(?:properties|patternProperties)\/[^/]+$/u.test(node.pointer);
  if (at === '' || (property && !isComponentSlot(model, node))) {
    return { status: 'resolved', documentAt: at, ...resource(node) };
  }
  const expanded = expand(model, node, frame);
  if (expanded.problem) return { ...expanded.problem, documentAt: at, enclosingOwners: node.owners };
  const canonical = expanded.surfaces[0]?.nodes.at(-1);
  if (!canonical) return missingContext(at, frame, node);
  return { status: 'resolved', documentAt: at, ...resource(canonical) };
}
