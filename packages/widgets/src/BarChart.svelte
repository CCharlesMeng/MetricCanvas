<script lang="ts" module>
  /** 柱状图展示配置 = 运行时从结构化查询派生的取值/分组字段 */
  export interface BarChartConfig {
    /** 数据快照中承载指标值的字段 */
    metric: string;
    /** 数据快照中承载维度值的字段(分组轴) */
    dimension: string;
  }
</script>

<script lang="ts">
  import type { DataSnapshot, Row } from '@metriccanvas/page';

  /**
   * 柱状图(纯渲染,本切片最简形态):点击柱条只上抛行上下文,
   * 由运行时按页面 interactions 回写筛选状态,组件不感知联动逻辑。
   * ECharts 化与完整展示配置面(堆叠/横向/双轴等)归切片5(#6)。
   */
  interface Props {
    /** 就绪的数据快照(加载/错误/空态由运行时统一呈现) */
    snapshot: Extract<DataSnapshot, { status: 'ready' }>;
    config: BarChartConfig;
    /** 柱条点击,携带该柱对应的数据行 */
    onbarclick?: (context: { row: Row }) => void;
  }

  let { snapshot, config, onbarclick }: Props = $props();

  const max = $derived(
    Math.max(1, ...snapshot.rows.map((row) => Number(row[config.metric]) || 0))
  );
</script>

<div class="bar-chart">
  {#each snapshot.rows as row (row[config.dimension])}
    {@const value = Number(row[config.metric]) || 0}
    <button
      type="button"
      class="bar-row"
      class:clickable={onbarclick !== undefined}
      title={onbarclick ? '点击下钻' : undefined}
      onclick={() => onbarclick?.({ row })}
    >
      <span class="name">{row[config.dimension]}</span>
      <span class="track">
        <span class="bar" style="width: {(value / max) * 100}%"></span>
      </span>
      <span class="value">{new Intl.NumberFormat('en-US').format(value)}</span>
    </button>
  {/each}
</div>

<style>
  .bar-chart {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    justify-content: center;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 4em 1fr auto;
    align-items: center;
    gap: 10px;
    border: 0;
    background: transparent;
    padding: 2px 0;
    font-size: 13px;
    text-align: left;
    cursor: default;
    color: inherit;
  }
  .bar-row.clickable {
    cursor: pointer;
  }
  .bar-row.clickable:hover .bar {
    background: #1d4ed8;
  }
  .name {
    color: #52525b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .track {
    background: #f4f4f5;
    border-radius: 4px;
    height: 18px;
    overflow: hidden;
  }
  .bar {
    display: block;
    height: 100%;
    background: #3b82f6;
    border-radius: 4px;
    transition: width 0.25s ease;
  }
  .value {
    color: #18181b;
    font-variant-numeric: tabular-nums;
  }
</style>
