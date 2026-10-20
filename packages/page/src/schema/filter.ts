import { visibilityShape } from './condition';
import { z } from 'zod';
import { fieldNameZ, idZ, textValueZ } from './primitives';
const interaction = {hint:textValueZ.optional(),clearOnChangeOf:z.array(idZ).min(1).optional()};

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
    ...interaction,
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
    dependsOn: idZ.optional(),
    selection:z.object({mode:z.enum(['single','multiple']),required:z.boolean().optional(),allBehavior:z.enum(['values','unrestricted']).optional()}).strict().optional(),
    options:z.array(z.object({value:z.string().min(1),label:z.string().min(1),disabled:z.boolean().optional()}).strict()).min(1).max(1000).optional(),
    treeSelection:z.literal('level').optional(),
    candidateWindow:z.object({unit:z.literal('month'),n:z.literal(12),includeCurrent:z.boolean(),anchorFact:idZ.optional()}).strict().optional(),
    candidateContext:z.object({filterIds:z.array(idZ).min(1),reconcile:z.enum(['clear','intersection'])}).strict().optional()
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

const availabilityZ=z.object({fact:idZ,initial:z.enum(['latest','latestComplete']).optional(),max:z.enum(['latest','latestComplete']),blockMissing:z.literal(true).optional()}).strict();
const calendarExtras={min:z.string().optional(),max:z.string().optional(),blockedRanges:z.array(timeRangeValueZ).optional(),availability:availabilityZ.optional()};

const timeRangeFilterZ = z
  .object({
    ...interaction,
    id: idZ,
    urlParams: z.object({ value: z.string().min(1).optional(), from: z.string().min(1).optional(), to: z.string().min(1).optional(), level: z.string().min(1).optional() }).strict().optional(),
    type: z.literal('timeRange'),
    ...calendarExtras,disableFuture:z.boolean().optional(),
    display: z.enum(['period','modes']).optional(),
    modes:z.array(z.object({id:z.enum(['day','month','isoWeek']),default:z.union([timeRangeValueZ,relativeTimeExpressionZ])}).strict()).min(1).max(3).optional(),
    defaultMode:z.enum(['day','month','isoWeek']).optional(),
    presets:z.array(z.object({id:idZ,label:z.string().min(1),range:relativeTimeExpressionZ}).strict()).min(1).optional(),
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
    ...interaction,
    id: idZ,
    urlParams: z.object({ value: z.string().min(1).optional(), from: z.string().min(1).optional(), to: z.string().min(1).optional(), level: z.string().min(1).optional() }).strict().optional(),
    type: z.literal('timePoint'),
    label: z.string().optional(),
    visible: z.boolean().optional(),
    ...calendarExtras,
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
    ...interaction,
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
    ...interaction,
    id: idZ,
    urlParams: z.object({ value: z.string().min(1).optional(), from: z.string().min(1).optional(), to: z.string().min(1).optional(), level: z.string().min(1).optional() }).strict().optional(),
    type: z.literal('numberRange'),
    label: z.string().optional(),
    visible: z.boolean().optional(),
    ...visibilityShape,
    default: numberRangeValueZ.optional(),
    constraints:z.object({min:z.number().optional(),max:z.number().optional(),bounds:z.enum(['strict','inclusive']).optional()}).strict().optional(),
    units:z.object({filterId:idZ,cases:z.record(z.string().min(1),z.object({currency:z.enum(['CNY','USD']),label:z.string().min(1),scale:z.number().int().positive().max(Number.MAX_SAFE_INTEGER)}).strict())}).strict().optional(),
    presets:z.array(z.object({id:idZ,label:z.string().min(1),range:numberRangeValueZ}).strict()).min(1).optional()
  })
  .meta({ id: 'numberRangeFilter' });

const searchFilterZ = z
  .object({
    ...interaction,
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
