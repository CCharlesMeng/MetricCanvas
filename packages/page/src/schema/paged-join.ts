import { z } from 'zod';
import { cellFallbacksZ, fieldsZ, fieldNameZ, idZ, fieldValueZ } from './primitives';
import { tableSortZ, tableQueryViewZ } from '../table/query-view';
import { deltaOperatorZ, ratioOperatorZ } from './compute';

export const pagedJoinSourceZ = z.object({
  type: z.literal('pagedJoin'), rowKey: fieldNameZ, domainMember: idZ,
  members: z.record(idZ, z.object({ source: idZ,
    key: z.object({ field: fieldNameZ, queryField: z.string().min(1) }).strict(), canSelectPage: z.boolean(), notApplicableFilters: z.array(idZ).optional()
  }).strict()).refine(value => Object.keys(value).length > 0),
  projection: z.record(fieldNameZ, z.object({ member: idZ, field: fieldNameZ, onMissing: z.enum(['null','zero']).optional().describe('成功查询缺少关联记录时取空或补零；省略取空，返回的 null 单元格保持为空') }).strict()),
  ordering: z.object({ default: z.array(tableSortZ).min(1), sortableFields: z.array(fieldNameZ).min(1), nulls: z.literal('last') }).strict(),
  pagination: z.union([
    z.object({ pageSize: z.int().min(1).max(1000) }).strict(),
    z.object({ mode: z.literal('query'), pageSize: z.int().min(1).max(1000), batchSize: z.int().min(1).max(1000) }).strict()
  ]),
  fallback: z.object({ maxRows: z.int().min(1).max(1000) }).strict().optional(),
  onMissing: z.literal('null'), ordinalField: fieldNameZ.optional(),
  records: z.object({
    batchSize: z.int().min(1).max(1000).optional(), maxRows: z.int().min(1).max(100000).optional(),
    maxBytes: z.int().min(1024).max(134217728), timeoutMs: z.int().min(1).max(180000),
    timeFilters: z.record(idZ, z.object({ field: fieldNameZ, valueFormat: z.enum(['iso', 'compact', 'datetime']) }).strict()).optional()
  }).strict().optional(),
  initial: z.object({ capturedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/), rows: z.array(z.record(z.string(), fieldValueZ)),
    cellFallbacks: cellFallbacksZ.optional(), totalCount: z.int().min(0), view: tableQueryViewZ }).strict().optional()
}).strict().meta({ id: 'pagedJoinSource' });
export const pagedJoinDataSourceZ = z.object({ fields: fieldsZ, source: pagedJoinSourceZ,
  compute: z.array(z.discriminatedUnion('op',[deltaOperatorZ,ratioOperatorZ])).min(1).optional().describe('查询分页组合投影后的逐行 delta/ratio 计算；不改变行数、顺序和 totalCount')
}).strict().meta({ id: 'pagedJoinDataSource' });
