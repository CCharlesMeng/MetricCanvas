import { z } from 'zod';
import { idZ, nonEmptyTextValueZ } from './primitives';

/** B1: identity and placement only. Actions and trusted fact inputs ship separately. */
export const iocHeaderZ = z.object({
  identity: z.object({
    title: nonEmptyTextValueZ.optional(),
    code: z.object({ label: nonEmptyTextValueZ, value: nonEmptyTextValueZ }).strict().optional(),
    description: z.object({ text: nonEmptyTextValueZ, presentation: z.enum(['inline', 'tooltip']).optional() }).strict().optional(),
    tags: z.array(z.object({ id: idZ, text: nonEmptyTextValueZ, tone: z.enum(['neutral', 'info', 'success', 'warning', 'danger']).optional() }).strict()).min(1).optional(),
    facts: z.array(z.object({ id: idZ, kind: z.enum(['queryPeriod', 'latestDataPeriod', 'refreshedAt', 'generatedAt']), label: nonEmptyTextValueZ, value: z.union([nonEmptyTextValueZ,z.object({fact:idZ,part:z.enum(['latest','latestComplete','refreshedAt','generatedAt'])}).strict()]) }).strict()).min(1).optional()
  }).strict().optional(),
  back: z.literal(true).optional(),
  filterIds: z.array(idZ).min(1).meta({ uniqueItems: true }).optional(),
  presentation: z.object({ density: z.enum(['normal', 'compact']).optional(), collapse: z.enum(['none', 'firstRow']).optional() }).strict().optional()
}).strict();
export type IocHeaderDeclaration = z.infer<typeof iocHeaderZ>;
