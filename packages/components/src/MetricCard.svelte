<script lang="ts">
  import type { DataSnapshot, MetricCardDisplay } from '@metriccanvas/spec-schema';

  interface Props {
    /** 就绪的数据快照(加载/错误/空态由运行时统一呈现,组件只认就绪数据) */
    snapshot: Extract<DataSnapshot, { status: 'ready' }>;
    /** 展示配置(来自规格) */
    display?: MetricCardDisplay;
    /** 快照中承载指标值的字段 */
    metric: string;
  }

  let { snapshot, display = {}, metric }: Props = $props();

  const value = $derived(snapshot.rows[0]?.[metric]);
  const formatted = $derived(
    typeof value === 'number' && display.thousandsSeparator
      ? new Intl.NumberFormat('en-US').format(value)
      : String(value ?? '—')
  );
</script>

<div class="metric-card">
  {#if display.prefix}<span class="affix">{display.prefix}</span>{/if}
  <span class="value">{formatted}</span>
  {#if display.unit}<span class="affix">{display.unit}</span>{/if}
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
