import { z } from 'zod';
import {
  fieldNameZ,
  fieldsZ,
  fieldTypeZ,
  fieldValueZ,
  idZ,
  queryFieldsZ,
  valueFormatPresetZ
} from './primitives';

/**
 * 页面数据源的文档态形状（校验前，原始不可信文档）。
 *
 * 只服务于 `schema.ts` 的 JSON Schema 生成：query 页面数据源在文档中可以使用
 * 按角色分组的局部显式字段（`GroupedQueryFields`，定义见 `page-document.ts`），
 * `materializePageDocument` 会在解析接缝把它展开为扁平字段后才成为 `Page`。
 * 领域态类型（`Page`/`DataSources`）继续以 `data-source.ts` 的手写类型为准，
 * 不从这里推导——两者形状本就不同，保持文档态/领域态的分层。
 */

const dataRowZ = z.record(z.string(), fieldValueZ);

export const inlineSourceZ = z
  .object({
    type: z.literal('inline'),
    rows: z.array(dataRowZ)
  })
  .meta({ id: 'inlineSource' });

const dslItemZ = z.record(z.string(), z.unknown());

export const dqeQueryZ = z
  .object({
    language: z.literal('dqe'),
    body: z
      .object({
        dsl_list: z.array(dslItemZ).length(1)
      })
      .strict(),
    filterBindings: z
      .record(
        idZ,
        z
          .union([
            z
              .object({ target: z.literal('dimension'), queryField: z.string().min(1) })
              .strict(),
            z.object({ target: z.literal('time') }).strict()
          ])
      )
      .optional()
  })
  .meta({ id: 'dqeQuery' });

export const embeddedInitialRowsZ = z
  .object({
    capturedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/),
    rows: z.array(dataRowZ),
    totalCount: z.int().min(0).optional()
  })
  .meta({ id: 'embeddedInitialRows' });

export const querySourceZ = z
  .object({
    type: z.literal('query'),
    initial: embeddedInitialRowsZ.optional(),
    query: dqeQueryZ
  })
  .meta({ id: 'querySource' });

export const inlineDataSourceZ = z
  .object({ fields: fieldsZ, source: inlineSourceZ })
  .meta({ id: 'inlineDataSource' });

const groupedQueryFieldZ = z
  .object({
    queryField: z.string().min(1),
    type: fieldTypeZ,
    label: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    nullable: z.boolean().optional(),
    defaultFormat: valueFormatPresetZ.optional()
  })
  .meta({ id: 'groupedQueryField' });

const groupedQueryFieldGroupZ = z
  .record(fieldNameZ, groupedQueryFieldZ)
  .meta({ id: 'groupedQueryFieldGroup', minProperties: 1 });

const groupedQueryFieldsZ = z
  .object({
    dimensions: groupedQueryFieldGroupZ.optional(),
    measures: groupedQueryFieldGroupZ.optional()
  })
  .meta({
    id: 'groupedQueryFields',
    anyOf: [{ required: ['dimensions'] }, { required: ['measures'] }]
  });

export const queryDataSourceDocumentZ = z
  .object({
    fields: z.union([queryFieldsZ, groupedQueryFieldsZ]),
    source: querySourceZ
  })
  .meta({ id: 'queryDataSource' });

export const dataSourceDocumentZ = z
  .union([inlineDataSourceZ, queryDataSourceDocumentZ])
  .meta({ id: 'dataSource' });
