import { z } from 'zod';
import { fieldsZ, fieldNameZ, idZ } from './primitives';
import { pagedJoinSourceZ } from './paged-join';

export const unionProjectionZ = z.union([
  z.object({ field: fieldNameZ }).strict(),
  z.object({ value: z.union([z.string(), z.number(), z.boolean(), z.null()]) }).strict()
]);
export const pagedUnionSourceZ = z.object({
  type: z.literal('pagedUnion'), rowKey: fieldNameZ, sourceField: fieldNameZ,
  members: z.record(idZ, z.object({ source: idZ, rowKey: fieldNameZ,
    projection: z.record(fieldNameZ, unionProjectionZ)
  }).strict()).meta({ minProperties: 2 }),
  ordering: pagedJoinSourceZ.shape.ordering,
  pagination: pagedJoinSourceZ.shape.pagination,
  initial: pagedJoinSourceZ.shape.initial
}).strict().meta({ id: 'pagedUnionSource' });
export const pagedUnionDataSourceZ = z.object({ fields: fieldsZ, source: pagedUnionSourceZ }).strict().meta({ id: 'pagedUnionDataSource' });
