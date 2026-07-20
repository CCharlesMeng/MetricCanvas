<script lang="ts" module>
  import type { PieChartDisplay } from '@metriccanvas/page';

  export interface PieChartConfig {
    /** 单指标:占比取值字段 */
    metric: string;
    /** 数据快照中承载维度值的字段(扇区切分) */
    dimension: string;
    display?: PieChartDisplay;
  }
</script>

<script lang="ts">
  import type { DataSnapshot, Row } from '@metriccanvas/page';
  import EChart from './EChart.svelte';
  import { pieOption } from './chart-options';

  /** 饼图(纯渲染,ECharts):数据快照进、事件出 */
  interface Props {
    snapshot: Extract<DataSnapshot, { status: 'ready' }>;
    config: PieChartConfig;
    /** 扇区点击,携带该扇区对应的数据行 */
    onsliceclick?: (context: { row: Row }) => void;
  }

  let { snapshot, config, onsliceclick }: Props = $props();

  const option = $derived(pieOption(snapshot.rows, config.metric, config.dimension, config.display));
</script>

<EChart
  {option}
  onitemclick={onsliceclick ? (dataIndex) => onsliceclick({ row: snapshot.rows[dataIndex] }) : undefined}
/>
