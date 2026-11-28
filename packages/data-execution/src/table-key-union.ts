import {
  evaluateCondition, flattenPageComponents, mainColumnField, resultSourceIds, tableColumnLeaves,
  type Condition, type ConditionContext, type DataSource, type JoinAggregateOperator,
  type Page, type TableComponent, type UnionKeysOperator
} from '@metriccanvas/page/internal';

interface TableKeyUnion {
  key: string;
  periodArms: Map<string, Condition>;
}

function uniqueKeyJoins(source: DataSource, key: string): JoinAggregateOperator[] | undefined {
  const [union, ...rest] = source.compute ?? [];
  if (union?.op !== 'unionKeys' || union.keys.length !== 1 || union.keys[0] !== key) return;
  const joins = rest.filter((op): op is JoinAggregateOperator => op.op === 'joinAggregate');
  if (joins.length !== rest.length || joins.length !== union.sources.length) return;
  const bySource = new Set(joins.filter(join => join.keys.length === 1 && join.keys[0].local === key &&
    join.keys[0].foreign === key && join.values.every(value => value.aggregate === 'unique')).map(join => join.source));
  if (union.sources.every(id => bySource.has(id))) return joins;
}

function periodGuard(source: DataSource, condition: Condition | undefined): condition is Condition {
  if (source.source.type !== 'query' || !condition || !('filter' in condition)) return false;
  if (condition.part !== 'mode' || condition.op !== 'eq') return false;
  const query = source.source.query;
  if (!query.body || query.queryModes || query.timeModes || query.periodAggregation) return false;
  const binding = query.filterBindings?.[condition.filter];
  if (binding?.target !== 'time' || binding.periodPolicy?.kind !== 'selection') return false;
  const supported = binding.periodPolicy.supportedPeriods;
  return supported?.length === 1 && supported[0] === condition.value;
}

function guardedArms(table: TableComponent, joins: JoinAggregateOperator[], page: Page) {
  const columns = tableColumnLeaves(table.props.columns);
  const arms = new Map<string, Condition>();
  for (const join of joins) {
    const guards = join.values.map(value => columns.find(column => mainColumnField(column.field) === value.output)?.visibleWhen);
    const first = guards[0];
    if (periodGuard(page.dataSources[join.source], first) && guards.every(guard => JSON.stringify(guard) === JSON.stringify(first))) arms.set(join.source, first);
  }
  return arms;
}

const plansByPage = new WeakMap<Page, ReadonlyMap<string, TableKeyUnion>>();

/** Only a single table's explicitly keyed detail union can use period-specific arms. */
export function tableKeyUnions(page: Page): ReadonlyMap<string, TableKeyUnion> {
  const cached = plansByPage.get(page);
  if (cached) return cached;
  const plans = new Map<string, TableKeyUnion>();
  const components = flattenPageComponents(page);
  const dependencies = new Set(Object.values(page.dataSources).flatMap(resultSourceIds));
  for (const table of components) {
    if (table.type !== 'table' || !table.props.rowKey) continue;
    const id = table.data.main;
    const source = page.dataSources[id];
    if (source?.compute?.[0]?.op !== 'unionKeys' || dependencies.has(id)) continue;
    if (components.some(other => other !== table && Object.values(other.data ?? {}).includes(id))) continue;
    const joins = uniqueKeyJoins(source, table.props.rowKey);
    if (!joins) continue;
    const periodArms = guardedArms(table, joins, page);
    if (periodArms.size) plans.set(id, { key: table.props.rowKey, periodArms });
  }
  plansByPage.set(page, plans);
  return plans;
}

/** Only omit a formally inapplicable row source whose measure join was also pruned. */
export function projectPeriodKeyUnions(page: Page, sources: Map<string, DataSource>, context: ConditionContext): void {
  for (const [id, plan] of tableKeyUnions(page)) {
    const source = sources.get(id)!;
    const [union, ...joins] = source.compute!;
    if (union.op !== 'unionKeys' || source.source.type !== 'inline') continue;
    const joined = new Set(joins.flatMap(op => op.op === 'joinAggregate' ? [op.source] : []));
    const members = union.sources.filter(member => {
      const guard = plan.periodArms.get(member);
      return !guard || joined.has(member) || evaluateCondition(guard, context).status !== 'deny';
    });
    if (members.length !== union.sources.length) {
      const projected: UnionKeysOperator = { ...union, sources: members };
      sources.set(id, { ...source, source: source.source, compute: [projected, ...joins] });
    }
  }
}
