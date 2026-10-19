import { visibilityShape } from './condition';
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
    urlParams: z.object({ value: z.string().min(1).optional(), from: z.string().min(1).optional(), to: z.string().min(1).optional(), level: z.string().min(1).optional() }).strict().optional(),
    type: z.literal('dimension'),
    dimension: fieldNameZ,
    label: z.string().optional(),
    /** 空选时的控件文案；缺省仍为“全部”。 */
    emptyLabel: z.string().min(1).optional(),
    /** 层级声明的级别切换器；缺省显示，地图等其它交互可承担切层时可隐藏。 */
    hierarchyPicker: z.enum(['tabs', 'hidden']).optional(),
    display: z.enum(['select', 'tabs', 'tree', 'search']).optional(),
    visible: z.boolean().optional(),
    ...visibilityShape,
    default: z.array(z.string()).optional(),
    initialParam: idZ.optional(),
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

const periodSelectionZ = z.union([z.object({mode:z.enum(['year','quarter','month']),value:z.string().optional()}).strict(),z.object({mode:z.literal('last12Months')}).strict()]).meta({id:'periodSelection'});

const timeRangeFilterZ = z
  .object({
    id: idZ,
    urlParams: z.object({ value: z.string().min(1).optional(), from: z.string().min(1).optional(), to: z.string().min(1).optional(), level: z.string().min(1).optional() }).strict().optional(),
    type: z.literal('timeRange'),
    display: z.literal('period').optional(),
    initialMode: z.enum(['year','quarter','month']).optional(),
    label: z.string().optional(),
    precision: z.enum(['month', 'date', 'datetime']).optional(),
    initialParam: idZ.optional(),
    required: z.boolean().optional(),
    visible: z.boolean().optional(),
    ...visibilityShape,
    default: z
      .union([
        z.enum(['today', 'last7d', 'last30d', 'last90d']),
        timeRangeValueZ,
        relativeTimeExpressionZ,
        periodSelectionZ
      ])
      .optional()
  })
  .meta({ id: 'timeRangeFilter' });

const timePointFilterZ = z
  .object({
    id: idZ,
    urlParams: z.object({ value: z.string().min(1).optional(), from: z.string().min(1).optional(), to: z.string().min(1).optional(), level: z.string().min(1).optional() }).strict().optional(),
    type: z.literal('timePoint'),
    label: z.string().optional(),
    visible: z.boolean().optional(),
    ...visibilityShape,
    granularity: z.enum(['month', 'date']),
    min: z.string().optional(),
    disableFuture: z.boolean().optional(),
    required: z.boolean().optional(),
    default: z.string().optional(),
    initialParam: idZ.optional()
  })
  .meta({ id: 'timePointFilter' });

const booleanFilterZ = z
  .object({
    id: idZ,
    urlParams: z.object({ value: z.string().min(1).optional(), from: z.string().min(1).optional(), to: z.string().min(1).optional(), level: z.string().min(1).optional() }).strict().optional(),
    type: z.literal('boolean'),
    label: z.string().optional(),
    visible: z.boolean().optional(),
    ...visibilityShape,
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
    urlParams: z.object({ value: z.string().min(1).optional(), from: z.string().min(1).optional(), to: z.string().min(1).optional(), level: z.string().min(1).optional() }).strict().optional(),
    type: z.literal('numberRange'),
    label: z.string().optional(),
    visible: z.boolean().optional(),
    ...visibilityShape,
    default: numberRangeValueZ.optional()
  })
  .meta({ id: 'numberRangeFilter' });

const searchFilterZ = z
  .object({
    id: idZ,
    urlParams: z.object({ value: z.string().min(1).optional(), from: z.string().min(1).optional(), to: z.string().min(1).optional(), level: z.string().min(1).optional() }).strict().optional(),
    type: z.literal('search'),
    label: z.string().optional(),
    visible: z.boolean().optional(),
    ...visibilityShape,
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
