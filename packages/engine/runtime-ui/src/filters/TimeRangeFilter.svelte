<script lang="ts">
  import type { TimeRangeValue } from '@metriccanvas/page';

  /**
   * 时间范围筛选器(纯渲染):当前范围由运行时传入,变更只上抛事件。
   * precision 决定日期或日期时间精度;起止都填妥才上抛,清除上抛 null。
   */
  interface Props {
    label?: string;
    precision?: 'date' | 'datetime';
    /** 当前范围;null 表示不筛选 */
    value: TimeRangeValue | null;
    onchange: (range: TimeRangeValue | null) => void;
  }

  let { label, precision = 'date', value, onchange }: Props = $props();

  const inputType = $derived(precision === 'datetime' ? 'datetime-local' : 'date');

  function emit(from: string, to: string) {
    if (from && to) onchange({ from, to });
    else if (!from && !to) onchange(null);
    // 只填了一端:等另一端填妥再上抛,避免半成品范围触发重查
  }
</script>

<div class="filter">
  {#if label}<span class="label">{label}</span>{/if}
  <input
    type={inputType}
    value={value?.from ?? ''}
    onchange={(e) => emit(e.currentTarget.value, value?.to ?? '')}
  />
  <span class="sep">至</span>
  <input
    type={inputType}
    value={value?.to ?? ''}
    onchange={(e) => emit(value?.from ?? '', e.currentTarget.value)}
  />
  {#if value}
    <button type="button" class="clear" title="清除时间范围" onclick={() => onchange(null)}>✕</button>
  {/if}
</div>

<style>
  /* 控件铬与外置字段名标签的可见性经 --mc-filter-* 下发,真源在统一运行时根部。
     区间控件是并排两个输入框,不吃单值控件的 --mc-filter-control-min-width。 */
  .filter {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--mc-filter-font-size, 13px);
  }
  .label {
    display: var(--mc-filter-label-display, inline);
    color: #71717a;
    white-space: nowrap;
  }
  input {
    height: var(--mc-filter-control-height, auto);
    padding: 5px 8px;
    border: 1px solid var(--mc-filter-control-border-color, #e4e4e7);
    border-radius: var(--mc-filter-control-radius, 8px);
    background: #fff;
    font-size: var(--mc-filter-font-size, 13px);
    color: #18181b;
    font-family: inherit;
  }
  .sep {
    color: #a1a1aa;
  }
  .clear {
    border: 0;
    background: transparent;
    color: #a1a1aa;
    cursor: pointer;
    font-size: 12px;
    padding: 4px;
  }
  .clear:hover {
    color: #52525b;
  }
</style>
