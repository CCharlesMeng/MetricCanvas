<script lang="ts" module>
  import type { MetricCardDisplay } from '@metriccanvas/page';

  /** 指标卡的展示配置 = 页面文档 display + 运行时派生的取值字段 */
  export interface MetricCardConfig extends MetricCardDisplay {
    /** 数据快照中承载指标值的字段(运行时从结构化查询派生) */
    metric: string;
  }
</script>

<script lang="ts">
  import type { DataSnapshot } from '@metriccanvas/page';

  interface Props {
    /** 就绪的数据快照(加载/错误/空态由运行时统一呈现,组件只认就绪数据) */
    snapshot: Extract<DataSnapshot, { status: 'ready' }>;
    /** 展示配置 */
    config: MetricCardConfig;
  }

  let { snapshot, config }: Props = $props();

  const value = $derived(snapshot.rows[0]?.[config.metric]);
  const formatted = $derived(
    typeof value === 'number' && config.thousandsSeparator
      ? new Intl.NumberFormat('en-US').format(value)
      : String(value ?? '—')
  );
</script>

<div class="metric-card">
  {#if config.prefix}<span class="affix">{config.prefix}</span>{/if}
  <span class="value">{formatted}</span>
  {#if config.unit}<span class="affix">{config.unit}</span>{/if}
</div>

<style>
  .metric-card {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
    height: 100%;
  }
  .value {
    font-size: 2rem;
    font-weight: 650;
    letter-spacing: -0.02em;
    color: #18181b;
    font-variant-numeric: tabular-nums;
  }
  .affix {
    font-size: 0.85rem;
    color: #71717a;
  }
</style>
