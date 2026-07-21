import type { DataSourceMode, DataSources } from './data-source';
import type { FieldBinding } from './field';
import type { FilterDeclaration } from './filter';

export interface Page {
  schemaVersion: '1.0';
  id: string;
  meta?: PageMeta;
  dataSources: DataSources;
  filters?: FilterDeclaration[];
  sections: PageSection[];
}

export interface PageMeta {
  /** 页面资产说明，不参与渲染。 */
  description?: string;
}

export interface PageSection {
  id: string;
  title?: string;
  layout: GridLayout;
  components: Component[];
}

/** 一期固定 12 列自动流布局。组件顺序决定排布，只声明跨度。 */
export interface GridLayout {
  type: 'grid';
  columns: 12;
}

export interface ComponentLayout {
  span: number;
}

export type ComponentData = Record<string, string>;
export type MainDataBinding = { main: string };
export type MetricDataBinding = {
  main: string;
  compare?: string;
  target?: string;
};

type ComponentBase<T extends string, P, D extends ComponentData | undefined = undefined> = {
  id: string;
  type: T;
  layout: ComponentLayout;
  props: P;
} & (D extends ComponentData ? { data: D } : { data?: never });

export interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  asOf?: { label: string; value: string };
  tags?: string[];
}

export type ReportHeaderComponent = ComponentBase<'reportHeader', ReportHeaderProps>;

export interface MetricCardChange {
  label: string;
  field: FieldBinding;
}

export interface MetricCardRow {
  label: string;
  valueField: FieldBinding;
  changes?: MetricCardChange[];
}

export interface MetricCardProps {
  title?: string;
  rows: MetricCardRow[];
  actions?: ComponentAction[];
}

export type MetricCardComponent = ComponentBase<
  'metricCard',
  MetricCardProps,
  MetricDataBinding
>;

export interface ChartSeries {
  field: FieldBinding;
  label?: string;
}

export interface BarChartProps {
  title?: string;
  categoryField: FieldBinding;
  series: ChartSeries[];
  stacked?: boolean;
  rounded?: boolean;
  horizontal?: boolean;
  dualAxis?: boolean;
  actions?: ComponentAction[];
}

export type BarChartComponent = ComponentBase<'barChart', BarChartProps, MainDataBinding>;

export interface LineChartProps {
  title?: string;
  xField: FieldBinding;
  series: ChartSeries[];
  smooth?: boolean;
  areaGradient?: boolean;
  stacked?: boolean;
  dualAxis?: boolean;
  showPointLabels?: boolean;
  hideYAxis?: boolean;
  actions?: ComponentAction[];
}

export type LineChartComponent = ComponentBase<'lineChart', LineChartProps, MainDataBinding>;

export interface PieChartProps {
  title?: string;
  categoryField: FieldBinding;
  valueField: FieldBinding;
  ring?: string;
  labelLine?: boolean;
  actions?: ComponentAction[];
}

export type PieChartComponent = ComponentBase<'pieChart', PieChartProps, MainDataBinding>;

export interface TableColumn {
  kind?: 'field';
  field: FieldBinding;
  title?: string;
  width?: number;
  fixed?: 'left' | 'right';
  sortable?: boolean;
  filterable?: { mode: 'select' | 'dateRange' };
  align?: 'left' | 'right';
  visual?: 'plain' | 'rateBar' | 'signed';
}

export interface TableColumnGroup {
  kind: 'group';
  id: string;
  title: string;
  children: TableColumnNode[];
}

export type TableColumnNode = TableColumn | TableColumnGroup;

export interface TableProps {
  title?: string;
  subtitle?: string;
  columns: TableColumnNode[];
  pagination?: { mode: 'none' | 'paged'; pageSize?: number };
  actions?: ComponentAction[];
}

export type TableComponent = ComponentBase<'table', TableProps, MainDataBinding>;

export interface MapChartProps {
  title?: string;
  nameField: FieldBinding;
  valueField: FieldBinding;
  map: 'china' | 'world';
  scatter?: 'point' | 'effect';
  nameMap?: Record<string, string>;
  actions?: ComponentAction[];
}

export type MapChartComponent = ComponentBase<'mapChart', MapChartProps, MainDataBinding>;

export interface RankingCardProps {
  title?: string;
  nameField: FieldBinding;
  valueField: FieldBinding;
  changeField?: FieldBinding;
  actions?: ComponentAction[];
}

export type RankingCardComponent = ComponentBase<
  'rankingCard',
  RankingCardProps,
  MainDataBinding
>;

export interface TextLink {
  label: string;
  page: string;
  carryFilters?: string[];
}

export interface TextProps {
  heading?: string;
  body?: string;
  variant?: 'plain' | 'insight';
  links?: TextLink[];
}

export type TextComponent = ComponentBase<'text', TextProps>;

export type Component =
  | ReportHeaderComponent
  | MetricCardComponent
  | BarChartComponent
  | LineChartComponent
  | PieChartComponent
  | TableComponent
  | MapChartComponent
  | RankingCardComponent
  | TextComponent;

export type DataComponent = Exclude<Component, ReportHeaderComponent | TextComponent>;
export type ChartComponent =
  | BarChartComponent
  | LineChartComponent
  | PieChartComponent
  | MapChartComponent;

export type ComponentAction = WriteFilterAction | NavigateAction;

export interface WriteFilterAction {
  on: 'click';
  writeFilter: string;
  field: FieldBinding;
}

export interface NavigateAction {
  on: 'click';
  navigate: {
    page: string;
    carryFilters?: string[];
    setFilters?: Record<string, FieldBinding>;
  };
}

export function isDataComponent(component: Component): component is DataComponent {
  return component.type !== 'reportHeader' && component.type !== 'text';
}

export function isChartComponent(component: Component): component is ChartComponent {
  return (
    component.type === 'barChart' ||
    component.type === 'lineChart' ||
    component.type === 'pieChart' ||
    component.type === 'mapChart'
  );
}

export type ComponentDataMode = DataSourceMode | 'none';

export interface ComponentCapabilities {
  dataMode: ComponentDataMode;
  live: boolean;
  filters: boolean;
  actions: boolean;
  remotePagination: boolean;
}

export interface PageCapabilities {
  dataMode: DataSourceMode;
  static: boolean;
  live: boolean;
  filters: boolean;
  actions: boolean;
  remotePagination: boolean;
  components: Record<string, ComponentCapabilities>;
}

/**
 * 能力只由组件实际绑定的数据源推导。mixed 页面中，inline 组件不会因页面上另有
 * query 数据源而获得筛选、动作或远程分页能力。
 */
export function derivePageCapabilities(page: Page): PageCapabilities {
  const components: Record<string, ComponentCapabilities> = {};
  let hasInline = false;
  let hasQuery = false;
  let actions = false;
  let remotePagination = false;

  for (const section of page.sections) {
    for (const component of section.components) {
      const capability = deriveComponentCapabilities(page, component);
      components[component.id] = capability;
      hasInline ||= capability.dataMode === 'inline' || capability.dataMode === 'mixed';
      hasQuery ||= capability.dataMode === 'query' || capability.dataMode === 'mixed';
      actions ||= capability.actions;
      remotePagination ||= capability.remotePagination;
    }
  }

  // 未绑定的数据源仍决定页面数据形态，避免隐藏的 query source 被误判为静态。
  for (const dataSource of Object.values(page.dataSources)) {
    hasInline ||= dataSource.source.type === 'inline';
    hasQuery ||= dataSource.source.type === 'query';
  }

  const dataMode: DataSourceMode = hasInline && hasQuery ? 'mixed' : hasQuery ? 'query' : 'inline';
  return {
    dataMode,
    static: !hasQuery,
    live: hasQuery,
    filters: hasQuery,
    actions,
    remotePagination,
    components
  };
}

export function deriveComponentCapabilities(
  page: Page,
  component: Component
): ComponentCapabilities {
  const sourceTypes = new Set(
    Object.values(component.data ?? {}).flatMap((sourceId) => {
      const source = page.dataSources[sourceId];
      return source ? [source.source.type] : [];
    })
  );
  const hasInline = sourceTypes.has('inline');
  const hasQuery = sourceTypes.has('query');
  const dataMode: ComponentDataMode =
    sourceTypes.size === 0 ? 'none' : hasInline && hasQuery ? 'mixed' : hasQuery ? 'query' : 'inline';
  const props = component.props as { actions?: ComponentAction[]; pagination?: { mode: string } };
  return {
    dataMode,
    live: hasQuery,
    filters: hasQuery,
    actions: hasQuery && (props.actions?.length ?? 0) > 0,
    remotePagination: hasQuery && props.pagination?.mode === 'paged'
  };
}
