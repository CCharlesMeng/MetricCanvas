import { z } from 'zod';
import { computeZ } from './compute';
import {
  fieldNameZ,
  fieldsZ,
  fieldValueZ,
  idZ,
  queryFieldsZ,
  standardFieldTypeZ,
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

export const timeWindowZ = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('period'), unit: z.enum(['day', 'month', 'year']), offset: z.int().optional() }).strict(),
  z.object({ kind: z.literal('lastN'), unit: z.enum(['day', 'month']), n: z.int().min(1) }).strict(),
  z.object({ kind: z.literal('yearToDate') }).strict(),
  z.object({ kind: z.literal('monthToDate') }).strict(),
  z.object({ kind: z.literal('toDate'), unit: z.enum(['month', 'year']) }).strict()
]).meta({ id: 'timeWindow' });

export const dqeQueryZ = z
  .object({
    language: z.literal('dqe'),
    body: z
      .object({
        dsl_list: z.array(dslItemZ).length(1)
      })
      .strict(),
    paramBindings: z.record(idZ, z.discriminatedUnion('target', [
      z.object({ target: z.literal('dimension'), queryField: z.string().min(1) }).strict(),
      z.object({ target: z.literal('time'), window: timeWindowZ }).strict()
    ])).optional(),
    filterBindings: z
      .record(
        idZ,
        z
          .union([
            z
              .object({ target: z.literal('dimension'), queryField: z.string().min(1) })
              .strict(),
            // 层级维度筛选器逐级声明谓词字段(ADR-0084);层级 id 为键。
            z
              .object({
                target: z.literal('dimension'),
                levelQueryFields: z
                  .record(idZ, z.string().min(1))
                  .meta({ minProperties: 2 })
              })
              .strict(),
            z.object({ target: z.literal('time') }).strict(),
            // 非维度筛选器的三支谓词(ADR-0085)。
            z
              .object({
                target: z.literal('timePoint'),
                queryField: z.string().min(1),
                valueFormat: z.enum(['iso', 'compact']).optional()
              })
              .strict(),
            z
              .object({
                target: z.literal('boolean'),
                queryField: z.string().min(1),
                whenTrue: z.array(z.string().min(1)).min(1),
                whenFalse: z.array(z.string().min(1)).min(1).optional()
              })
              .strict(),
            z
              .object({ target: z.literal('numberRange'), metric: z.string().min(1) })
              .strict()
          ])
      )
      .optional()
  })
  .meta({ id: 'dqeQuery' });

/**
 * 页面查询定义:以 language 为判别符的判别联合(ADR-0034),dqeQueryZ 是
 * 其中一支。协议闭集的真源是 `../query`(QUERY_LANGUAGES),新增协议分支
 * 时两处同步扩展,编译期守护见领域态类型旁的闭集覆盖断言。
 */
export const pageQueryZ = z
  .discriminatedUnion('language', [dqeQueryZ])
  .meta({ id: 'pageQuery' });

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
    query: pageQueryZ
  })
  .meta({ id: 'querySource' });

export const inlineDataSourceZ = z
  .object({ fields: fieldsZ, compute: computeZ.optional(), source: inlineSourceZ })
  .meta({ id: 'inlineDataSource' });

const groupedStandardQueryFieldZ = z
  .object({
    queryField: z.string().min(1),
    type: standardFieldTypeZ,
    label: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    nullable: z.boolean().optional(),
    collapsible: z.boolean().optional(),
    defaultFormat: valueFormatPresetZ.optional()
  });

const groupedMoneyQueryFieldZ = z.object({
  queryField: z.string().min(1),
  type: z.literal('money'),
  currency: z.literal('CNY'),
  label: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  nullable: z.boolean().optional(),
  collapsible: z.boolean().optional(),
  defaultFormat: valueFormatPresetZ.optional()
});

const groupedDimensionQueryFieldGroupZ = z
  .record(fieldNameZ, groupedStandardQueryFieldZ)
  .meta({ id: 'groupedDimensionQueryFieldGroup', minProperties: 1 });

const groupedMeasureQueryFieldGroupZ = z
  .record(
    fieldNameZ,
    z.discriminatedUnion('type', [
      groupedStandardQueryFieldZ,
      groupedMoneyQueryFieldZ
    ])
  )
  .meta({ id: 'groupedMeasureQueryFieldGroup', minProperties: 1 });

const groupedQueryFieldsZ = z
  .object({
    dimensions: groupedDimensionQueryFieldGroupZ.optional(),
    measures: groupedMeasureQueryFieldGroupZ.optional()
  })
  .meta({
    id: 'groupedQueryFields',
    anyOf: [{ required: ['dimensions'] }, { required: ['measures'] }]
  });

export const queryDataSourceDocumentZ = z
  .object({
    fields: z.union([queryFieldsZ, groupedQueryFieldsZ]),
    compute: computeZ.optional(),
    source: querySourceZ
  })
  .meta({ id: 'queryDataSource' });

export const dataSourceDocumentZ = z
  .union([inlineDataSourceZ, queryDataSourceDocumentZ])
  .meta({ id: 'dataSource' });
