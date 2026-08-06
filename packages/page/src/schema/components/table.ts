import { z } from 'zod';
import type { FieldBinding, FieldReference } from '../../field';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  fieldNameZ,
  fieldReferenceZ,
  idZ,
  tableDataZ
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
    title: z.string().optional(),
    width: z.int().min(1).optional(),
    fixed: z.enum(['left', 'right']).optional(),
    sortable: z.boolean().optional(),
    filterable: z.object({ mode: z.enum(['select', 'dateRange']) }).strict().optional(),
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
      title: z.string().min(1),
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
        title: z.string().optional(),
        subtitle: z.string().optional(),
        rowKey: fieldNameZ.optional(),
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
  purpose: '展示需要逐行核对、排序、筛选或通过单元格选择联动明细的记录',
  chooseWhen: ['明细、列表、字段较多、需要精确值、多级表头、选择一行联动下方明细'],
  dataShape: '一个或多个 dimension/metric 字段组成的多行记录',
  title: 'optional',
  defaultSpan: 12
});
