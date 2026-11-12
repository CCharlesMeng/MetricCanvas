import { z } from 'zod';
import { idZ, nonEmptyTextValueZ } from './primitives';
import { navigationTargetZ } from './navigation';

export const iocHeaderControlZ = z.discriminatedUnion('type', [
  z.object({id:idZ,type:z.literal('filterControl'),props:z.object({filterId:idZ}).strict()}).strict(),
  z.object({id:idZ,type:z.literal('regionFilter')}).strict()
]);
export type IocHeaderControl = z.infer<typeof iocHeaderControlZ>;

/** B1: identity and placement only. Actions and trusted fact inputs ship separately. */
export const iocHeaderZ = z.object({
  identity: z.object({
    title: nonEmptyTextValueZ.optional(),
    titleNavigate: navigationTargetZ.optional(),
    code: z.object({ label: nonEmptyTextValueZ, value: nonEmptyTextValueZ }).strict().optional(),
    description: z.object({ text: nonEmptyTextValueZ, presentation: z.enum(['inline', 'tooltip']).optional() }).strict().optional(),
    tags: z.array(z.object({ id: idZ, text: nonEmptyTextValueZ, tone: z.enum(['neutral', 'info', 'success', 'warning', 'danger']).optional() }).strict()).min(1).optional(),
    facts: z.array(z.object({ id: idZ, kind: z.enum(['queryPeriod', 'latestDataPeriod', 'refreshedAt', 'generatedAt']), label: nonEmptyTextValueZ, value: z.union([nonEmptyTextValueZ,z.object({fact:idZ,part:z.enum(['latest','latestComplete','refreshedAt','generatedAt'])}).strict()]) }).strict()).min(1).optional()
  }).strict().optional(),
  back: z.union([z.boolean(), z.literal('auto')]).optional(),
  readOnly: z.boolean().optional(),
  note: z.string().min(1).optional(),
  filterIds: z.array(idZ).min(1).meta({ uniqueItems: true }).optional(),
  components: z.array(iocHeaderControlZ).min(1).optional(),
  presentation: z.object({ density: z.enum(['normal', 'compact']).optional(), collapse: z.enum(['none', 'firstRow', 'overflow']).optional(), layout: z.enum(['stacked', 'inline']).optional() }).strict().optional()
}).strict();
export type IocHeaderDeclaration = z.infer<typeof iocHeaderZ>;
