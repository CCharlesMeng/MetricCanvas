<svelte:options css="injected" />
<script lang="ts">
  import type { BarChartProps, Row } from '@metriccanvas/page/internal';
  import type { MainDataSlots } from '../../shared/component-data';
  import { resolveField } from '../../shared/component-data';
  import { formatValue } from '../../shared/value-format';
  import EChart from '../../shared/EChart.svelte';
  import { chartSource, type ChartDiagnostic } from '../../shared/chart-option-extension';
  import { CATEGORICAL_PALETTE_PROPERTY, readColorList } from '../../shared/chart-palette';
  import { barOption, barSeriesOrder } from './options';

  /**
   * 柱状图(纯渲染,ECharts):点击柱条只上抛行上下文,
   * 由运行时按页面 interactions 回写筛选状态/跳转,组件不感知联动逻辑。
   */
  interface Props {
    /** 已解析的 main 数据槽(加载/错误/空态由统一运行时呈现) */
    data: MainDataSlots;
    props: BarChartProps;
    diagnostic?: ChartDiagnostic;
    /** 柱条点击,携带该柱对应的数据行 */
    onbarclick?: (context: { row: Row }) => void;
  }

  let { data, props, onbarclick, diagnostic }: Props = $props();

  /* 形态色板从绘图容器的计算样式读(见 shared/chart-palette.ts)。 */
  let chartContainer = $state<HTMLDivElement>();
  const palette = $derived(readColorList(chartContainer, CATEGORICAL_PALETTE_PROPERTY));
  const source = $derived(chartSource(() => barOption(data, props, palette), props, diagnostic ?? { componentId: 'direct-bar-chart', componentType: 'barChart', path: '/props/echartsOption' }, barSeriesOrder(props)));
  const forecast = $derived(props.series.some((series) => series.role === 'forecast'));
  const category = $derived(resolveField(props.categoryField, data));
  const categories = $derived(
    data.main.snapshot.rows
      .map((row) => formatValue(row[category.field], category.format, category.missingText))
      .filter(Boolean)
  );
</script>

<div
  class:forecast
  class:report-forecast={props.variant === 'reportForecast'}
  class:expanded={props.showValueLabels === true || props.categoryLabels?.mode === 'all'}
  class="bar-chart"
  data-series-count={props.series.length}
  data-month-count={data.main.snapshot.rows.length}
  data-tooltip="axis"
  data-legend={props.series.length > 1 ? 'visible' : 'hidden'}
  data-stack-order={props.series.map((series, index) => series.stackOrder ?? index).join(',')}
  data-stack-join={props.rounded && props.stacked ? 'flush' : 'default'}
  data-segment-labels={props.showSegmentLabels === true ? 'true' : 'false'}
  data-total-labels={props.showStackTotalLabels === true ? 'true' : 'false'}
>
  {#if props.title}<h3>{props.title}</h3>{/if}
  <span class="chart-semantics">
    {props.series.map((series) => series.label).filter(Boolean).join(' ')} {categories.join(' ')}
  </span>
  <EChart
    {source}
    cartesian
    expandForLabels={props.showValueLabels === true || props.categoryLabels?.mode === 'all'}
    bind:container={chartContainer}
    onitemclick={onbarclick
      ? (dataIndex) => onbarclick({ row: data.main.snapshot.rows[dataIndex] })
      : undefined}
  />
</div>

<style>
  .bar-chart {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }
  h3 {
    margin: 0 0 8px;
    color: var(--mc-card-title-color, var(--mc-color-report-heading, #121e3b));
    font-size: var(--mc-card-title-font-size, 18px);
    font-weight: var(--mc-card-title-font-weight, 600);
    line-height: var(--mc-card-title-line-height, 28px);
  }
  .forecast {
    min-height: 292px;
  }
  .report-forecast {
    height: 270px;
    min-height: 270px;
    flex: none;
  }
  .report-forecast.expanded {
    height: auto;
    flex: 1;
  }
  .chart-semantics {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
