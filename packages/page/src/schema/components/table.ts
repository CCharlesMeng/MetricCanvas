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
import { actionsZ } from '../actions';
import { componentCatalogRegistry } from '../registry';

/**
 * 表格列是递归形状（分组列的 children 复用 TableColumnNode），zod 的类型推导
 * 在自引用场景需要显式标注（zod 的已知限制），因此这里手写递归接口、
 * 用 `z.ZodType<T>` 约束 zod 定义与之一致，而不是反过来用 z.infer 推导。
 * 一旦两者出现结构性偏差，TS 编译会直接失败，效果等同于单一真源。
 */
export type TableSelectionWrite = { field: FieldReference } | { value: string };

export interface TableCellSelection {
  writes: Record<string, TableSelectionWrite>;
}

export interface TableColumn {
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
  filterable?: { mode: 'select' | 'dateRange' };
  /**
   * 该列是行点击导航入口(ADR-0049)。只有声明了的列才响应 navigate;
   * 与 `selection` 同时存在时以 `selection` 为准。
   */
  link?: boolean;
  align?: 'left' | 'right';
  emphasis?: 'strong';
  visual?: 'plain' | 'rateBar' | 'signed';
}

export interface TableColumnGroup {
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
    writes: z.record(idZ, tableCellSelectionWriteZ).meta({ minProperties: 1 })
  })
  .strict();

const tableColumnZ: z.ZodType<TableColumn> = z
  .object({
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
    filterable: z.object({ mode: z.enum(['select', 'dateRange']) }).strict().optional(),
    link: z.boolean().optional(),
    align: z.enum(['left', 'right']).optional(),
    emphasis: z.literal('strong').optional(),
    visual: z.enum(['plain', 'rateBar', 'signed']).optional()
  })
  .strict()
  .meta({ id: 'tableColumn' });

const tableColumnGroupZ: z.ZodType<TableColumnGroup> = z.lazy(() =>
  z
    .object({
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

export const tableComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('table'),
    layout: componentLayoutZ,
    data: tableDataZ,
    props: z
      .object({
        title: textValueZ.optional(),
        subtitle: textValueZ.optional(),
        variant: z.enum(['reportCompact', 'embedded', 'forecastMatrix']).optional(),
        /** 容器底部的渐隐提示；只表示有更多纵向内容，不改变数据。 */
        bottomFade: z.boolean().optional(),
        compoundCellLayout: z.literal('inline').optional(),
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
