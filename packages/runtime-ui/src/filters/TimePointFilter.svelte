<script lang="ts">
  /**
   * 时间点筛选器(纯渲染):单个月份或日期,谓词是等值不是区间。
   */
  interface Props {
    label?: string;
    granularity: 'month' | 'date';
    value: string | null;
    onchange: (value: string | null) => void;
  }

  let { label, granularity, value, onchange }: Props = $props();

  const inputType = $derived(granularity === 'month' ? 'month' : 'date');
</script>

<div class="filter">
  {#if label}<span class="label">{label}</span>{/if}
  <input
    type={inputType}
    value={value ?? ''}
    onchange={(e) => onchange(e.currentTarget.value || null)}
  />
  {#if value}
    <button type="button" class="clear" title="清除时间点" onclick={() => onchange(null)}>✕</button>
  {/if}
</div>

<style>
  /* 控件铬与外置字段名标签的可见性经 --mc-filter-* 下发,真源在统一运行时根部。 */
  .filter {
    position: relative;
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
    box-sizing: border-box;
    min-width: var(--mc-filter-control-min-width, 0);
    height: var(--mc-filter-control-height, auto);
    padding: 5px 8px;
    border: 1px solid var(--mc-filter-control-border-color, #e4e4e7);
    border-radius: var(--mc-filter-control-radius, 8px);
    background: #fff;
    font-size: var(--mc-filter-font-size, 13px);
    color: #18181b;
    font-family: inherit;
  }
  .clear {
    position: absolute;
    right: 6px;
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
