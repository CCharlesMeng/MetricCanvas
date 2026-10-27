import { z } from 'zod';
import { cellFallbacksZ, fieldsZ, fieldNameZ, idZ, fieldValueZ } from './primitives';
import { tableSortZ, tableQueryViewZ } from '../table/query-view';

export const pagedJoinSourceZ = z.object({
  type: z.literal('pagedJoin'), rowKey: fieldNameZ, domainMember: idZ,
  members: z.record(idZ, z.object({ source: idZ,
    key: z.object({ field: fieldNameZ, queryField: z.string().min(1) }).strict(), canSelectPage: z.boolean(), notApplicableFilters: z.array(idZ).optional()
  }).strict()).refine(value => Object.keys(value).length > 0),
  projection: z.record(fieldNameZ, z.object({ member: idZ, field: fieldNameZ }).strict()),
  ordering: z.object({ default: z.array(tableSortZ).min(1), sortableFields: z.array(fieldNameZ).min(1), nulls: z.literal('last') }).strict(),
  pagination: z.object({ pageSize: z.int().min(1).max(1000) }).strict(),
  fallback: z.object({ maxRows: z.int().min(1).max(1000) }).strict(),
  onMissing: z.literal('null'), ordinalField: fieldNameZ.optional(),
  records: z.object({
    batchSize: z.int().min(1).max(1000), maxRows: z.int().min(1).max(100000),
    maxBytes: z.int().min(1024).max(134217728), timeoutMs: z.int().min(1).max(120000),
    timeFilters: z.record(idZ, z.object({ field: fieldNameZ, valueFormat: z.enum(['iso', 'compact', 'datetime']) }).strict()).optional()
  }).strict().optional(),
  initial: z.object({ capturedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/), rows: z.array(z.record(z.string(), fieldValueZ)),
    cellFallbacks: cellFallbacksZ.optional(), totalCount: z.int().min(0), view: tableQueryViewZ }).strict().optional()
}).strict().meta({ id: 'pagedJoinSource' });
export const pagedJoinDataSourceZ = z.object({ fields: fieldsZ, source: pagedJoinSourceZ }).strict().meta({ id: 'pagedJoinDataSource' });
