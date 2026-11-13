import { definitionSourceIds, queryResultDependencies, hasQueryFieldMapping, type DataSource, type ComputeOperator, type TableQueryView } from '@metriccanvas/page/internal';

/** Conservative references: unknown consumers retain every potentially referenced field. */
export function referencedStrings(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === 'string') found.add(value);
  else if (Array.isArray(value)) value.forEach(item => referencedStrings(item, found));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => referencedStrings(item, found));
  return found;
}

function queryRequirements(source: DataSource, needed: Set<string>, view?: TableQueryView): void {
  referencedStrings(view, needed);
  if (source.source.type !== 'query') return;
  const query = source.source.query;
  const names = referencedStrings({ filterBindings: query.filterBindings, paramBindings: query.paramBindings });
  for (const item of query.body?.dsl_list ?? []) {
    const { output_metrics: _metrics, output_fields: _fields, ...business } = item;
    referencedStrings(business, names);
  }
  for (const [id, field] of Object.entries(source.fields)) {
    if (field.role === 'dimension' || hasQueryFieldMapping(field) && names.has(field.queryField)) needed.add(id);
  }
}

interface Demand { fields: Map<string, Set<string>>; full: Set<string> }
function requireSource(demand: Demand, id: string, fields?: Iterable<string>): void {
  const needed = demand.fields.get(id) ?? new Set<string>();
  if (fields) for (const field of fields) needed.add(field);
  else demand.full.add(id);
  demand.fields.set(id, needed);
}

function requiredOperators(source: DataSource, needed: Set<string>, demand: Demand): ComputeOperator[] {
  const retained: ComputeOperator[] = [];
  // Other operators may change rows or carry their own invariants. Keep them and their inputs.
  for (const operator of source.compute ?? []) if (operator.op !== 'joinAggregate') referencedStrings(operator, needed);
  for (const operator of [...source.compute ?? []].reverse()) {
    if (operator.op !== 'joinAggregate') {
      retained.unshift(operator);
      if (operator.op === 'unionKeys') operator.sources.forEach(id => requireSource(demand, id));
      continue;
    }
    const values = operator.values.filter(value => needed.has(value.output));
    if (!values.length) continue;
    operator.keys.forEach(key => needed.add(key.local));
    requireSource(demand, operator.source, [...operator.keys.map(key => key.foreign), ...values.map(value => value.field)]);
    retained.unshift(values.length === operator.values.length ? operator : { ...operator, values });
  }
  return retained;
}

function projectSource(source: DataSource, needed: Set<string>, demand: Demand): DataSource {
  const compute = requiredOperators(source, needed, demand);
  for (const id of [...queryResultDependencies(source), ...definitionSourceIds(source)]) requireSource(demand, id);
  if (compute.length === (source.compute ?? []).length && compute.every((operator, index) => operator === source.compute![index])) return source;
  const outputs = new Set(compute.flatMap(operator => operator.op === 'joinAggregate' ? operator.values.map(value => value.output) : []));
  const removed = new Set((source.compute ?? []).flatMap(operator => operator.op === 'joinAggregate' ? operator.values.map(value => value.output).filter(output => !outputs.has(output)) : []));
  const fields = Object.fromEntries(Object.entries(source.fields).filter(([id]) => !removed.has(id)));
  return { ...source, fields, compute } as DataSource;
}

function demandSize(demand: Demand): number {
  return demand.full.size + demand.fields.size + [...demand.fields.values()].reduce((size, fields) => size + fields.size, 0);
}

/** Fixed point over field needs, shared consumers, and transitive execution prerequisites. */
export function projectComputeDemand(sources: ReadonlyMap<string, DataSource>, required: ReadonlyMap<string, Set<string>>, full: ReadonlySet<string>, views?: ReadonlyMap<string, TableQueryView>) {
  const demand: Demand = { fields: new Map([...required].map(([id, fields]) => [id, new Set(fields)])), full: new Set(full) };
  for (const id of full) requireSource(demand, id);
  let previous = -1;
  const result = new Map(sources);
  while (previous !== demandSize(demand)) {
    previous = demandSize(demand);
    for (const [id, needed] of demand.fields) {
      const source = sources.get(id);
      if (!source) continue;
      if (demand.full.has(id)) Object.keys(source.fields).forEach(field => needed.add(field));
      queryRequirements(source, needed, views?.get(id));
      result.set(id, projectSource(source, needed, demand));
    }
  }
  return { sources: result, required: demand.fields, full: demand.full };
}
