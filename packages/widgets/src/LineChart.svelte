<script lang="ts" module>
  import type { LineChartDisplay } from '@metriccanvas/page';

  export interface LineChartConfig {
    metrics: string[];
    /** 数据快照中承载维度值的字段(类目轴,通常为时间) */
    dimension: string;
    display?: LineChartDisplay;
  }
</script>

<script lang="ts">
  import type { DataSnapshot, Row } from '@metriccanvas/page';
  import EChart from './EChart.svelte';
  import { lineOption } from './chart-options';

  /** 折线图(纯渲染,ECharts):数据快照进、事件出 */
  interface Props {
    snapshot: Extract<DataSnapshot, { status: 'ready' }>;
    config: LineChartConfig;
    /** 数据点点击,携带该点对应的数据行 */
    onpointclick?: (context: { row: Row }) => void;
  }

  let { snapshot, config, onpointclick }: Props = $props();

  const option = $derived(lineOption(snapshot.rows, config.metrics, config.dimension, config.display));
</script>

<EChart
  {option}
  onitemclick={onpointclick ? (dataIndex) => onpointclick({ row: snapshot.rows[dataIndex] }) : undefined}
/>
