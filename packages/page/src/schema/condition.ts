import { z } from 'zod';

export type ConditionScalar = string | number | boolean;
export type ConditionRef = { filter: string; part: 'level' | 'values' | 'value' | 'from' | 'to' | 'mode' } | { fact: string } | { row: string };
export type ConditionTest =
  | { op: 'eq' | 'ne'; value: ConditionScalar }
  | { op: 'in' | 'notIn' | 'containsAny' | 'containsAll'; values: ConditionScalar[] }
  | { op: 'gt' | 'gte' | 'lt' | 'lte'; value: number }
  | { op: 'isNull' | 'isNotNull' | 'isEmpty' | 'isNotEmpty' };
export type Condition = { all: Condition[] } | { any: Condition[] } | { not: Condition } | { permission: string } | (ConditionRef & ConditionTest);

const scalar = z.union([z.string(), z.number(), z.boolean()]);
const tests = [
  { op: z.enum(['eq', 'ne']), value: scalar },
  { op: z.enum(['in', 'notIn', 'containsAny', 'containsAll']), values: z.array(scalar).min(1).max(1000) },
  { op: z.enum(['gt', 'gte', 'lt', 'lte']), value: z.number() },
  { op: z.enum(['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty']) }
];
const refs = [
  { filter: z.string().min(1), part: z.enum(['level', 'values', 'value', 'from', 'to', 'mode']) },
  { fact: z.string().min(1) }, { row: z.string().min(1) }
];
export const conditionZ: z.ZodType<Condition> = z.lazy(() => z.union([
  z.object({ all: z.array(conditionZ).min(1).max(64) }).strict(),
  z.object({ any: z.array(conditionZ).min(1).max(64) }).strict(),
  z.object({ not: conditionZ }).strict(),
  z.object({ permission: z.string().min(1) }).strict(),
  ...refs.flatMap(ref => tests.map(test => z.object({ ...ref, ...test }).strict()))
])).meta({ id: 'condition' }) as z.ZodType<Condition>;
export const visibilityShape = { visibleWhen: conditionZ.optional() };
export const interactionShape = { ...visibilityShape, enabledWhen: conditionZ.optional() };
