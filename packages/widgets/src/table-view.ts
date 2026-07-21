import type { FilterCondition, OrderByRule } from '@metriccanvas/page';

/** 表头筛选当前值:日期范围允许单端草稿,由壳决定何时写入查询通道。 */
export type TableHeaderFilterValue =
  | { mode: 'select'; values: string[] }
  | { mode: 'dateRange'; from: string; to: string };

/** 表格视图状态:由运行时/壳持有,组件只显示当前值并上抛变更。 */
export interface TableViewState {
  /** 当前页码(0 起);盲翻设计,不存在总页数 */
  pageIndex: number;
  /** 多列排序,数组序即优先级 */
  sort: OrderByRule[];
  /** 表头筛选当前值,key = 列 field;日期范围可包含单端草稿 */
  headerFilters: Record<string, TableHeaderFilterValue>;
}

/** 声明排序完整进入初始视图;是否可点击排序只影响组件交互,不改变查询语义。 */
export function initialTableSort(
  orderBy: readonly OrderByRule[] | undefined
): OrderByRule[] {
  return (orderBy ?? []).map((rule) => ({ ...rule }));
}

/** select、完整日期范围和清空可立即写入查询;单端日期范围仅用于界面回显。 */
export function shouldApplyTableHeaderFilter(
  value: TableHeaderFilterValue | null
): boolean {
  return (
    value === null ||
    value.mode === 'select' ||
    (value.from.length > 0 && value.to.length > 0)
  );
}

/** 将已生效表头筛选翻译为查询条件;防御性忽略单端日期范围。 */
export function tableHeaderFilterConditions(
  filters: Record<string, TableHeaderFilterValue>
): FilterCondition[] {
  const conditions: FilterCondition[] = [];
  for (const [field, value] of Object.entries(filters)) {
    if (value.mode === 'select') {
      conditions.push({ dimension: field, operator: 'in', value: value.values });
    } else if (value.from && value.to) {
      conditions.push({
        dimension: field,
        operator: 'between',
        value: [value.from, value.to]
      });
    }
  }
  return conditions;
}
