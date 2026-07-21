<script lang="ts">
  import type { PieChartProps, Row } from '@metriccanvas/page';
  import type { MainDataSlots } from './component-data';
  import EChart from './EChart.svelte';
  import { pieOption } from './chart-options';

  /** 饼图(纯渲染,ECharts):数据快照进、事件出 */
  interface Props {
    data: MainDataSlots;
    props: PieChartProps;
    /** 扇区点击,携带该扇区对应的数据行 */
    onsliceclick?: (context: { row: Row }) => void;
  }

  let { data, props, onsliceclick }: Props = $props();

  const option = $derived(pieOption(data, props));
</script>

{#if props.title}<h3>{props.title}</h3>{/if}
<EChart
  {option}
  onitemclick={onsliceclick
    ? (dataIndex) => onsliceclick({ row: data.main.snapshot.rows[dataIndex] })
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
