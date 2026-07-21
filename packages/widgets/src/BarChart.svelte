<script lang="ts">
  import type { BarChartProps, Row } from '@metriccanvas/page';
  import type { MainDataSlots } from './component-data';
  import EChart from './EChart.svelte';
  import { barOption } from './chart-options';

  /**
   * 柱状图(纯渲染,ECharts):点击柱条只上抛行上下文,
   * 由运行时按页面 interactions 回写筛选状态/跳转,组件不感知联动逻辑。
   */
  interface Props {
    /** 已解析的 main 数据槽(加载/错误/空态由统一运行时呈现) */
    data: MainDataSlots;
    props: BarChartProps;
    /** 柱条点击,携带该柱对应的数据行 */
    onbarclick?: (context: { row: Row }) => void;
  }

  let { data, props, onbarclick }: Props = $props();

  const option = $derived(barOption(data, props));
</script>

{#if props.title}<h3>{props.title}</h3>{/if}
<EChart
  {option}
  onitemclick={onbarclick
    ? (dataIndex) => onbarclick({ row: data.main.snapshot.rows[dataIndex] })
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
