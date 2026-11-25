import { z } from 'zod';

const coordinates = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const feature = z.string().min(1);
export const mapGeographyEntryZ = z.object({
  point: z.union([z.object({ lngLat: coordinates }).strict(), z.object({ feature }).strict()]).optional(),
  viewport: z.object({ center: coordinates.optional(), zoom: z.number().positive().optional() }).strict().optional(),
  features: z.array(feature).optional()
}).strict().meta({id:'mapGeographyEntry'});

const organizations = z.record(z.string().min(1), mapGeographyEntryZ);
const levels = z.object({ 'region-dept': organizations.optional(), office: organizations.optional() }).strict().meta({id:'mapGeographyLevels'});
export const mapGeographyZ = z.object({ world: levels.optional(), china: levels.optional() }).strict();
export type MapGeography = z.infer<typeof mapGeographyZ>;
export type MapGeographyEntry = z.infer<typeof mapGeographyEntryZ>;
