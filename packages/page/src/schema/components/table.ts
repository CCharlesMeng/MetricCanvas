import { conditionZ, interactionShape, visibilityShape } from '../condition';
import { z } from 'zod';
import type { FieldBinding, FieldReference } from '../../field';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  fieldNameZ,
  fieldReferenceZ,
  idZ,
  nonEmptyTextValueZ,
  tableDataZ,
  textValueZ
} from '../primitives';
import { actionsZ, openDetailActionZ } from '../actions';
import { navigationBindingZ, navigationTargetZ, type NavigationTarget } from '../navigation';
import { componentCatalogRegistry } from '../registry';
import { colorRuleZ, type ColorRule } from '../presentation';

/**
 * 表格列是递归形状（分组列的 children 复用 TableColumnNode），zod 的类型推导
 * 在自引用场景需要显式标注（zod 的已知限制），因此这里手写递归接口、
 * 用 `z.ZodType<T>` 约束 zod 定义与之一致，而不是反过来用 z.infer 推导。
 * 一旦两者出现结构性偏差，TS 编译会直接失败，效果等同于单一真源。
 */
export type TableSelectionWrite = { field: FieldReference } | { value: string };

export interface TableCellSelection {
  visibleWhen?: import('../condition').Condition;
  enabledWhen?: import('../condition').Condition;
  writes: Record<string, TableSelectionWrite>;
}

export interface TablePinnedCell {
  field: FieldBinding;
  secondaryField?: FieldBinding;
  badgeField?: FieldBinding;
}

export interface TableColumn {
  pinnedTop?: TablePinnedCell;
  visibleWhen?: import('../condition').Condition;
  kind?: 'field';
  field: FieldBinding;
  secondaryField?: FieldBinding;
  badgeField?: FieldBinding;
  dangerValues?: string[];
  selection?: TableCellSelection;
  title?: string;
  width?: number;
  fixed?: 'left' | 'right';
  sortable?: boolean;
  filterable?: { mode: 'select' | 'dateRange' | 'numberRange' };
  /**
   * 该列是行点击导航入口(ADR-0049)。只有声明了的列才响应 navigate;
   * 与 `selection` 同时存在时以 `selection` 为准。
   */
  link?: boolean;
  openDetail?: z.infer<typeof openDetailActionZ>['openDetail'];
  navigate?: NavigationTarget;
  navigateBySource?: { field: string; cases: Record<string, NavigationTarget> };
  align?: 'left' | 'right';
  emphasis?: 'strong';
  visual?: 'plain' | 'rateBar' | 'signed';
  colorRule?: ColorRule;
}

export interface TableColumnGroup {
  visibleWhen?: import('../condition').Condition;
  kind: 'group';
  id: string;
  title: string;
  children: TableColumnNode[];
}

export type TableColumnNode = TableColumn | TableColumnGroup;

const tableCellSelectionWriteZ: z.ZodType<TableSelectionWrite> = z.union([
  z.object({ field: fieldReferenceZ }).strict(),
  z.object({ value: z.string() }).strict()
]);

const tableCellSelectionZ: z.ZodType<TableCellSelection> = z
  .object({
    ...interactionShape,
    writes: z.record(idZ, tableCellSelectionWriteZ).meta({ minProperties: 1 })
  })
  .strict();

const tableColumnZ: z.ZodType<TableColumn> = z
  .object({
    pinnedTop: z.object({ field: fieldBindingZ, secondaryField: fieldBindingZ.optional(), badgeField: fieldBindingZ.optional() }).strict().optional(),
    ...visibilityShape,
    kind: z.literal('field').optional(),
    field: fieldBindingZ,
    secondaryField: fieldBindingZ.optional(),
    badgeField: fieldBindingZ.optional(),
    dangerValues: z.array(z.string()).meta({ uniqueItems: true }).optional(),
    selection: tableCellSelectionZ.optional(),
    title: textValueZ.optional(),
    width: z.int().min(1).optional(),
    fixed: z.enum(['left', 'right']).optional(),
    sortable: z.boolean().optional(),
    filterable: z.object({ mode: z.enum(['select', 'dateRange', 'numberRange']) }).strict().optional(),
    link: z.boolean().optional(),
    openDetail: openDetailActionZ.shape.openDetail.optional(),
    navigate: navigationTargetZ.optional(),
    navigateBySource: z.object({ field: fieldNameZ, cases: z.record(z.string().min(1), navigationTargetZ).meta({ minProperties: 1 }) }).strict().optional(),
    align: z.enum(['left', 'right']).optional(),
    emphasis: z.literal('strong').optional(),
    visual: z.enum(['plain', 'rateBar', 'signed']).optional(),
    colorRule: colorRuleZ.optional()
  })
  .strict()
  .meta({ id: 'tableColumn' });

const tableColumnGroupZ: z.ZodType<TableColumnGroup> = z.lazy(() =>
  z
    .object({
      ...visibilityShape,
      kind: z.literal('group'),
      id: idZ,
      title: nonEmptyTextValueZ,
      children: z.array(tableColumnNodeZ).min(1)
    })
    .strict()
    .meta({ id: 'tableColumnGroup' })
);

export const tableColumnNodeZ: z.ZodType<TableColumnNode> = z
  .union([tableColumnZ, tableColumnGroupZ])
  .meta({ id: 'tableColumnNode' });

const paginationZ = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }).strict(),
  z
    .object({
      mode: z.literal('local'),
      pageSize: z.int().min(1),
      numbered: z.boolean().optional()
    })
    .strict(),
  z.object({ mode: z.literal('query') }).strict()
]);

const rowNumberZ = z.object({
  title: textValueZ.optional(),
  width: z.int().min(1).optional(),
  fixed: z.literal('left').optional()
}).strict();

const rowTableZ = z.object({
  title: textValueZ.optional(),
  rowNumber: rowNumberZ.optional(),
  rowKey: fieldNameZ,
  columns: z.array(tableColumnNodeZ).min(1),
  fit: z.enum(['content', 'container']).optional(),
  pagination: paginationZ.optional(),
  toolbar: z.object({ search: z.object({
    fields: z.array(fieldNameZ).min(1).max(64).meta({ uniqueItems: true }),
    placeholder: textValueZ.optional()
  }).strict().optional() }).strict().optional()
}).strict().meta({ id: 'rowExpansionTable' });

const expansionBindingZ = z.union([navigationBindingZ, z.object({ source: z.literal('selection') }).strict()]);
const hierarchySelectionZ = z.object({
  filter: idZ, parentLevel: idZ, parentField: fieldNameZ, childLevel: idZ,
  parentLookup: z.object({ source: idZ, field: fieldNameZ,
    filters: z.array(idZ).min(1).meta({ uniqueItems: true }),
    bindings: z.record(idZ, z.union([navigationBindingZ.options[1], navigationBindingZ.options[2]])).meta({ minProperties: 1 })
  }).strict()
}).strict();
const rowExpansionZ = z.object({
  selection: hierarchySelectionZ.optional(),
  mode: z.enum(['multiple', 'single']).optional(),
  data: z.discriminatedUnion('type', [
    z.object({ type: z.literal('recordList'), field: fieldNameZ }).strict(),
    z.object({ type: z.literal('query'), source: idZ,
      filters: z.array(idZ).min(1).meta({ uniqueItems: true }),
      bindings: z.record(idZ, expansionBindingZ).meta({ minProperties: 1 })
    }).strict()
  ]),
  table: rowTableZ
}).strict().meta({ id: 'tableRowExpansion' });

export const tableComponentZ = z
  .object({
    id: componentIdZ,
    ...visibilityShape,
    type: z.literal('table'),
    layout: componentLayoutZ,
    data: tableDataZ,
    props: z
      .object({
        rowVisibleWhen: conditionZ.optional(),
        title: textValueZ.optional(),
        subtitle: textValueZ.optional(),
        toolbar: z.object({
          search: z.union([z.object({
            ...interactionShape,
            fields: z.array(fieldNameZ).min(1).max(64).meta({ uniqueItems: true }),
            placeholder: textValueZ.optional()
          }).strict(), z.object({
            ...interactionShape,
            options: z.array(z.object({
              value: idZ,
              label: nonEmptyTextValueZ,
              field: fieldNameZ,
              placeholder: textValueZ.optional()
            }).strict()).min(1).max(64),
            defaultValue: idZ.optional()
          }).strict()]).optional(),
          export: z.object({
            ...interactionShape,
            format: z.literal('xlsx'),
            rowExpansion: z.object({ scope: z.literal('all'), parentFields: z.array(fieldNameZ).min(1).meta({ uniqueItems: true }) }).strict().optional(),
            filename: textValueZ.optional()
          }).strict().optional()
        }).strict().optional(),
        variant: z.enum(['reportCompact', 'embedded', 'forecastMatrix']).optional(),
        /** 容器底部的渐隐提示；只表示有更多纵向内容，不改变数据。 */
        bottomFade: z.boolean().optional(),
        compoundCellLayout: z.literal('inline').optional(),
        /** 呈现列：不占用页面字段；按当前行集顺序从 1 开始，分页连续。 */
        rowNumber: rowNumberZ.optional(),
        pinnedTop: z.object({ data: idZ }).strict().optional(),
        rowKey: fieldNameZ.optional(),
        /**
         * 行类别字段（ADR-0049）：取值来自计算阶段折叠算子写入的闭集，
         * 表格按它套用明细 / 小计 / 合计三档呈现。表格只识别，不计算。
         */
        rowKindField: fieldNameZ.optional(),
        /**
         * 按字段合并相邻同值单元格。合并是确定性渲染规则，页面文档只声明
         * 按哪个字段合并；不引入 rowSpan 数值——排序或筛选一变它立刻失效。
         */
        mergeBy: fieldNameZ.optional(),
        fit: z.enum(['content', 'container']).optional(),
        columns: z.array(tableColumnNodeZ).min(1),
        pagination: paginationZ.optional(),
        rowExpansion: rowExpansionZ.optional(),
        actions: actionsZ.optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'tableComponent' });

componentCatalogRegistry.add(tableComponentZ, {
  label: '明细表',
  aliases: ['表格', '列表'],
  purpose: '展示需要逐行核对、排序、筛选或通过单元格选择联动明细的记录',
  chooseWhen: ['明细、列表、字段较多、需要精确值、多级表头、选择一行联动下方明细'],
  dataShape: '一个或多个 dimension/metric 字段组成的多行记录',
  authoringShape: { bindsData: true, minScalarFields: 1 },
  title: 'optional',
  defaultSpan: 12
});
