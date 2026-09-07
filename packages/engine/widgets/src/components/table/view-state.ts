export interface TableSortRule {
  field: string;
  direction: 'asc' | 'desc';
}

/** 表头筛选当前值:日期范围允许单端草稿,由壳决定何时写入查询通道。 */
export type TableHeaderFilterValue =
  | { mode: 'select'; values: string[] }
  | { mode: 'dateRange'; from: string; to: string };

/** 表格视图状态:由运行时/壳持有,组件只显示当前值并上抛变更。 */
export interface TableViewState {
  /** 当前页码(0 起)；查询分页的总页数由 totalCount 派生。 */
  pageIndex: number;
  /** 多列排序,数组序即优先级 */
  sort: TableSortRule[];
  /** 表头筛选当前值,key = 列 field;日期范围可包含单端草稿 */
  headerFilters: Record<string, TableHeaderFilterValue>;
}

/** 声明排序完整进入初始视图;是否可点击排序只影响组件交互,不改变查询语义。 */
export function initialTableSort(
  orderBy: readonly TableSortRule[] | undefined
): TableSortRule[] {
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

/** 单页数据不需要页大小、页码或上下页控件。 */
export function shouldShowTablePaginationControls(
  totalCount: number,
  pageSize: number
): boolean {
  return totalCount > pageSize;
}
