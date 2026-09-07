import { z } from 'zod';
import { fieldNameZ, idZ } from './primitives';

export const navigationBindingZ = z.discriminatedUnion('source', [
  z.object({ source: z.literal('row'), field: fieldNameZ }).strict(),
  z.object({ source: z.literal('param'), id: idZ }).strict(),
  z.object({ source: z.literal('filter'), id: idZ,
    part: z.enum(['value', 'from', 'to', 'level']).optional() }).strict()
]);
export const navigationTargetZ = z.object({
  href: z.string().min(1),
  query: z.record(z.string().min(1), navigationBindingZ).optional()
}).strict();
export type NavigationTarget = z.infer<typeof navigationTargetZ>;
export type NavigationBinding = z.infer<typeof navigationBindingZ>;
