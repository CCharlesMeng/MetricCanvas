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

export const textValueReferenceZ = z
  .object({
    param: idZ,
    format: valueFormatPresetZ.optional().meta({
      description: '引用处的展示格式；复用组件字段绑定的同一套封闭闭集'
    })
  })
  .strict()
  .meta({
    id: 'textValueReference',
    description: '对一个页面参数的整值引用；不是模板插值，不参与拼接'
  });

/*
 * 文本取值（ADR-0047）：一切渲染为用户可见文本的属性位置都接受字面量或
 * 对页面参数的整值引用。规则落在位置上，不按组件类型维护白名单。
 *
 * 领域态不保留引用——`materializePageDocument` 在解析接缝把引用整值替换为
 * 字符串（可选参数缺失时该属性视为未声明）。因此这里显式把 `z.infer` 的
 * 结果固定为 `string`：JSON Schema 侧照常产出联合，而 `Page` 与全部纯渲染
 * 组件继续只面对字符串，不需要在每个消费点各写一遍解包。
 */
type TextValueSchema = z.ZodType<string>;

export const textValueZ = z
  .union([z.string(), textValueReferenceZ])
  .meta({ id: 'textValue' }) as unknown as TextValueSchema;

/** 非空文本取值：字面量必须非空；引用的非空性由参数取值保证。 */
export const nonEmptyTextValueZ = z
  .union([z.string().min(1), textValueReferenceZ])
  .meta({ id: 'nonEmptyTextValue' }) as unknown as TextValueSchema;

export const pageParamZ = z
  .object({
    id: idZ,
    type: z.enum(['string', 'number', 'boolean']),
    required: z.boolean(),
    label: z.string().min(1).optional(),
    default: z.union([z.string(), z.number(), z.boolean()]).optional()
  })
  .strict()
  .meta({
    id: 'pageParam',
    description: '页面参数：打开页面时由 URL 确定、此后不可改变的具名输入'
  });

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

/**
 * 可折叠度量声明（ADR-0046）：折叠已返回数据行的算子只能作用于显式声明了
 * 可折叠的度量字段。它是 ADR-0033 恢复条件（指标条目的可加性）无法满足时
 * 的可校验替代——比可加性弱，但让错误可见、可审计、可在评审时被质疑。
 */
const collapsibleZ = z.boolean().optional();

const standardScalarFieldZ = z
  .object({
    type: standardFieldTypeZ,
    role: z.enum(['dimension', 'measure']),
    label: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    nullable: z.boolean().optional(),
    collapsible: collapsibleZ,
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
    collapsible: collapsibleZ,
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
    querySemanticHtmlFieldZ,
    /*
     * 计算阶段产出字段（ADR-0046）：与查询字段一样就地声明类型、角色、标签、
     * 单位与可空性，区别只是不声明 `queryField`——它不来自外部响应。
     */
    scalarFieldZ
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

/**
 * 叠放层：分区内组件相对同分区其他组件的层次。缺省是普通流，唯一的
 * 非缺省档位 `backdrop` 把组件铺满分区并置于其余组件之下；其余组件
 * 仍按 12 列网格自动流排布，不声明坐标。窄屏退化行为由统一运行时定义。
 */
export const componentLayerZ = z.enum(['backdrop']).meta({
  id: 'componentLayer',
  description: 'backdrop 铺满分区并置于同分区其余组件之下；省略为普通流'
});

export const componentLayoutZ = z
  .object({
    span: z.int().min(1).max(12),
    connectPrevious: z.boolean().optional(),
    layer: componentLayerZ.optional()
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
