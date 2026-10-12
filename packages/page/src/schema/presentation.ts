import { z } from 'zod';

const valueColorZ = z.enum(['red', 'green']);

/** Local numeric presentation; neither field names nor ranking order choose colors. */
export const colorRuleZ = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('fixed'), color: valueColorZ }).strict(),
  z.object({ mode: z.literal('sign'), positive: valueColorZ, negative: valueColorZ }).strict()
]).meta({ id: 'colorRule' });
export type ColorRule = z.infer<typeof colorRuleZ>;

export const categoryLabelsZ = z.object({
  mode: z.enum(['auto', 'all']),
  rotate: z.number().min(-90).max(90).optional()
}).strict().meta({ id: 'categoryLabels' });
export type CategoryLabels = z.infer<typeof categoryLabelsZ>;
