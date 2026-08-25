import type { Component, DataSnapshot, Row, TableColumn } from '@metriccanvas/page';
import type {
  NamedDataSlots,
  TableHeaderFilterValue,
  TablePaginationState,
  TableSelectedCell,
  TableSortRule,
  TableViewState
} from '@metriccanvas/widgets';

/**
 * 表格交互契约:视图状态与回调由统一运行时持有,组件分发只做转发。
 * 抽成显式契约,使 `ComponentRenderer` 不需要认识运行时的表格状态实现。
 */
export interface TableRenderBinding {
  view: TableViewState;
  selectedCell?: TableSelectedCell;
  filterOptions: Record<string, string[]>;
  pagination?: TablePaginationState;
  onpage: (pageIndex: number) => void;
  onpagesize: (pageSize: number) => void;
  onsort: (sort: TableSortRule[]) => void;
  onheaderfilter: (field: string, value: TableHeaderFilterValue | null) => void;
  oncellselect: (context: { rowIndex: number; column: TableColumn }) => void;
  onlink?: (context: { rowIndex: number; column: TableColumn; row: Row }) => void;
}

/** Tab 容器递归分发时,子组件的数据与交互仍由统一运行时提供。 */
export interface NestedComponentRender {
  data(component: Component): NamedDataSlots;
  snapshot(component: Component): DataSnapshot;
  table(component: Component): TableRenderBinding | undefined;
  onchartclick(component: Component): ((row: Row) => void) | undefined;
  map?(component: Component): 'china' | 'world' | undefined;
}

/**
 * 不经 WidgetHost 的组件:它们不声明数据槽,没有加载态与错误态可呈现。
 * 判定与 `isDataComponent` 同源但方向相反,单独命名是为了让组件分发
 * 里那条「特例分支」有名字可查。
 */
export function rendersWithoutWidgetHost(component: Component): boolean {
  return (
    component.type === 'reportHeader' ||
    component.type === 'text' ||
    component.type === 'aiSummary' ||
    component.type === 'tabContainer'
  );
}
