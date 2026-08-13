import type { z } from 'zod';
import type { DataSourceMode, DataSources } from './data-source';
import type { FilterDeclaration } from './filter';
import type { VersionPolicy } from './version';
import {
  reportHeaderComponentZ,
  metricCardComponentZ,
  barChartComponentZ,
  lineChartComponentZ,
  pieChartComponentZ,
  tableComponentZ,
  mapChartComponentZ,
  rankingCardComponentZ,
  rankingDetailCardComponentZ,
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
import { pageMetaZ, sectionContainerZ, sectionZ } from './schema/page';

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

export type RankingCardProps = z.infer<typeof rankingCardComponentZ>['props'];
export type RankingCardComponent = z.infer<typeof rankingCardComponentZ>;

export type RankingDetailCardProps = z.infer<typeof rankingDetailCardComponentZ>['props'];
export type RankingDetailCardComponent = z.infer<typeof rankingDetailCardComponentZ>;

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
  | RankingCardComponent
  | RankingDetailCardComponent
  | TextComponent
  | AiSummaryComponent;

export type DataComponent = Exclude<
  Component,
  ReportHeaderComponent | TextComponent | AiSummaryComponent
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
export type SectionContainer = z.infer<typeof sectionContainerZ>;
export type PageSection = Omit<z.infer<typeof sectionZ>, 'components'> & {
  components: Component[];
};

export interface Page {
  schemaVersion: VersionPolicy['current'];
  id: string;
  meta?: PageMeta;
  dataSources: DataSources;
  filters?: FilterDeclaration[];
  sections: PageSection[];
}

export function isDataComponent(component: Component): component is DataComponent {
  return (
    component.type !== 'reportHeader' &&
    component.type !== 'text' &&
    component.type !== 'aiSummary'
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
  const tableSelection =
    component.type === 'table' &&
    component.props.columns.some((column) => tableColumnHasSelection(column));
  return {
    dataMode,
    live: hasQuery,
    filters: hasQuery,
    actions: hasQuery && ((props.actions?.length ?? 0) > 0 || tableSelection),
    remotePagination:
      component.type === 'table' && component.props.pagination?.mode === 'query'
  };
}

function tableColumnHasSelection(column: TableColumnNode): boolean {
  return column.kind === 'group'
    ? column.children.some((child) => tableColumnHasSelection(child))
    : column.selection !== undefined;
}
