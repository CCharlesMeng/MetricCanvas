/**
 * 纯渲染组件包的唯一出口。
 * 导出面按真实消费面收敛:页面组件本身,加上统一运行时编排表格视图所需的纯函数与契约类型;
 * 只服务包内的共享内核(字段解析、格式化、ECharts 宿主)不对外暴露。
 */
export { default as ReportHeader } from './components/report-header/ReportHeader.svelte';
export { default as MetricCard } from './components/metric-card/MetricCard.svelte';
export { default as BarChart } from './components/bar-chart/BarChart.svelte';
export { default as LineChart } from './components/line-chart/LineChart.svelte';
export { default as PieChart } from './components/pie-chart/PieChart.svelte';
export { default as MapChart } from './components/map-chart/MapChart.svelte';
export { default as RankingCard } from './components/ranking-card/RankingCard.svelte';
export { default as RankingDetailCard } from './components/ranking-detail-card/RankingDetailCard.svelte';
export { default as TextBlock } from './components/text/TextBlock.svelte';
export type { TextBlockLink } from './components/text/TextBlock.svelte';
/*
 * 分区标题装饰图标的唯一二进制真源。三个消费方(RuntimeSection、
 * ReportHeader、TextBlock heading 变体)横跨 runtime-ui 与本包,依赖方向
 * (runtime-ui → widgets)决定 widgets 是唯一合法的共享宿主——这是刻意的
 * 资产导出,不是实现细节泄漏;不要在任何消费方复制这两个文件。
 */
export { default as sectionTitleLeftUrl } from './assets/section-title-left.svg';
export { default as sectionTitleRightUrl } from './assets/section-title-right.svg';
export { default as Table } from './components/table/Table.svelte';
export type {
  TablePaginationState,
  TableSelectedCell
} from './components/table/Table.svelte';
export {
  initialTableSort,
  shouldApplyTableHeaderFilter,
  type TableHeaderFilterValue,
  type TableSortRule,
  type TableViewState
} from './components/table/view-state';
export { buildTableColumnLayout } from './components/table/columns';
export type {
  MainDataSlots,
  MetricDataSlots,
  NamedDataSlots
} from './shared/component-data';
export {
  publishRowAlignment,
  rowAlignmentParticipants,
  subscribeRowAlignment,
  type RowAlignmentHandle,
  type RowAlignmentTracks
} from './shared/row-alignment';
