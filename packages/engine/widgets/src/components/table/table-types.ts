import type { Snippet } from 'svelte';
import type { Row, TableColumn, TableProps as TableComponentProps } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../shared/component-data';
import type {
  TableColumnCandidates,
  TableHeaderFilterValue,
  TablePaginationState,
  TableSelectedCell,
  TableSortRule,
  TableViewState
} from './view-state';

export type TableFilterOptionStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'unavailable'
  | 'error'
  | 'denied'
  | 'unconfigured';

export interface TableExpansionControl {
  key(row: Row): string | undefined;
  expanded(row: Row): boolean;
  toggle(row: Row): void;
  id: string;
}

export interface TableInteractionCallbacks {
  oncellselect?: (context: { rowIndex: number; column: TableColumn; row?: Row }) => void;
  onlink?: (context: { rowIndex: number; column: TableColumn; row: Row }, event: MouseEvent) => void;
  interactionGate?: (row: Row, column: TableColumn) => { eligible: boolean; enabled: boolean };
  linkHref?: (row: Row, column?: TableColumn) => string | undefined;
}

export interface TableHeaderFilterSource {
  columnCandidates?: Record<string, TableColumnCandidates>;
  filterOptions: Record<string, string[]>;
  filterOptionsStatus: Record<string, TableFilterOptionStatus>;
  oncandidateopen?: (field: string, open: boolean) => void;
  oncandidatesearch?: (field: string, query: string) => void;
  oncandidatemore?: (field: string) => void;
  oncandidateretry?: (field: string) => void;
  onheaderfilter?: (field: string, value: TableHeaderFilterValue | null) => void;
}

export interface TableWidgetProps extends TableInteractionCallbacks {
  /** 已解析的 main 数据槽；rows 为空时表格仍呈现表头。 */
  nested?: boolean;
  expansion?: TableExpansionControl;
  expandedRow?: Snippet<[Row]>;
  data: NamedDataSlots & { main: NonNullable<NamedDataSlots['main']> };
  props: TableComponentProps;
  /** 是否呈现排序、表头筛选和分页交互;缺省 true 保持存量行为 */
  interactive?: boolean;
  /** 当前视图状态(页码/排序/表头筛选),由壳持有 */
  view: TableViewState;
  /** select 模式表头筛选候选项（兼容静态输入；运行时候选由列候选会话供给）,key = 列 field */
  columnCandidates?: Record<string, TableColumnCandidates>;
  oncandidatepreloadvisible?: (visible: boolean) => void;
  oncandidateopen?: (field: string, open: boolean) => void;
  oncandidatesearch?: (field: string, query: string) => void;
  oncandidatemore?: (field: string) => void;
  oncandidateretry?: (field: string) => void;
  filterOptions?: Record<string, string[]>;
  filterOptionsStatus?: Record<string, TableFilterOptionStatus>;
  pagination?: TablePaginationState;
  searchDraft?: string;
  searchOption?: string;
  onsearchoption?: (value: string) => void;
  exporting?: boolean;
  exportError?: string;
  onsearchdraft?: (query: string) => void;
  onsearch?: (query: string) => void;
  onexport?: () => void;
  oncancelexport?: () => void;
  selectedCell?: TableSelectedCell;
  onpage?: (pageIndex: number) => void;
  onemptyretry?: () => void;
  onpagesize?: (pageSize: number) => void;
  onsort?: (sort: TableSortRule[]) => void;
  sortReset?: readonly TableSortRule[];
  onheaderfilter?: (field: string, value: TableHeaderFilterValue | null) => void;
  toolbarEnabled?: { search: boolean; export: boolean };
}
