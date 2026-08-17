import { z } from 'zod';
import {
  MAX_DETAIL_RECORDS,
  MAX_SEMANTIC_HTML_LENGTH,
  valueFormatPresets
} from '../field';

/**
 * 页面协议的基础形状：字段契约、字段引用/绑定、布局与数据槽绑定。
 * 这些定义供 `page.ts`（z.infer 推导领域类型）与 `schema.ts`
 * （z.toJSONSchema 生成结构校验）共用，是二者唯一的共同真源。
 */

export const idPattern = '^[a-z0-9][a-z0-9-]*$';
export const fieldPattern = '^[A-Za-z_][A-Za-z0-9_-]*$';

export const idZ = z.string().regex(new RegExp(idPattern));
export const fieldNameZ = z.string().regex(new RegExp(fieldPattern));
export const componentIdZ = idZ.meta({ id: 'componentId' });

export const scalarZ = z
  .union([z.string(), z.number(), z.boolean(), z.null()])
  .meta({ id: 'scalar' });

export const detailRecordZ = z
  .record(z.string(), scalarZ)
  .meta({ id: 'detailRecord' });

export const detailRecordListZ = z
  .array(detailRecordZ)
  .max(MAX_DETAIL_RECORDS)
  .meta({ id: 'detailRecordList' });

export const fieldValueZ = z
  .union([scalarZ, detailRecordListZ])
  .meta({ id: 'fieldValue' });

export const valueFormatPresetZ = z.enum(valueFormatPresets);

export const standardFieldTypeZ = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'datetime'
]);
export const fieldTypeZ = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'money'
]);
export const fieldRoleZ = z.enum(['dimension', 'measure', 'detail']);

const standardScalarFieldZ = z
  .object({
    type: standardFieldTypeZ,
    role: z.enum(['dimension', 'measure']),
    label: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    nullable: z.boolean().optional(),
    defaultFormat: valueFormatPresetZ.optional()
  })
  .strict();

const moneyFieldZ = z
  .object({
    type: z.literal('money'),
    role: z.literal('measure'),
    currency: z.literal('CNY'),
    label: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    nullable: z.boolean().optional(),
    defaultFormat: valueFormatPresetZ.optional()
  })
  .strict();

export const scalarFieldZ = z
  .discriminatedUnion('type', [standardScalarFieldZ, moneyFieldZ])
  .meta({ id: 'scalarField' });

const queryStandardScalarFieldZ = standardScalarFieldZ
  .extend({ queryField: z.string().min(1) })
  .strict();

const queryMoneyFieldZ = moneyFieldZ
  .extend({ queryField: z.string().min(1) })
  .strict();

export const queryScalarFieldZ = z
  .discriminatedUnion('type', [
    queryStandardScalarFieldZ,
    queryMoneyFieldZ
  ])
  .meta({ id: 'queryScalarField' });

const detailItemsZ = z
  .object({
    fields: z
      .record(fieldNameZ, scalarFieldZ)
      .meta({ minProperties: 1 })
  })
  .strict();

const queryDetailItemsZ = z
  .object({
    fields: z
      .record(fieldNameZ, queryScalarFieldZ)
      .meta({ minProperties: 1 })
  })
  .strict();

export const recordListFieldZ = z
  .object({
    type: z.literal('recordList'),
    role: z.literal('detail'),
    label: z.string().min(1).optional(),
    nullable: z.boolean().optional(),
    items: detailItemsZ
  })
  .strict()
  .meta({ id: 'recordListField' });

export const queryRecordListFieldZ = z
  .object({
    type: z.literal('recordList'),
    role: z.literal('detail'),
    queryField: z.string().min(1),
    label: z.string().min(1).optional(),
    nullable: z.boolean().optional(),
    items: queryDetailItemsZ
  })
  .strict()
  .meta({ id: 'queryRecordListField' });

export const semanticHtmlFieldZ = z
  .object({
    type: z.literal('semanticHtml'),
    role: z.literal('detail'),
    label: z.string().min(1).optional(),
    nullable: z.boolean().optional()
  })
  .strict()
  .meta({
    id: 'semanticHtmlField',
    description: `受控语义 HTML 字符串，最长 ${MAX_SEMANTIC_HTML_LENGTH} 字符`
  });

export const querySemanticHtmlFieldZ = z
  .object({
    type: z.literal('semanticHtml'),
    role: z.literal('detail'),
    queryField: z.string().min(1),
    label: z.string().min(1).optional(),
    nullable: z.boolean().optional()
  })
  .strict()
  .meta({
    id: 'querySemanticHtmlField',
    description: `DQE 返回的受控语义 HTML 字符串，最长 ${MAX_SEMANTIC_HTML_LENGTH} 字符`
  });

export const fieldZ = z
  .union([
    scalarFieldZ,
    recordListFieldZ,
    semanticHtmlFieldZ
  ])
  .meta({ id: 'field' });

export const queryFieldZ = z
  .union([
    queryScalarFieldZ,
    queryRecordListFieldZ,
    querySemanticHtmlFieldZ
  ])
  .meta({ id: 'queryField' });

export const fieldsZ = z
  .record(fieldNameZ, fieldZ)
  .meta({ id: 'fields', minProperties: 1 });

export const queryFieldsZ = z
  .record(fieldNameZ, queryFieldZ)
  .meta({ id: 'queryFields', minProperties: 1 });

/** 字段引用；字符串简写始终引用 `main` 数据槽。 */
export const fieldReferenceZ = z
  .union([
    fieldNameZ,
    z.object({ data: idZ, field: fieldNameZ }).strict()
  ])
  .meta({ id: 'fieldReference' });

/** 组件字段绑定；format 只控制当前视图。 */
export const fieldBindingZ = z
  .union([
    fieldNameZ,
    z
      .object({
        data: idZ,
        field: fieldNameZ,
        format: valueFormatPresetZ.optional().meta({
          description: '只控制当前组件中这一次字段绑定的展示格式'
        }),
        match: z
          .object({ field: fieldNameZ, equals: scalarZ })
          .strict()
          .optional()
      })
      .strict()
  ])
  .meta({ id: 'fieldBinding' });

export const componentLayoutZ = z
  .object({
    span: z.int().min(1).max(12),
    connectPrevious: z.boolean().optional()
  })
  .meta({ id: 'componentLayout' });

export const mainDataZ = z
  .object({ main: idZ })
  .meta({ id: 'mainData' });

export const tableDataZ = z
  .record(idZ, idZ)
  .meta({ id: 'tableData', minProperties: 1, required: ['main'] });

export const metricDataZ = z
  .object({
    main: idZ,
    compare: idZ.optional(),
    target: idZ.optional()
  })
  .meta({ id: 'metricData' });
