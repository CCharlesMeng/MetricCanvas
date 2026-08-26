import { z } from 'zod';
import { rowKinds } from '../compute';
import { fieldNameZ } from './primitives';

/**
 * 受控计算阶段的封闭具名算子(ADR-0046)。
 * 参数只有字段引用与封闭枚举——没有可求值的字符串,没有通用运算。
 */

const rowKindMarkZ = z
  .object({
    field: fieldNameZ,
    value: z.enum(rowKinds)
  })
  .strict()
  .meta({
    id: 'rowKindMark',
    description: '折叠行写入的行类别字段与取值；表格按同一闭集识别呈现档位'
  });

const ratioOperatorZ = z
  .object({
    op: z.literal('ratio'),
    numerator: fieldNameZ,
    denominator: fieldNameZ,
    output: fieldNameZ,
    onZeroDenominator: z.enum(['null', 'zero']).meta({
      description: '分母为零或缺失时取空还是取零；必须显式声明，默认值会静默改数'
    }),
    scale: z
      .literal(100)
      .optional()
      .meta({
        description:
          '输出刻度；缺省产出 0–1 分数，100 产出 0–100。闭集只有 100，' +
          '开放数值等于在算子里引入乘法表达式'
      })
  })
  .strict();

const deltaOperatorZ = z
  .object({
    op: z.literal('delta'),
    minuend: fieldNameZ,
    subtrahend: fieldNameZ,
    output: fieldNameZ
  })
  .strict();

const groupSubtotalOperatorZ = z
  .object({
    op: z.literal('groupSubtotal'),
    groupBy: fieldNameZ,
    measures: z.array(fieldNameZ).min(1).meta({ uniqueItems: true }),
    rowKind: rowKindMarkZ,
    labelSuffix: z.string().min(1).optional()
  })
  .strict();

const grandTotalOperatorZ = z
  .object({
    op: z.literal('grandTotal'),
    measures: z.array(fieldNameZ).min(1).meta({ uniqueItems: true }),
    rowKind: rowKindMarkZ,
    label: z
      .object({ field: fieldNameZ, value: z.string().min(1) })
      .strict()
  })
  .strict();

const pivotColumnZ = z
  .object({
    output: fieldNameZ,
    categories: z.array(z.string().min(1)).min(1).meta({
      uniqueItems: true,
      description: '有序类别取值，取第一个命中的'
    })
  })
  .strict();

const pivotOperatorZ = z
  .object({
    op: z.literal('pivot'),
    categoryField: fieldNameZ,
    valueField: fieldNameZ,
    columns: z.array(pivotColumnZ).min(1),
    keyFields: z.array(fieldNameZ).meta({ uniqueItems: true }).optional()
  })
  .strict();

export const computeOperatorZ = z
  .discriminatedUnion('op', [
    ratioOperatorZ,
    deltaOperatorZ,
    groupSubtotalOperatorZ,
    grandTotalOperatorZ,
    pivotOperatorZ
  ])
  .meta({ id: 'computeOperator' });

export const computeZ = z
  .array(computeOperatorZ)
  .min(1)
  .meta({
    id: 'compute',
    description: '页面数据源的受控计算阶段；算子按声明顺序作用于已归一化的行集'
  });
