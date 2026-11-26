<svelte:options css="injected" />
<script lang="ts">
  import type { PieChartProps, Row } from '@metriccanvas/page/internal';
  import type { MainDataSlots } from '../../shared/component-data';
  import EChart from '../../shared/EChart.svelte';
  import CategoryBreakdown from '../category-breakdown/CategoryBreakdown.svelte';
  import { chartSource, type ChartDiagnostic } from '../../shared/chart-option-extension';
  import { CATEGORICAL_PALETTE_PROPERTY, readColorList } from '../../shared/chart-palette';
  import { PIE_PLOT_EDGE_INSET, pieOption, pieRows, pieTableLegendGeometry } from './options';
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
  let layoutSize = $state<DOMRectReadOnly>();
  let plotSize = $state<DOMRectReadOnly>();
  let legendSize = $state<DOMRectReadOnly>();
  const tightPlot = $derived(!!legend && !props.labelLine && !props.echartsOption);
  const layoutGap = $derived(tightPlot ? 16 - PIE_PLOT_EDGE_INSET : 16);
  const rightRingLegend = $derived(tightPlot && Number.parseInt(props.ring ?? '0', 10) > 0 && props.legend?.position !== 'left');
  const columnGap = $derived(rightRingLegend ? 56 - PIE_PLOT_EDGE_INSET : layoutGap);
  // Flex wraps based on the space used by both items. Allow for fractional layout rounding.
  const stacked = $derived(layoutSize && plotSize && legendSize
    && plotSize.width + legendSize.width + columnGap > layoutSize.width + 0.5);
  const legendEdge = $derived<'left' | 'right' | 'bottom'>(stacked ? 'bottom' : props.legend?.position ?? 'right');
  const tableGeometry = $derived(tightPlot && plotSize && plotSize.width > 0 && plotSize.height > 0
    ? pieTableLegendGeometry(props.ring, {
        width: Math.round(plotSize.width), height: Math.round(plotSize.height), legendEdge
      })
    : undefined);
  const source = $derived(chartSource(() => pieOption(data, props, palette, tableGeometry?.series), props, diagnostic ?? { componentId: 'direct-pie-chart', componentType: 'pieChart', path: '/props/echartsOption' }));
</script>

<div class:compact-ring={props.variant === 'compactRing'} class:has-table-legend={!!legend} class="pie-chart">
  {#if props.title}<h3 class="mc-data-heading">{props.title}</h3>{/if}
  <div
    class="pie-layout"
    class:loading={data.main.sourceStatus === 'loading'}
    class:legend-left={props.legend?.position === 'left'}
    class:tight-plot={tightPlot}
    class:right-ring-legend={rightRingLegend}
    style:--pie-layout-gap={`${layoutGap}px`}
    style:--pie-column-gap={`${columnGap}px`}
    bind:contentRect={layoutSize}
  >
    <div class="pie-plot" bind:contentRect={plotSize}>
      <EChart
        loading={data.main.sourceStatus === 'loading'}
        {source}
        bind:container={chartContainer}
        onitemclick={onsliceclick
          ? (dataIndex) => onsliceclick({ row: pieRows(data, props)[dataIndex]! })
          : undefined}
      />
    </div>
    {#if legend}
      <div
        class="pie-legend"
        aria-label="表格式图例"
        style:left={tableGeometry ? `${tableGeometry.legendOffset}px` : undefined}
        bind:contentRect={legendSize}
      >
        <CategoryBreakdown data={legend.data} props={legend.props} paletteOverride={palette} swatchDomain={domain} columnPresentation={legend.columnPresentation} />
      </div>
    {/if}
  </div>
</div>

<style>
  .loading .pie-legend { filter: grayscale(1); opacity: 0.4; pointer-events: none; }
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
    flex-wrap: wrap;
    gap: var(--pie-layout-gap) var(--pie-column-gap);
    justify-content: center;
    align-content: flex-start;
    width: 100%;
    max-width: 850px;
    margin-inline: auto;
  }
  .has-table-legend .pie-plot {
    flex: 1 0 min(240px, 100%);
    min-height: 320px;
  }
  .has-table-legend .tight-plot .pie-plot {
    max-width: 320px;
    min-height: min(320px, 100cqw);
  }
  .has-table-legend .right-ring-legend .pie-plot {
    /* The ring and its two 8px plot insets fit before the full chart canvas would. */
    flex-basis: min(144px, 100%);
  }
  .pie-legend {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    min-width: 0;
    width: max-content;
    max-width: 100%;
    --mc-category-label-width: auto;
    --mc-category-column-gap: 16px;
  }
  .has-table-legend .pie-layout.legend-left { flex-direction: row-reverse; }
  h3 {
    margin: 0;
    color: var(--mc-card-title-color, #18181b);
    font-size: var(--mc-card-title-font-size, 13px);
    font-weight: var(--mc-card-title-font-weight, 500);
    /* 缺省 inherit 而不是 normal:原来这里没有声明,行高走的是继承值。 */
    line-height: var(--mc-card-title-line-height, inherit);
  }
</style>
