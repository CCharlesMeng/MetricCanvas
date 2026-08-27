import { z } from 'zod';
import { fieldNameZ, idZ } from './primitives';

/**
 * 页面级筛选器声明。领域态 `FilterDeclaration`（`filter.ts`）与这里的
 * z.infer 结构一致，`Page.filters` 直接复用本模块的类型。
 */

const filterHierarchyLevelZ = z
  .object({
    id: idZ,
    dimension: fieldNameZ,
    label: z.string().optional()
  })
  .strict();

const dimensionFilterZ = z
  .object({
    id: idZ,
    type: z.literal('dimension'),
    dimension: fieldNameZ,
    label: z.string().optional(),
    /** 空选时的控件文案；缺省仍为“全部”。 */
    emptyLabel: z.string().min(1).optional(),
    /** 层级声明的级别切换器；缺省显示，地图等其它交互可承担切层时可隐藏。 */
    hierarchyPicker: z.enum(['tabs', 'hidden']).optional(),
    display: z.enum(['select', 'tabs', 'tree', 'search']).optional(),
    visible: z.boolean().optional(),
    default: z.array(z.string()).optional(),
    hierarchy: z.array(filterHierarchyLevelZ).min(2).optional(),
    defaultLevel: idZ.optional(),
    dependsOn: idZ.optional()
  })
  .meta({ id: 'dimensionFilter' });

const timeRangeValueZ = z.object({ from: z.string(), to: z.string() }).strict();

const relativeTimeRangeZ = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lastN'), n: z.int().min(1) }).strict(),
  z.object({ kind: z.literal('previousComplete') }).strict(),
  z.object({ kind: z.literal('currentToDate') }).strict()
]);

const relativeTimeExpressionZ = z
  .object({
    unit: z.enum(['day', 'week', 'month', 'quarter', 'year']),
    range: relativeTimeRangeZ,
    includeCurrent: z.boolean(),
    anchor: z.string().optional()
  })
  .strict()
  .meta({ id: 'relativeTimeExpression' });

const timeRangeFilterZ = z
  .object({
    id: idZ,
    type: z.literal('timeRange'),
    label: z.string().optional(),
    precision: z.enum(['date', 'datetime']).optional(),
    visible: z.boolean().optional(),
    default: z
      .union([
        z.enum(['today', 'last7d', 'last30d', 'last90d']),
        timeRangeValueZ,
        relativeTimeExpressionZ
      ])
      .optional()
  })
  .meta({ id: 'timeRangeFilter' });

const timePointFilterZ = z
  .object({
    id: idZ,
    type: z.literal('timePoint'),
    label: z.string().optional(),
    visible: z.boolean().optional(),
    granularity: z.enum(['month', 'date']),
    default: z.string().optional()
  })
  .meta({ id: 'timePointFilter' });

const booleanFilterZ = z
  .object({
    id: idZ,
    type: z.literal('boolean'),
    label: z.string().optional(),
    visible: z.boolean().optional(),
    default: z.boolean().optional()
  })
  .meta({ id: 'booleanFilter' });

const numberRangeValueZ = z
  .object({
    from: z.number().optional(),
    to: z.number().optional()
  })
  .strict();

const numberRangeFilterZ = z
  .object({
    id: idZ,
    type: z.literal('numberRange'),
    label: z.string().optional(),
    visible: z.boolean().optional(),
    default: numberRangeValueZ.optional()
  })
  .meta({ id: 'numberRangeFilter' });

const searchFilterZ = z
  .object({
    id: idZ,
    type: z.literal('search'),
    label: z.string().optional(),
    visible: z.boolean().optional(),
    default: z.string().optional()
  })
  .meta({ id: 'searchFilter' });

export const filterDeclarationZ = z.discriminatedUnion('type', [
  dimensionFilterZ,
  timeRangeFilterZ,
  timePointFilterZ,
  booleanFilterZ,
  numberRangeFilterZ,
  searchFilterZ
]);
