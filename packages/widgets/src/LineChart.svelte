<script lang="ts">
  import type { LineChartProps, Row } from '@metriccanvas/page';
  import type { MainDataSlots } from './component-data';
  import EChart from './EChart.svelte';
  import { lineOption } from './chart-options';

  /** 折线图(纯渲染,ECharts):数据快照进、事件出 */
  interface Props {
    data: MainDataSlots;
    props: LineChartProps;
    /** 数据点点击,携带该点对应的数据行 */
    onpointclick?: (context: { row: Row }) => void;
  }

  let { data, props, onpointclick }: Props = $props();

  const option = $derived(lineOption(data, props));
</script>

{#if props.title}<h3>{props.title}</h3>{/if}
<EChart
  {option}
  onitemclick={onpointclick
    ? (dataIndex) => onpointclick({ row: data.main.snapshot.rows[dataIndex] })
    : undefined}
/>

<style>
  h3 {
    margin: 0;
    color: #18181b;
    font-size: 13px;
    font-weight: 500;
  }
</style>
