import { partialDataNotices } from './widget-host-state';
import type { Component, DataSnapshot, Row, TableColumn, TableComponent } from '@metriccanvas/page/internal';
import type {NamedDataSlots} from '../../widgets/src/shared/component-data';
import type {TableHeaderFilterValue,TablePaginationState,TableSelectedCell,TableSortRule,TableViewState} from '../../widgets/src/components/table/view-state';

/**
 * 表格交互契约:视图状态与回调由统一运行时持有,组件分发只做转发。
 * 抽成显式契约,使 `ComponentRenderer` 不需要认识运行时的表格状态实现。
 */
export interface TableRenderBinding {
  failureNotice?: string;
  expansion?: { page: import('@metriccanvas/page').Page; gateway: import('../../runtime/src').RuntimeDataGateway;
    selection?: import('../../runtime/src/table/hierarchy-selection').HierarchySelection;
    displaySnapshot?: import('@metriccanvas/page/internal').DisplaySnapshot; filterRevision?: number;
    filters: import('../../runtime/src').FilterValues; params: import('../../runtime/src').PageParamValues; instanceId: string };
  searchDraft?: string;
  searchOption?: string;
  onsearchoption?: (value: string) => void;
  exporting?: boolean;
  exportError?: string;
  onsearchdraft?: (query: string) => void;
  onsearch?: (query: string) => void;
  onexport?: () => void;
  oncancelexport?: () => void;
  view: TableViewState;
  sortReset?:readonly TableSortRule[];
  selectedCell?: TableSelectedCell;
  columnCandidates?: Record<string, import('../../runtime/src/table/column-candidates').ColumnCandidatesSnapshot>;
  oncandidateopen?: (field: string, open: boolean) => void;
  oncandidatesearch?: (field: string, query: string) => void;
  oncandidatemore?: (field: string) => void;
  oncandidateretry?: (field: string) => void;
  filterOptions: Record<string, string[]>;
  filterOptionsStatus?:Record<string,import('../../runtime/src/dimension-values').DimensionValuesSnapshot['status']>;
  pagination?: TablePaginationState;
  paginationConfig?: TableComponent['props']['pagination'];
  onpage: (pageIndex: number) => void;
  onpagesize: (pageSize: number) => void;
  onsort: (sort: TableSortRule[]) => void;
  onheaderfilter: (field: string, value: TableHeaderFilterValue | null) => void;
  oncellselect: (context: { rowIndex: number; column: TableColumn; row?:Row }) => void;
  interactionGate?: (row:Row,column:TableColumn)=>{eligible:boolean;enabled:boolean};
  toolbarEnabled?: {search:boolean;export:boolean};
  linkHref?: (row: Row, column?: TableColumn) => string | undefined;
  onlink?: (context: { rowIndex: number; column: TableColumn; row: Row }, event: MouseEvent) => void;
}

/** Tab 容器递归分发时,子组件的数据与交互仍由统一运行时提供。 */
export interface NestedComponentRender {
  textLinks?(component: Component): import('../../widgets/src/components/text/links').TextBlockLink[];
  summarySnapshot?(component: Component): import('./ai-summary').AiSummarySnapshot | undefined;
  data(component: Component): NamedDataSlots;
  snapshot(component: Component): DataSnapshot;
  table(component: Component): TableRenderBinding | undefined;
  onchartclick(component: Component): ((row: Row) => void) | undefined;
  onmetriclink(component: Component): ((row: Row, event: MouseEvent) => void) | undefined;
  metricHref(component: Component): (row: Row) => string | undefined;
  map?(component: Component): 'china' | 'world' | undefined;
}

/**
 * 走不走 WidgetHost 的判定与它呈现的宿主态是同一件事的两半,因此同住
 * `widget-host-state`:那份源文件只依赖页面领域类型,可以单测;本文件的表格
 * 契约要认识 widgets 的视图类型,进不了纯 TS 的测试程序。
 */
export { rendersWithoutWidgetHost } from './widget-host-state';

/** Preserve the existing notice presentation while distinguishing union failures from empty results. */
export function componentDataNotices(component: Component, snapshot: DataSnapshot, snapshots: ReadonlyMap<string, DataSnapshot>, table?: TableRenderBinding): string[] {
  if (snapshot.status === 'error' && table?.failureNotice) return [table.failureNotice];
  return partialDataNotices(component, snapshots, table?.paginationConfig?.mode === 'query');
}
