import { z } from 'zod';
import { fieldsZ, fieldNameZ, idZ, fieldValueZ } from './primitives';
import { tableSortZ, tableQueryViewZ } from '../table-query-view';

export const pagedJoinSourceZ = z.object({
  type: z.literal('pagedJoin'), rowKey: fieldNameZ, domainMember: idZ,
  members: z.record(idZ, z.object({ source: idZ,
    key: z.object({ field: fieldNameZ, queryField: z.string().min(1) }).strict(), canSelectPage: z.boolean()
  }).strict()).refine(value => Object.keys(value).length > 0),
  projection: z.record(fieldNameZ, z.object({ member: idZ, field: fieldNameZ }).strict()),
  ordering: z.object({ default: z.array(tableSortZ).min(1), sortableFields: z.array(fieldNameZ).min(1), nulls: z.literal('last') }).strict(),
  pagination: z.object({ pageSize: z.int().min(1).max(1000) }).strict(),
  fallback: z.object({ maxRows: z.int().min(1).max(1000) }).strict(),
  onMissing: z.literal('null'), ordinalField: fieldNameZ.optional(),
  initial: z.object({ capturedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/), rows: z.array(z.record(z.string(), fieldValueZ)),
    totalCount: z.int().min(0), view: tableQueryViewZ }).strict().optional()
}).strict().meta({ id: 'pagedJoinSource' });
export const pagedJoinDataSourceZ = z.object({ fields: fieldsZ, source: pagedJoinSourceZ }).strict().meta({ id: 'pagedJoinDataSource' });
