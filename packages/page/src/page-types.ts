import type { z } from 'zod';
import type { DataSourceMode, DataSources } from './data-source';
import type { FilterDeclaration } from './filter-types';
import type { PageParamDeclaration } from './page-param-types';
import type { navigateActionZ, openDetailActionZ, writeFilterActionZ } from './schema/actions';
import type {
  aiSummaryComponentZ,
  barChartComponentZ,
  barChartSeriesZ,
  buttonComponentZ,
  categoryBreakdownComponentZ,
  chartSeriesZ,
  compositeCardComponentZ,
  fieldTextComponentZ,
  filterGroupComponentZ,
  gaugeComponentZ,
  iocHeaderComponentZ,
  keyValuePanelComponentZ,
  lineChartComponentZ,
  mapChartComponentZ,
  metricCardComponentZ,
  pieChartComponentZ,
  rankingCardComponentZ,
  rankingDetailCardComponentZ,
  reportHeaderComponentZ,
  TableCellSelection,
  TableColumn,
  TableColumnGroup,
  TableColumnNode,
  TableSelectionWrite,
  tabContainerComponentZ,
  tableComponentZ,
  textComponentZ,
} from './schema/component';
import type { Condition } from './schema/condition';
import type { IocHeaderDeclaration } from './schema/ioc-header';
import type { MapGeography } from './schema/map-geography';
import type {
  dashboardToolbarZ,
  pageLayoutFormZ,
  pageMetaZ,
  sectionContainerZ,
  sectionZ,
} from './schema/page';
import type { componentLayoutZ, mainDataZ, metricDataZ, tableDataZ } from './schema/primitives';
import type { VersionBounds } from './version-bounds';

/*
 * Pure leaf type definitions for `Page`, `PageSection`, `Component`, and page/component
 * capabilities. Re-exported by `page.ts` so runtime helpers in `page.ts` never create
 * static type cycles with modules that only need `Page` or `Component` types.
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
  TableCellSelection,
  TableColumn,
  TableColumnGroup,
  TableColumnNode,
  TableSelectionWrite,
};
export type TableProps = z.infer<typeof tableComponentZ>['props'];
export type TableComponent = z.infer<typeof tableComponentZ> & { data: TableDataBinding };

export type MapChartProps = z.infer<typeof mapChartComponentZ>['props'];
export type MapChartComponent = z.infer<typeof mapChartComponentZ>;

export type GaugeProps = z.infer<typeof gaugeComponentZ>['props'];
export type GaugeComponent = z.infer<typeof gaugeComponentZ>;

export type TabContentComponent =
  | FilterGroupComponent
  | ButtonComponent
  | TableComponent
  | MetricCardComponent
  | BarChartComponent
  | LineChartComponent
  | PieChartComponent
  | MapChartComponent
  | GaugeComponent
  | CompositeCardComponent
  | CategoryBreakdownComponent
  | RankingCardComponent
  | RankingDetailCardComponent
  | KeyValuePanelComponent
  | TextComponent
  | FieldTextComponent
  | AiSummaryComponent;
export type TabContainerProps = z.infer<typeof tabContainerComponentZ>['props'];
type InferredTabItem = TabContainerProps['tabs'][number];
export type TabItem =
  | (Omit<Extract<InferredTabItem, { component: unknown }>, 'component'> & {
      component: TabContentComponent;
    })
  | (Omit<Extract<InferredTabItem, { components: unknown }>, 'components'> & {
      components: TabContentComponent[];
    });
export type TabContainerComponent = Omit<z.infer<typeof tabContainerComponentZ>, 'props'> & {
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
export type AiSummaryRelatedDataDefinition = NonNullable<AiSummaryProps['relatedData']>[string];
export type AiSummaryRelatedField = AiSummaryRelatedDataDefinition['fields'][number];
export type AiSummaryComponent = z.infer<typeof aiSummaryComponentZ> & { data?: never };

export type FilterGroupComponent = z.infer<typeof filterGroupComponentZ> & {
  data?: never;
  props: z.infer<typeof filterGroupComponentZ>['props'] & { title?: never };
};

export type ButtonComponent = z.infer<typeof buttonComponentZ> & {
  data?: never;
  props: z.infer<typeof buttonComponentZ>['props'] & { title?: never };
};

export type IocHeaderComponent = z.infer<typeof iocHeaderComponentZ> & {
  data?: never;
  props: z.infer<typeof iocHeaderComponentZ>['props'] & { title?: never };
};

export type Component =
  | IocHeaderComponent
  | FilterGroupComponent
  | ButtonComponent
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
  | IocHeaderComponent
  | ReportHeaderComponent
  | FilterGroupComponent
  | ButtonComponent
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
export type OpenDetailAction = z.infer<typeof openDetailActionZ>;
export type ComponentAction = WriteFilterAction | NavigateAction | OpenDetailAction;

export type PageMeta = z.infer<typeof pageMetaZ>;
export type PageLayoutForm = z.infer<typeof pageLayoutFormZ>;
export type DashboardToolbar = z.infer<typeof dashboardToolbarZ>;
export type SectionContainer = z.infer<typeof sectionContainerZ>;
export type PageSection = Omit<z.infer<typeof sectionZ>, 'components'> & {
  components: Component[];
};

export interface SectionGroup {
  visibleWhen?: Condition;
  id: string;
  label: string;
  sectionIds: string[];
}

export interface Page {
  schemaVersion: VersionBounds['current'];
  id: string;
  meta?: PageMeta;
  /** 页面布局形态；缺省等价于 `report`。 */
  layout?: PageLayoutForm;
  /** dashboard 统一工具栏；缺省显示，页面有自有页头时可显式关闭。 */
  /** @deprecated 新页面使用 iocHeader；旧声明由唯一页头兼容呈现。 */
  dashboardToolbar?: DashboardToolbar;
  iocHeader?: IocHeaderDeclaration;
  strictURLInputs?: true;
  /** 页面参数声明（ADR-0047）；取值在页面打开时由 URL 确定。 */
  params?: PageParamDeclaration[];
  dataSources: DataSources;
  filters?: FilterDeclaration[];
  detailViews?: Array<{
    id: string;
    mode: 'snapshot' | 'query';
    /** Hidden page filter declarations; bound atomically in the overlay scope. */
    filters?: string[];
    components: Component[];
  }>;
  mapOverrides?: MapGeography;
  sectionGroups?: SectionGroup[];
  defaultSectionGroup?: string;
  sectionGroupParam?: string;
  sectionAnchors?: Array<{ sectionId: string; label: string }>;
  sections: PageSection[];
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
