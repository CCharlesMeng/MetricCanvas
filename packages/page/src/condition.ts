import type { Condition, ConditionScalar, ConditionTest } from './schema/condition';
import type { FilterDeclaration } from './filter';

export type ConditionValue = ConditionScalar | null | ConditionScalar[];
export type ConditionInput = { status: 'pending'; filterRevision?: number } | { status: 'error'; filterRevision?: number } | { status: 'ready'; value: ConditionValue; filterRevision?: number };
export interface DisplaySnapshot {
  permissionRevision: string;
  permissions: Readonly<Record<string, ConditionInput>>;
  values: Readonly<Record<string, ConditionInput>>;
}
export interface ConditionContext {
  declarations: readonly FilterDeclaration[];
  filters: ReadonlyMap<string, { type: string; level?: string; values?: string[]; value?: unknown; query?: string; from?: string | number; to?: string | number }>;
  displaySnapshot?: DisplaySnapshot;
  filterRevision?: number;
  row?: Readonly<Record<string, unknown>>;
}
export type ConditionResult = { status: 'allow' | 'deny' | 'pending' | 'error'; reason?: string };
const ready = (value: ConditionValue): ConditionInput => ({ status: 'ready', value });

export function conditionLeaves(condition: Condition): Array<Exclude<Condition, {all: Condition[]} | {any: Condition[]} | {not: Condition}>> {
  if ('all' in condition) return condition.all.flatMap(conditionLeaves);
  if ('any' in condition) return condition.any.flatMap(conditionLeaves);
  if ('not' in condition) return conditionLeaves(condition.not);
  return [condition];
}
export function conditionDepth(condition: Condition): number {
  if ('all' in condition) return 1 + Math.max(...condition.all.map(conditionDepth));
  if ('any' in condition) return 1 + Math.max(...condition.any.map(conditionDepth));
  return 'not' in condition ? 1 + conditionDepth(condition.not) : 0;
}
function filterInput(leaf: Extract<Condition, {filter: string}>, context: ConditionContext): ConditionInput {
  const declaration = context.declarations.find(item => item.id === leaf.filter);
  if (!declaration) return { status: 'error' };
  const selected = context.filters.get(leaf.filter);
  if (leaf.part === 'level' && declaration.type === 'dimension') return ready(selected?.level ?? declaration.defaultLevel ?? declaration.hierarchy?.[0]?.id ?? null);
  if (leaf.part === 'values') return ready(selected?.values ?? []);
  if (leaf.part === 'value') {
    const value = selected?.type === 'search' ? selected.query : selected?.value;
    return isConditionValue(value) ? ready(value) : ready(null);
  }
  const value = selected?.[leaf.part as 'from' | 'to'];
  return ready(value ?? null);
}
function resolveInput(leaf: ReturnType<typeof conditionLeaves>[number], context: ConditionContext): ConditionInput {
  if ('filter' in leaf) return filterInput(leaf, context);
  if ('row' in leaf) return context.row && Object.hasOwn(context.row, leaf.row) && isConditionValue(context.row[leaf.row]) ? ready(context.row[leaf.row] as ConditionValue) : {status:'error'};
  const input = 'permission' in leaf ? context.displaySnapshot?.permissions?.[leaf.permission] : context.displaySnapshot?.values?.[leaf.fact];
  if (!input) return {status:'error'};
  if (input.filterRevision !== undefined && input.filterRevision !== context.filterRevision) return {status:'pending'};
  if (input.status === 'ready' && (!isConditionValue(input.value) || ('permission' in leaf && typeof input.value !== 'boolean'))) return {status:'error'};
  return input;
}
export function isConditionValue(value: unknown): value is ConditionValue {
  const scalar = (item: unknown) => typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item));
  if (value === null || scalar(value)) return true;
  return Array.isArray(value) && value.every(scalar) && value.every(item => typeof item === typeof value[0]);
}
export function conditionTestTypeError(test: ConditionTest, value: ConditionValue): boolean {
  if ('values' in test && test.values.some(item => typeof item !== typeof test.values[0])) return true;
  if (test.op === 'isNull' || test.op === 'isNotNull') return Array.isArray(value);
  if (test.op === 'isEmpty' || test.op === 'isNotEmpty') return !Array.isArray(value) && typeof value !== 'string' && value !== null;
  if (value === null) return false;
  if (test.op === 'containsAny' || test.op === 'containsAll') return !Array.isArray(value) || (value.length > 0 && test.values.some(item => typeof item !== typeof value[0]));
  if (Array.isArray(value)) return true;
  const literals = 'values' in test ? test.values : 'value' in test ? [test.value] : [];
  return literals.some(item => typeof item !== typeof value);
}
export function testConditionValue(test: ConditionTest, value: ConditionValue): boolean {
  if (test.op === 'isNull') return value === null;
  if (test.op === 'isNotNull') return value !== null;
  if (test.op === 'isEmpty') return value !== null && (typeof value === 'string' || Array.isArray(value)) && value.length === 0;
  if (test.op === 'isNotEmpty') return value !== null && (typeof value === 'string' || Array.isArray(value)) && value.length > 0;
  if (value === null) return false;
  switch (test.op) {
    case 'eq': return value === test.value;
    case 'ne': return value !== test.value;
    case 'in': return test.values.some(item => item === value);
    case 'notIn': return !test.values.some(item => item === value);
    case 'containsAny': return Array.isArray(value) && test.values.some(item => value.includes(item));
    case 'containsAll': return Array.isArray(value) && test.values.every(item => value.includes(item));
    case 'gt': return typeof value === 'number' && value > test.value;
    case 'gte': return typeof value === 'number' && value >= test.value;
    case 'lt': return typeof value === 'number' && value < test.value;
    case 'lte': return typeof value === 'number' && value <= test.value;
  }
}
/** Resolve and type-check every input before boolean evaluation, including not/any. */
export function evaluateCondition(condition: Condition | undefined, context: ConditionContext): ConditionResult {
  if (!condition) return {status:'allow'};
  const resolved = new Map<Condition, boolean>();
  let pending = false;
  for (const leaf of conditionLeaves(condition)) {
    const input = resolveInput(leaf, context);
    if (input.status === 'error') return {status:'error', reason:'CONDITION_INPUT_INVALID'};
    if (input.status === 'pending') { pending = true; continue; }
    if(!isConditionValue(input.value))return {status:'error',reason:'CONDITION_INPUT_TYPE'};
    if ('permission' in leaf) resolved.set(leaf, input.value === true);
    else {
      if (conditionTestTypeError(leaf, input.value)) return {status:'error', reason:'CONDITION_INPUT_TYPE'};
      resolved.set(leaf, testConditionValue(leaf, input.value));
    }
  }
  if (pending) return {status:'pending', reason:'CONDITION_INPUT_PENDING'};
  function match(node: Condition): boolean {
    if ('all' in node) return node.all.every(match);
    if ('any' in node) return node.any.some(match);
    if ('not' in node) return !match(node.not);
    return resolved.get(node) === true;
  }
  return {status:match(condition) ? 'allow' : 'deny'};
}
