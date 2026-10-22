import type { EffectiveQuery } from '@metriccanvas/page/internal';

type Predicate = EffectiveQuery['filterValues'][number];
type Bounds<T> = { from?: T; to?: T };
const key = (value: Predicate) => value.target === 'dimension' || value.target === 'dimensionRange'
  ? `${value.target}:${value.queryField}` : value.target === 'metricRange' ? `${value.target}:${value.metric}` : value.target;

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
    const values = value.values.filter(item => previous.values.some(other => typeof item === typeof other && item === other));
    return values.length ? { ...value, values } : undefined;
  }
  if (previous.target === 'time' && value.target === 'time') {
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
function inside(value: string | number, range: Bounds<string>): boolean {
  return (range.from === undefined || String(value) >= range.from) && (range.to === undefined || String(value) <= range.to);
}
function intersectEqualityRanges(merged: Map<string, Predicate>): boolean {
  for (const value of merged.values()) {
    if (value.target !== 'dimension') continue;
    const range = merged.get(`dimensionRange:${value.queryField}`);
    if (range?.target !== 'dimensionRange') continue;
    value.values = value.values.filter(item => inside(item, range));
    if (!value.values.length) return false;
    merged.delete(`dimensionRange:${value.queryField}`);
  }
  return true;
}
/** A single encoder input per target: no last-write-wins between public/local conditions. */
export function intersectQueryFilters(query: EffectiveQuery): EffectiveQuery | undefined {
  const merged = new Map<string, Predicate>();
  for (const candidate of query.filterValues) {
    if (candidate.target === 'dimension' && !candidate.values.length) continue; // cleared control
    const value = merge(merged.get(key(candidate)), structuredClone(candidate));
    if (!value) return;
    merged.set(key(value), value);
  }
  if (!intersectEqualityRanges(merged)) return;
  return { ...query, filterValues: [...merged.values()] };
}
