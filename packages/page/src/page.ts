import type { z } from 'zod';
import type { DataSourceMode, DataSources } from './data-source';
import type { FilterDeclaration } from './filter';
import type { PageParamDeclaration } from './page-param';
import type { VersionPolicy } from './version';
import {
  reportHeaderComponentZ,
  metricCardComponentZ,
  barChartComponentZ,
  lineChartComponentZ,
  pieChartComponentZ,
  tableComponentZ,
  mapChartComponentZ,
  gaugeComponentZ,
  tabContainerComponentZ,
  compositeCardComponentZ,
  rankingCardComponentZ,
  rankingDetailCardComponentZ,
  keyValuePanelComponentZ,
  categoryBreakdownComponentZ,
  fieldTextComponentZ,
  textComponentZ,
  aiSummaryComponentZ,
  chartSeriesZ,
  barChartSeriesZ,
  type TableColumn,
  type TableColumnGroup,
  type TableColumnNode,
  type TableCellSelection,
  type TableSelectionWrite
} from './schema/component';
import { componentLayoutZ, mainDataZ, metricDataZ, tableDataZ } from './schema/primitives';
import { writeFilterActionZ, navigateActionZ } from './schema/actions';
import {
  pageLayoutFormZ,
  pageMetaZ,
  sectionContainerZ,
  sectionZ
} from './schema/page';
import { flattenPageComponents } from './component-walk';

/*
 * 组件形状的单一真源在 `./schema/`（Zod 4 定义）：本文件的每个组件类型都
 * 从对应的 Zod 定义 `z.infer` 推导，不再手写第二份。三个例外需要在 z.infer
 * 之上做类型层的小修正（不影响 `../schema.ts` 的结构校验行为，只是把
 * 推导结果调整为原有的领域类型形状）：
 *  - reportHeader/text/aiSummary 组件的 Zod 定义里没有 `data` 键（额外键会被
 *    `additionalProperties:false` 拒绝），但 `Component` 联合类型需要所有分支
 *    都能访问 `.data`（哪怕值为 `never`），所以补一个 `data?: never`。
 *  - table 组件的 `data` 在 Zod 侧是 `Record<string,string>`（`main` 必填只在
 *    JSON Schema 的 `required` 里，`.meta()` 不影响 z.infer），这里补回
 *    `{ main: string }` 使类型层保留原有的强约束。
 * `dataSources`/`filters` 继续使用 `data-source.ts`/`filter.ts` 的手写领域
 * 类型——那两个文件不在本次收敛范围内，且 query 数据源的文档态分组字段形状
 * 只存在于 `page-document.ts`，不应该混入这里的领域类型。
 */

export type ComponentLayout = z.infer<typeof componentLayoutZ>;
export type ComponentData = Record<string, string>;
export type MainDataBinding = z.infer<typeof mainDataZ>;
export type TableDataBinding = z.infer<typeof tableDataZ> & { main: string };
export type MetricDataBinding = z.infer<typeof metricDataZ>;

export type ReportHeaderProps = z.infer<typeof reportHeaderComponentZ>['props'];
export type ReportHeaderComponent = z.infer<typeof reportHeaderComponentZ> & { data?: never };

export type MetricCardProps = z.infer<typeof metricCardComponentZ>['props'];
export type MetricCardRow = MetricCardProps['rows'][number];
export type MetricCardChange = NonNullable<MetricCardRow['changes']>[number];
export type MetricCardProgress = NonNullable<MetricCardProps['progress']>;
export type MetricCardComponent = z.infer<typeof metricCardComponentZ>;

export type ChartSeries = z.infer<typeof chartSeriesZ>;
export type BarChartSeries = z.infer<typeof barChartSeriesZ>;
export type BarSeriesRole = NonNullable<BarChartSeries['role']>;

export type BarChartProps = z.infer<typeof barChartComponentZ>['props'];
export type BarChartComponent = z.infer<typeof barChartComponentZ>;

export type LineChartProps = z.infer<typeof lineChartComponentZ>['props'];
export type LineChartComponent = z.infer<typeof lineChartComponentZ>;

export type PieChartProps = z.infer<typeof pieChartComponentZ>['props'];
export type PieChartComponent = z.infer<typeof pieChartComponentZ>;

export type {
  TableColumn,
  TableColumnGroup,
  TableColumnNode,
  TableCellSelection,
  TableSelectionWrite
};
export type TableProps = z.infer<typeof tableComponentZ>['props'];
export type TableComponent = z.infer<typeof tableComponentZ> & { data: TableDataBinding };

export type MapChartProps = z.infer<typeof mapChartComponentZ>['props'];
export type MapChartComponent = z.infer<typeof mapChartComponentZ>;

export type GaugeProps = z.infer<typeof gaugeComponentZ>['props'];
export type GaugeComponent = z.infer<typeof gaugeComponentZ>;

export type TabContainerProps = z.infer<typeof tabContainerComponentZ>['props'];
export type TabItem = Omit<TabContainerProps['tabs'][number], 'component'> & {
  component: TableComponent;
};
export type TabContainerComponent = Omit<
  z.infer<typeof tabContainerComponentZ>,
  'props'
> & {
  data?: never;
  props: Omit<TabContainerProps, 'tabs'> & { tabs: TabItem[] };
};

export type CompositeCardProps = z.infer<typeof compositeCardComponentZ>['props'];
export type CompositeCardChild = CompositeCardProps['components'][number];
export type CompositeCardComponent = z.infer<typeof compositeCardComponentZ> & {
  data?: never;
};

export type CategoryBreakdownProps = z.infer<typeof categoryBreakdownComponentZ>['props'];
export type CategoryBreakdownColumn = CategoryBreakdownProps['columns'][number];
export type CategoryBreakdownComponent = z.infer<typeof categoryBreakdownComponentZ>;

export type RankingCardProps = z.infer<typeof rankingCardComponentZ>['props'];
export type RankingCardComponent = z.infer<typeof rankingCardComponentZ>;

export type RankingDetailCardProps = z.infer<typeof rankingDetailCardComponentZ>['props'];
export type RankingDetailCardComponent = z.infer<typeof rankingDetailCardComponentZ>;

export type KeyValuePanelProps = z.infer<typeof keyValuePanelComponentZ>['props'];
export type KeyValuePanelItem = KeyValuePanelProps['items'][number];
export type KeyValuePanelComponent = z.infer<typeof keyValuePanelComponentZ>;

export type FieldTextProps = z.infer<typeof fieldTextComponentZ>['props'];
export type FieldTextComponent = z.infer<typeof fieldTextComponentZ>;

export type TextProps = z.infer<typeof textComponentZ>['props'];
export type TextLink = NonNullable<TextProps['links']>[number];
export type TextComponent = z.infer<typeof textComponentZ> & { data?: never };

export type AiSummaryProps = z.infer<typeof aiSummaryComponentZ>['props'];
export type AiSummaryRelatedDataDefinition = AiSummaryProps['relatedData'][string];
export type AiSummaryRelatedField = AiSummaryRelatedDataDefinition['fields'][number];
export type AiSummaryComponent = z.infer<typeof aiSummaryComponentZ> & { data?: never };

export type Component =
  | ReportHeaderComponent
  | MetricCardComponent
  | BarChartComponent
  | LineChartComponent
  | PieChartComponent
  | TableComponent
  | MapChartComponent
  | GaugeComponent
  | TabContainerComponent
  | CompositeCardComponent
  | RankingCardComponent
  | RankingDetailCardComponent
  | KeyValuePanelComponent
  | CategoryBreakdownComponent
  | FieldTextComponent
  | TextComponent
  | AiSummaryComponent;

export type DataComponent = Exclude<
  Component,
  | ReportHeaderComponent
  | TextComponent
  | AiSummaryComponent
  | TabContainerComponent
  | CompositeCardComponent
>;
export type ChartComponent =
  | BarChartComponent
  | LineChartComponent
  | PieChartComponent
  | MapChartComponent;

export type WriteFilterAction = z.infer<typeof writeFilterActionZ>;
export type NavigateAction = z.infer<typeof navigateActionZ>;
export type ComponentAction = WriteFilterAction | NavigateAction;

export type PageMeta = z.infer<typeof pageMetaZ>;
export type PageLayoutForm = z.infer<typeof pageLayoutFormZ>;
export type SectionContainer = z.infer<typeof sectionContainerZ>;
export type PageSection = Omit<z.infer<typeof sectionZ>, 'components'> & {
  components: Component[];
};

export interface Page {
  schemaVersion: VersionPolicy['current'];
  id: string;
  meta?: PageMeta;
  /** 页面布局形态；缺省等价于 `report`。 */
  layoutForm?: PageLayoutForm;
  /** 页面参数声明（ADR-0047）；取值在页面打开时由 URL 确定。 */
  params?: PageParamDeclaration[];
  dataSources: DataSources;
  filters?: FilterDeclaration[];
  sections: PageSection[];
}

/**
 * 页面布局形态的结构读取。宿主要在页面校验之前决定页面外框几何，因此
 * 按原始文档读；未声明、声明了非法值或文档根本不是对象都退化为缺省的
 * `report`，让非法文档走各自的错误页而不是先把外框算错。
 */
export function documentLayoutForm(document: unknown): PageLayoutForm {
  const declared = (document as { layoutForm?: unknown } | null)?.layoutForm;
  return declared === 'dashboard' ? 'dashboard' : 'report';
}

/** 内容分区声明的 backdrop 组件；分区最多一个，由页面校验保证。 */
export function sectionBackdrop(section: PageSection): Component | undefined {
  return section.components.find((component) => component.layout.layer === 'backdrop');
}

export function isDataComponent(component: Component): component is DataComponent {
  return (
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
    hasQuery ||= dataSource.source.type === 'query';
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
  const hasQuery = sourceTypes.has('query');
  const dataMode: ComponentDataMode =
    sourceTypes.size === 0 ? 'none' : hasInline && hasQuery ? 'mixed' : hasQuery ? 'query' : 'inline';
  const props = component.props as { actions?: ComponentAction[]; pagination?: { mode: string } };
  const tableSelection =
    component.type === 'table' &&
    component.props.columns.some((column) => tableColumnHasSelection(column));
  const hasNavigate = (props.actions ?? []).some((action) => 'navigate' in action);
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
      (hasQuery && ((props.actions?.length ?? 0) > 0 || tableSelection)) ||
      hasNavigate ||
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
