import { z } from 'zod';
import { fieldBindingZ, scalarZ, textValueZ, valueFormatPresetZ } from './primitives';

/** Constant presentation belongs to its consumer, never to a fabricated result field. */
export const constantPresentationShape = {
  format: valueFormatPresetZ.optional(),
  unit: textValueZ.optional(),
  currency: z.enum(['CNY', 'USD']).optional(),
  missingText: z.string().min(1).max(100).optional()
};
export const fieldSeriesSourceZ = z.object({ field: fieldBindingZ, value: z.never().optional() });
export const constantSeriesSourceZ = z.object({
  field: z.never().optional(), value: z.number().nullable(), ...constantPresentationShape
});
export const fieldValueSourceZ = z.object({ valueField: fieldBindingZ, value: z.never().optional() });
export const constantValueSourceZ = z.object({
  valueField: z.never().optional(), value: z.number().nullable(), ...constantPresentationShape
});
export const displayConstantSourceZ = constantSeriesSourceZ.extend({ value: scalarZ });
export const chartEmptyBehaviorZ = z.enum(['default', 'showConstants']);
