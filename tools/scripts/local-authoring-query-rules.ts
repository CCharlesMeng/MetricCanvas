import type { KnowledgeQuery, KnowledgeRule, QueryKnowledge, QueryResult } from './local-authoring-query-types';

export function rulesForOwners(model: QueryKnowledge, owners: string[]): QueryResult[] {
  return (model.ruleBindings ?? []).filter(rule => rule.owners.some(owner => owners.includes(owner)))
    .map(rule => ({id: `rule:${rule.id}`, description: rule.description}));
}

export function componentSchemaOwner(model: QueryKnowledge, type: string): string | undefined {
  // Resolve through the component slot. Unrelated definitions can use the same
  // discriminator (for example a pie legend also has type:"table").
  const definitions = model.schema.definitions ?? {};
  const branches = definitions.section?.properties?.components?.items?.oneOf ?? [];
  return branches.map((branch: {$ref?:string}) => branch.$ref?.replace(/^#\/definitions\//, ''))
    .find((owner: string | undefined) => owner && definitions[owner]?.properties?.type?.const === type);
}

export function findRules(model: QueryKnowledge, options: KnowledgeQuery): QueryResult {
  const terms = (options.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const items = (model.ruleBindings ?? []).filter(rule => !options.owner || rule.owners.includes(options.owner))
    .filter(rule => terms.every(term => `${rule.id} ${rule.description}`.toLowerCase().includes(term)))
    .map(rule => ({id:`rule:${rule.id}`, description:rule.description, owners:rule.owners}));
  return {kind:'rule',items};
}

export function showRule(model: QueryKnowledge, options: KnowledgeQuery): QueryResult {
  const rule = (model.ruleBindings ?? []).find(rule => `rule:${rule.id}` === options.id);
  if (!rule) throw new TypeError(`Unknown rule: ${options.id}`);
  if (options.at || options.branch || options.owner) throw new TypeError('Rule show accepts id, select, limit and cursor');
  const base = {id:options.id,kind:'rule',description:rule.description,owners:rule.owners};
  if (!options.select || options.select === 'card') return {...base,complete:true,available:['example','counterexample']};
  if (options.select === 'example') return {...base,items:rule.valid.filter(id => (model.examples ?? []).some(entry => entry.id === `example:${id}`)).map(id => ({id:`example:${id}`}))};
  if (options.select === 'counterexample') return {...base,items:rule.invalid.map(id => ({file:`references/page-metadata/errors/${id}.json`,purpose:'invalid contract witness; not a reusable page'}))};
  throw new TypeError(`Unknown rule selection: ${options.select}`);
}

/** Only owner associations are authored; rule wording and witnesses stay in the product registry. */
export function buildRuleBindings(model: QueryKnowledge, bindings: Record<string, {owners:string[]}> = {}): KnowledgeRule[] {
  const rules = Object.values(model.modules).flatMap(module => module.rules) as Array<{id:string;description:string;valid?:string[];invalid?:string[]}>;
  return Object.entries(bindings).map(([id, binding]) => {
    const source = rules.find(rule => rule.id === id);
    if (!source) throw new Error(`Unknown authoring rule binding: ${id}`);
    if (!binding.owners.length || binding.owners.some(owner => owner !== 'page' && !Object.hasOwn(model.schema.definitions ?? {}, owner))) throw new Error(`Unknown owner for rule: ${id}`);
    return {id,description:source.description,owners:[...binding.owners],valid:source.valid ?? [],invalid:source.invalid ?? []};
  });
}
