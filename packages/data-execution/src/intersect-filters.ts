import type { EffectiveQuery } from '@metriccanvas/page/internal';

type Predicate = EffectiveQuery['filterValues'][number];
type Bounds<T> = { from?: T; to?: T };
const key = (value: Predicate) => value.target === 'dimension' || value.target === 'dimensionRange'
  ? `${value.target}:${value.queryField}` : value.target === 'metricRange' ? `${value.target}:${value.metric}` : `${value.target}:${value.queryField ?? ''}:${value.valueFormat ?? ''}`;

function stringBounds(left: Bounds<string>, right: Bounds<string>): Bounds<string> | undefined {
  const from = [left.from, right.from].filter((item): item is string => item !== undefined).sort().at(-1);
  const to = [left.to, right.to].filter((item): item is string => item !== undefined).sort()[0];
  if (from !== undefined && to !== undefined && from > to) return;
  return { ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) };
}
function numericBounds(left: Bounds<number>, right: Bounds<number>): Bounds<number> | undefined {
  const from = Math.max(left.from ?? -Infinity, right.from ?? -Infinity);
  const to = Math.min(left.to ?? Infinity, right.to ?? Infinity);
  if (from > to) return;
  return { ...(Number.isFinite(from) ? { from } : {}), ...(Number.isFinite(to) ? { to } : {}) };
}
function merge(previous: Predicate | undefined, value: Predicate): Predicate | undefined {
  if (!previous) return value;
  if (previous.target === 'dimension' && value.target === 'dimension') {
    return mergeDimensions(previous, value);
  }
  if (previous.target === 'time' && value.target === 'time') {
    if(previous.period !== value.period) throw Object.assign(new Error('不能对不同查询粒度的期间取交集'), {code:'DQE_QUERY_REJECTED'});
    const bounds = stringBounds(previous.value, value.value);
    return bounds ? { ...value, value: { from: bounds.from!, to: bounds.to! } } : undefined;
  }
  if (previous.target === 'metricRange' && value.target === 'metricRange') {
    const bounds = numericBounds(previous, value);
    return bounds ? { target: value.target, metric: value.metric, ...bounds } : undefined;
  }
  if (previous.target === 'dimensionRange' && value.target === 'dimensionRange') {
    const bounds = stringBounds(previous, value);
    return bounds ? { target: value.target, queryField: value.queryField, ...bounds } : undefined;
  }
  return value;
}
type Dimension = Extract<Predicate, {target:'dimension'}>;
/** AND of memberships: exclusions combine by union; inclusion minus exclusion stays finite. */
function mergeDimensions(left: Dimension, right: Dimension): Dimension | undefined {
  if (left.operator === '!=' && right.operator === '!=') return {...right, values:[...new Set([...left.values, ...right.values])]};
  if (right.operator === '!=') return subtractDimension(left, right);
  if (left.operator === '!=') return subtractDimension(right, left);
  const values = right.values.filter(item => left.values.includes(item));
  return values.length ? {...right, values} : undefined;
}
function subtractDimension(included: Dimension, excluded: Dimension): Dimension | undefined {
  const values = included.values.filter(item => !excluded.values.includes(item));
  return values.length ? {...included, values} : undefined;
}
function inside(value: string | number, range: Bounds<string>): boolean {
  return (range.from === undefined || String(value) >= range.from) && (range.to === undefined || String(value) <= range.to);
}
function intersectEqualityRanges(merged: Map<string, Predicate>): boolean {
  for (const value of merged.values()) {
    if (value.target !== 'dimension' || value.operator === '!=') continue;
    const range = merged.get(`dimensionRange:${value.queryField}`);
    if (range?.target !== 'dimensionRange') continue;
    value.values = value.values.filter(item => inside(item, range));
    if (!value.values.length) return false;
    merged.delete(`dimensionRange:${value.queryField}`);
  }
  return true;
}
function intersectPredicates(predicates: EffectiveQuery['filterValues']): EffectiveQuery['filterValues'] | undefined {
  const merged = new Map<string, Predicate>();
  for (const candidate of predicates) {
    if (candidate.target === 'dimension' && !candidate.values.length) continue; // cleared control
    const value = merge(merged.get(key(candidate)), structuredClone(candidate));
    if (!value) return;
    merged.set(key(value), value);
  }
  if (!intersectEqualityRanges(merged)) return;
  return [...merged.values()];
}
/** Normalize business predicates independently before AND-narrowing with table conditions. */
export function intersectQueryFilters(query: EffectiveQuery): EffectiveQuery | undefined {
  if(query.matchNone)return;
  const filterValues=intersectPredicates(query.filterValues);
  if(!filterValues)return;
  const bindingValues=query.bindingValues===undefined?undefined:intersectPredicates(query.bindingValues);
  if(query.bindingValues&&!bindingValues)return;
  return {...query,filterValues,...(bindingValues?{bindingValues}:{})};
}
