import { z } from 'zod';
import { valueFormatPresets } from '../field';

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

export const valueFormatPresetZ = z.enum(valueFormatPresets);

export const fieldTypeZ = z.enum(['string', 'number', 'boolean', 'date', 'datetime']);
export const fieldRoleZ = z.enum(['dimension', 'measure']);

export const fieldZ = z
  .object({
    type: fieldTypeZ,
    role: fieldRoleZ,
    label: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    nullable: z.boolean().optional(),
    defaultFormat: valueFormatPresetZ.optional()
  })
  .meta({ id: 'field' });

export const queryFieldZ = z
  .object({
    type: fieldTypeZ,
    role: fieldRoleZ,
    queryField: z.string().min(1),
    label: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    nullable: z.boolean().optional(),
    defaultFormat: valueFormatPresetZ.optional()
  })
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
