import { z } from 'zod';
import { idZ } from './primitives';

/** Placement and fixed choices; query predicates remain owned by filterBindings. */
export const chartFilterZ = z.object({
  filterId: idZ,
  options: z.array(z.object({
    label: z.string().min(1).regex(/\S/),
    value: z.string().min(1)
  }).strict()).min(1)
}).strict().meta({ id: 'chartFilter' });
