<script lang="ts">
  import type { LineChartProps, Row } from '@metriccanvas/page';
  import type { MainDataSlots } from '../../shared/component-data';
  import EChart from '../../shared/EChart.svelte';
  import { CATEGORICAL_PALETTE_PROPERTY, readColorList } from '../../shared/chart-palette';
  import { lineOption } from './options';

  /** 折线图(纯渲染,ECharts):数据快照进、事件出 */
  interface Props {
    data: MainDataSlots;
    props: LineChartProps;
    /** 数据点点击,携带该点对应的数据行 */
    onpointclick?: (context: { row: Row }) => void;
  }

  let { data, props, onpointclick }: Props = $props();

  /* 形态色板从绘图容器的计算样式读(见 shared/chart-palette.ts)。 */
  let chartContainer = $state<HTMLDivElement>();
  const palette = $derived(readColorList(chartContainer, CATEGORICAL_PALETTE_PROPERTY));
  const option = $derived(lineOption(data, props, palette));
</script>

{#if props.title}<h3>{props.title}</h3>{/if}
<EChart
  {option}
  bind:container={chartContainer}
  onitemclick={onpointclick
    ? (dataIndex) => onpointclick({ row: data.main.snapshot.rows[dataIndex] })
    : undefined}
/>

<style>
  h3 {
    margin: 0;
    color: var(--mc-card-title-color, #18181b);
    font-size: var(--mc-card-title-font-size, 13px);
    font-weight: var(--mc-card-title-font-weight, 500);
    /* 缺省 inherit 而不是 normal:原来这里没有声明,行高走的是继承值。 */
    line-height: var(--mc-card-title-line-height, inherit);
  }
</style>
