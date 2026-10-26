<svelte:options css="injected" />
<script lang="ts">
  import type { PieChartProps, Row } from '@metriccanvas/page/internal';
  import type { MainDataSlots } from '../../shared/component-data';
  import EChart from '../../shared/EChart.svelte';
  import CategoryBreakdown from '../category-breakdown/CategoryBreakdown.svelte';
  import { chartSource, type ChartDiagnostic } from '../../shared/chart-option-extension';
  import { CATEGORICAL_PALETTE_PROPERTY, readColorList } from '../../shared/chart-palette';
  import { pieOption, pieRows } from './options';
  import { pieCategoryDomain, pieLegendData } from './presentation';

  /** 饼图(纯渲染,ECharts):数据快照进、事件出 */
  interface Props {
    data: MainDataSlots;
    props: PieChartProps;
    diagnostic?: ChartDiagnostic;
    /** 扇区点击,携带该扇区对应的数据行 */
    onsliceclick?: (context: { row: Row }) => void;
  }

  let { data, props, onsliceclick, diagnostic }: Props = $props();

  /* 形态色板从绘图容器的计算样式读:容器挂载后 derived 重算一次,
     option 随之重建。自定义属性不触发观察器,而形态只随页面整体重渲染变化,
     所以读一次就够,不需要 MapChart 那样的重读时机。 */
  let chartContainer = $state<HTMLDivElement>();
  const palette = $derived(readColorList(chartContainer, CATEGORICAL_PALETTE_PROPERTY) ??
    (props.legend ? ['#5b72ea', '#3cc6c1', '#fec72a', '#4ba0f7'] : undefined));
  const legend = $derived(props.legend ? pieLegendData(data, props) : undefined);
  const domain = $derived(pieCategoryDomain(data, props));
  const source = $derived(chartSource(() => pieOption(data, props, palette), props, diagnostic ?? { componentId: 'direct-pie-chart', componentType: 'pieChart', path: '/props/echartsOption' }));
</script>

<div class:compact-ring={props.variant === 'compactRing'} class:has-table-legend={!!legend} class="pie-chart">
  {#if props.title}<h3>{props.title}</h3>{/if}
  <div class="pie-layout" class:legend-left={props.legend?.position === 'left'}>
  <div class="pie-plot">
  <EChart
    {source}
    bind:container={chartContainer}
    onitemclick={onsliceclick
      ? (dataIndex) => onsliceclick({ row: pieRows(data, props)[dataIndex]! })
      : undefined}
  />
  </div>
  {#if legend}
    <div class="pie-legend" aria-label="表格式图例">
      <CategoryBreakdown data={legend.data} props={legend.props} paletteOverride={palette} swatchDomain={domain} columnPresentation={legend.columnPresentation} />
    </div>
  {/if}
  </div>
</div>

<style>
  .pie-chart {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }
  .compact-ring {
    width: min(100%, 108px);
    height: auto;
    min-width: 0;
    min-height: 0;
    aspect-ratio: 1;
    flex: none;
    margin: auto;
  }
  .pie-layout, .pie-plot { display: flex; flex: 1; min-width: 0; min-height: 0; }
  .has-table-legend { container-type: inline-size; }
  .has-table-legend .pie-layout {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) minmax(260px, max-content);
    gap: 24px;
    align-items: stretch;
    width: 100%;
    max-width: 850px;
    margin-inline: auto;
  }
  .has-table-legend .pie-plot { min-height: 320px; }
  .pie-legend { display: flex; align-items: center; min-width: 0; }
  .has-table-legend .pie-layout.legend-left { grid-template-columns: minmax(260px, max-content) minmax(240px, 1fr); }
  .legend-left .pie-plot { order: 1; }
  .legend-left .pie-legend { order: 0; }
  /* responsive-contract: pie-table-legend-flow */
  @container (max-width: 620px) {
    .has-table-legend .pie-layout { display: flex; flex-direction: column; gap: 12px; }
    .has-table-legend .pie-plot { order: 0; flex: none; width: 100%; min-height: 320px; }
    .has-table-legend .pie-legend { order: 1; align-self: center; max-width: 100%; padding-bottom: 8px; }
  }
  h3 {
    margin: 0;
    color: var(--mc-card-title-color, #18181b);
    font-size: var(--mc-card-title-font-size, 13px);
    font-weight: var(--mc-card-title-font-weight, 500);
    /* 缺省 inherit 而不是 normal:原来这里没有声明,行高走的是继承值。 */
    line-height: var(--mc-card-title-line-height, inherit);
  }
</style>
