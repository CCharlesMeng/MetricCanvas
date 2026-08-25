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
  .filter {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .label {
    color: #71717a;
    white-space: nowrap;
  }
  input {
    padding: 5px 8px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    background: #fff;
    font-size: 13px;
    color: #18181b;
    font-family: inherit;
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
