<script lang="ts" module>
  import type { BarChartDisplay } from '@metriccanvas/page';

  /** 柱状图配置 = 运行时从结构化查询派生的取值/分组字段 + 页面文档 display */
  export interface BarChartConfig {
    /** 数据快照中承载指标值的字段(多指标支撑堆叠/双轴) */
    metrics: string[];
    /** 数据快照中承载维度值的字段(类目轴) */
    dimension: string;
    display?: BarChartDisplay;
  }
</script>

<script lang="ts">
  import type { DataSnapshot, Row } from '@metriccanvas/page';
  import EChart from './EChart.svelte';
  import { barOption } from './chart-options';

  /**
   * 柱状图(纯渲染,ECharts):点击柱条只上抛行上下文,
   * 由运行时按页面 interactions 回写筛选状态/跳转,组件不感知联动逻辑。
   */
  interface Props {
    /** 就绪的数据快照(加载/错误/空态由 WidgetHost 统一呈现) */
    snapshot: Extract<DataSnapshot, { status: 'ready' }>;
    config: BarChartConfig;
    /** 柱条点击,携带该柱对应的数据行 */
    onbarclick?: (context: { row: Row }) => void;
  }

  let { snapshot, config, onbarclick }: Props = $props();

  const option = $derived(barOption(snapshot.rows, config.metrics, config.dimension, config.display));
</script>

<EChart
  {option}
  onitemclick={onbarclick ? (dataIndex) => onbarclick({ row: snapshot.rows[dataIndex] }) : undefined}
/>
