import { documentIocHeader, hasLegacyDefaultHeader } from './header-binding';
import { filterHasObservableConsumer } from './presentation-policy';
import type { DataSourceMode } from './data-source';
import { flattenPageComponents } from './component-walk';
import { hasMetricRowAction } from './metric-card';
import type {
  ChartComponent,
  Component,
  ComponentAction,
  ComponentCapabilities,
  ComponentDataMode,
  DataComponent,
  Page,
  PageCapabilities,
  PageLayoutForm,
  PageSection,
  TableColumnNode,
} from './page-types';

export type {
  AiSummaryComponent,
  AiSummaryProps,
  AiSummaryRelatedDataDefinition,
  AiSummaryRelatedField,
  BarChartComponent,
  BarChartProps,
  BarChartSeries,
  BarSeriesRole,
  ButtonComponent,
  CategoryBreakdownColumn,
  CategoryBreakdownComponent,
  CategoryBreakdownProps,
  ChartComponent,
  ChartSeries,
  Component,
  ComponentAction,
  ComponentCapabilities,
  ComponentData,
  ComponentDataMode,
  ComponentLayout,
  CompositeCardChild,
  CompositeCardComponent,
  CompositeCardProps,
  DashboardToolbar,
  DataComponent,
  FieldTextComponent,
  FieldTextProps,
  FilterGroupComponent,
  GaugeComponent,
  GaugeProps,
  IocHeaderComponent,
  KeyValuePanelComponent,
  KeyValuePanelItem,
  KeyValuePanelProps,
  LineChartComponent,
  LineChartProps,
  MainDataBinding,
  MapChartComponent,
  MapChartProps,
  MetricCardChange,
  MetricCardComponent,
  MetricCardProgress,
  MetricCardProps,
  MetricCardRow,
  MetricDataBinding,
  NavigateAction,
  OpenDetailAction,
  Page,
  PageCapabilities,
  PageLayoutForm,
  PageMeta,
  PageSection,
  PieChartComponent,
  PieChartProps,
  RankingCardComponent,
  RankingCardProps,
  RankingDetailCardComponent,
  RankingDetailCardProps,
  ReportHeaderComponent,
  ReportHeaderProps,
  SectionContainer,
  SectionGroup,
  TabContainerComponent,
  TabContainerProps,
  TabContentComponent,
  TabItem,
  TableCellSelection,
  TableColumn,
  TableColumnGroup,
  TableColumnNode,
  TableComponent,
  TableDataBinding,
  TableProps,
  TableSelectionWrite,
  TextComponent,
  TextLink,
  TextProps,
  WriteFilterAction,
} from './page-types';

/**
 * 页面布局形态的结构读取。宿主要在页面校验之前决定页面外框几何，因此
 * 按原始文档读；未声明、声明了非法值或文档根本不是对象都退化为缺省的
 * `report`，让非法文档走各自的错误页而不是先把外框算错。
 */
export function documentLayoutForm(document: unknown): PageLayoutForm {
  const input = document as { layout?: unknown; layoutForm?: unknown } | null;
  const declared = input?.layout ?? input?.layoutForm;
  return declared === 'dashboard' ? 'dashboard' : 'report';
}

/**
 * 宿主是否应把返回入口交给运行时工具栏。对象形态工具栏本身不足以接管：
 * RuntimeView 只会在 dashboard 形态渲染它，report 仍须保留宿主 breadcrumb。
 */
export function documentUsesRuntimeBackToolbar(document: unknown): boolean {
  const ioc = documentIocHeader(document);
  if (ioc) return ioc.back === true || ioc.back === 'auto';
  if (documentLayoutForm(document) !== 'dashboard') return false;
  if (typeof document !== 'object' || document === null || Array.isArray(document)) return false;
  const toolbar = (document as { dashboardToolbar?: unknown }).dashboardToolbar;
  if (toolbar === undefined) return hasLegacyDefaultHeader(document);
  if (toolbar === 'visible') return true;
  return (
    typeof toolbar === 'object' &&
    toolbar !== null &&
    !Array.isArray(toolbar) &&
    (toolbar as { variant?: unknown }).variant === 'compact'
  );
}

/** 内容分区声明的 backdrop 组件；分区最多一个，由页面校验保证。 */
export function sectionBackdrop(section: PageSection): Component | undefined {
  return section.components.find((component) => component.layout.layer === 'backdrop');
}

export function isDataComponent(component: Component): component is DataComponent {
  return (
    component.type !== 'filterGroup' &&
    component.type !== 'button' &&
    component.type !== 'iocHeader' &&
    component.type !== 'reportHeader' &&
    component.type !== 'text' &&
    component.type !== 'aiSummary' &&
    component.type !== 'tabContainer' &&
    component.type !== 'compositeCard'
  );
}

export function isChartComponent(component: Component): component is ChartComponent {
  return (
    component.type === 'barChart' ||
    component.type === 'lineChart' ||
    component.type === 'pieChart' ||
    component.type === 'mapChart'
  );
}

/**
 * 能力只由组件实际绑定的数据源推导。mixed 页面中，inline 组件不会因页面上另有
 * query 数据源而获得筛选或动作能力。表格分页、排序与表头筛选是本地展示能力，
 * 不会被隐式翻译成 DQE 请求。
 */
export function derivePageCapabilities(page: Page): PageCapabilities {
  const components: Record<string, ComponentCapabilities> = {};
  let hasInline = false;
  let hasQuery = false;
  let actions = false;
  let remotePagination = false;

  for (const component of flattenPageComponents(page)) {
    const capability = deriveComponentCapabilities(page, component);
    components[component.id] = capability;
    hasInline ||= capability.dataMode === 'inline' || capability.dataMode === 'mixed';
    hasQuery ||= capability.dataMode === 'query' || capability.dataMode === 'mixed';
    actions ||= capability.actions;
    remotePagination ||= capability.remotePagination;
  }

  // 未绑定的数据源仍决定页面数据形态，避免隐藏的 query source 被误判为静态。
  for (const dataSource of Object.values(page.dataSources)) {
    hasInline ||= dataSource.source.type === 'inline';
    hasQuery ||= dataSource.source.type !== 'inline';
  }

  const dataMode: DataSourceMode = hasInline && hasQuery ? 'mixed' : hasQuery ? 'query' : 'inline';
  return {
    dataMode,
    static: !hasQuery,
    live: hasQuery,
    /**
     * 筛选能力跟筛选器声明走,不再绑死 query。inline 骨架页也可以持有
     * URL 可分享的筛选状态;查询重跑仍只发生在绑定了筛选的 query 数据源上。
     */
    filters: hasQuery || (page.filters?.length ?? 0) > 0,
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
  const hasQuery = [...sourceTypes].some(type => type !== 'inline');
  const dataMode: ComponentDataMode =
    sourceTypes.size === 0 ? 'none' : hasInline && hasQuery ? 'mixed' : hasQuery ? 'query' : 'inline';
  const props = component.props as { actions?: ComponentAction[]; pagination?: { mode: string } };
  const tableSelection =
    component.type === 'table' &&
    component.props.columns.some((column) => tableColumnHasSelection(column));
  const hasStandaloneAction = props.actions?.some(
    (action) => 'navigate' in action || 'openDetail' in action
  ) || hasMetricRowAction(component);
  const columnDetail = (columns: TableColumnNode[]): boolean => columns.some(column => column.kind === 'group'
    ? columnDetail(column.children) : column.openDetail !== undefined || column.navigate !== undefined || column.navigateBySource !== undefined);
  const hasMapHierarchy =
    component.type === 'mapChart' && component.props.hierarchyFilter !== undefined;
  return {
    dataMode,
    live: hasQuery,
    filters: hasQuery || (page.filters?.length ?? 0) > 0,
    /**
     * navigate 读当前行、上抛导航意图,不依赖 query 重跑,因此 inline
     * 组件也可以声明。writeFilter / 单元格选择仍只在 live 组件上有意义。
     * 地图层级下钻写的是筛选状态,不是页面文档里的 writeFilter。
     */
    actions:
      component.type==='button' ||
      ((hasQuery || Number(page.schemaVersion.split('.')[1])>=34&&hasObservableWrites(page,component)) && ((props.actions?.length ?? 0) > 0 || tableSelection)) ||
      hasStandaloneAction ||
      (component.type === 'table' && columnDetail(component.props.columns)) ||
      hasMapHierarchy,
    remotePagination:
      component.type === 'table' && component.props.pagination?.mode === 'query'
  };
}

function tableColumnHasSelection(column: TableColumnNode): boolean {
  return column.kind === 'group'
    ? column.children.some((child) => tableColumnHasSelection(child))
    : column.selection !== undefined;
}

function hasObservableWrites(page:Page,component:Component):boolean {
 const props=component.props as {actions?:ComponentAction[]};
 if((props.actions??[]).some(action=>'writeFilter' in action&&filterHasObservableConsumer(page,action.writeFilter)))return true;
 if(component.type!=='table')return false;
 function columns(nodes:TableColumnNode[]):boolean{return nodes.some(node=>node.kind==='group'?columns(node.children):Object.keys(node.selection?.writes??{}).some(id=>filterHasObservableConsumer(page,id)));}
 return columns(component.props.columns);
}
