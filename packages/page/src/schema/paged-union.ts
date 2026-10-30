import { z } from 'zod';
import { fieldsZ, fieldNameZ, idZ } from './primitives';
import { pagedJoinSourceZ } from './paged-join';

export const unionProjectionZ = z.union([
  z.object({ field: fieldNameZ }).strict(),
  z.object({ value: z.union([z.string(), z.number(), z.boolean(), z.null()]) }).strict()
]);
const memberFields = { source: idZ, projection: z.record(fieldNameZ, unionProjectionZ) };
const unionMemberZ = z.union([
  z.object({ ...memberFields, rowKey: fieldNameZ }).strict(),
  z.object({ ...memberFields, rowKeyFields: z.array(fieldNameZ).min(2) }).strict(),
  z.object({ ...memberFields, rowKeyGeneration: z.literal('uuid') }).strict()
]);
export const pagedUnionSourceZ = z.object({
  type: z.literal('pagedUnion'), rowKey: fieldNameZ, sourceField: fieldNameZ,
  members: z.record(idZ, unionMemberZ).meta({ minProperties: 2 }),
  ordering: pagedJoinSourceZ.shape.ordering,
  pagination: z.object({pageSize:z.int().min(1).max(1000)}).strict(),
  initial: pagedJoinSourceZ.shape.initial
}).strict().meta({ id: 'pagedUnionSource' });
export const pagedUnionDataSourceZ = z.object({ fields: fieldsZ, source: pagedUnionSourceZ }).strict().meta({ id: 'pagedUnionDataSource' });
