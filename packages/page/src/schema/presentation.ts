import { z } from 'zod';

const valueColorZ = z.enum(['red', 'green']);

export const markerColorRuleZ = z.object({
  negative: valueColorZ.describe('原始值小于零时的圆点颜色'),
  nonNegative: valueColorZ.describe('原始值等于零或大于零时的圆点颜色')
}).strict().meta({ id: 'markerColorRule', description: '折线圆点按原始数值小于零或大于等于零着色' });

/** Local numeric presentation; neither field names nor ranking order choose colors. */
export const colorRuleZ = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('fixed'), color: valueColorZ }).strict(),
  z.object({ mode: z.literal('sign'), positive: valueColorZ, negative: valueColorZ }).strict()
]).meta({ id: 'colorRule' });
export type ColorRule = z.infer<typeof colorRuleZ>;

const valueArrowZ = z.enum(['up', 'down', 'none']);
const arrowPositionZ = z.enum(['before', 'after']).optional().meta({ description: '箭头相对数值的位置，省略为before' });
export const arrowRuleZ = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('fixed'), arrow: valueArrowZ, position: arrowPositionZ }).strict(),
  z.object({ mode: z.literal('sign'), positive: valueArrowZ, negative: valueArrowZ, position: arrowPositionZ }).strict()
]).meta({ id: 'arrowRule' });
export type ArrowRule = z.infer<typeof arrowRuleZ>;

export const categoryLabelsZ = z.object({
  mode: z.enum(['auto', 'all']),
  rotate: z.number().min(-90).max(90).optional()
}).strict().meta({ id: 'categoryLabels' });
export type CategoryLabels = z.infer<typeof categoryLabelsZ>;
