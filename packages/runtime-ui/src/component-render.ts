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
  onmetriclink(component: Component): ((row: Row) => void) | undefined;
  map?(component: Component): 'china' | 'world' | undefined;
}

/**
 * 走不走 WidgetHost 的判定与它呈现的宿主态是同一件事的两半,因此同住
 * `widget-host-state`:那份源文件只依赖页面领域类型,可以单测;本文件的表格
 * 契约要认识 widgets 的视图类型,进不了纯 TS 的测试程序。
 */
export { rendersWithoutWidgetHost } from './widget-host-state';
