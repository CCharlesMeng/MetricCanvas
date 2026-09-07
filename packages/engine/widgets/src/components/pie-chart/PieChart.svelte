<script lang="ts">
  import type { PieChartProps, Row } from '@metriccanvas/page';
  import type { MainDataSlots } from '../../shared/component-data';
  import EChart from '../../shared/EChart.svelte';
  import { CATEGORICAL_PALETTE_PROPERTY, readColorList } from '../../shared/chart-palette';
  import { pieOption } from './options';

  /** 饼图(纯渲染,ECharts):数据快照进、事件出 */
  interface Props {
    data: MainDataSlots;
    props: PieChartProps;
    /** 扇区点击,携带该扇区对应的数据行 */
    onsliceclick?: (context: { row: Row }) => void;
  }

  let { data, props, onsliceclick }: Props = $props();

  /* 形态色板从绘图容器的计算样式读:容器挂载后 derived 重算一次,
     option 随之重建。自定义属性不触发观察器,而形态只随页面整体重渲染变化,
     所以读一次就够,不需要 MapChart 那样的重读时机。 */
  let chartContainer = $state<HTMLDivElement>();
  const palette = $derived(readColorList(chartContainer, CATEGORICAL_PALETTE_PROPERTY));
  const option = $derived(pieOption(data, props, palette));
</script>

<div class:compact-ring={props.variant === 'compactRing'} class="pie-chart">
  {#if props.title}<h3>{props.title}</h3>{/if}
  <EChart
    {option}
    bind:container={chartContainer}
    onitemclick={onsliceclick
      ? (dataIndex) => onsliceclick({ row: data.main.snapshot.rows[dataIndex] })
      : undefined}
  />
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
  h3 {
    margin: 0;
    color: var(--mc-card-title-color, #18181b);
    font-size: var(--mc-card-title-font-size, 13px);
    font-weight: var(--mc-card-title-font-weight, 500);
    /* 缺省 inherit 而不是 normal:原来这里没有声明,行高走的是继承值。 */
    line-height: var(--mc-card-title-line-height, inherit);
  }
</style>
