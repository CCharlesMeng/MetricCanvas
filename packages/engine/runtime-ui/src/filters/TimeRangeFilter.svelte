<script lang="ts">
  import { untrack } from 'svelte';
  import { DatePicker } from '@metriccanvas/ui';
  import { validateCalendarTimeRange, type TimeRangePrecision, type TimeRangeValue } from '@metriccanvas/page/internal';
  interface Props {
    label?: string;
    precision?: TimeRangePrecision;
    required?: boolean;
    readOnly?: boolean;
    value: TimeRangeValue | null;
    onchange: (range: TimeRangeValue | null) => void;
  }
  let { label, precision = 'date', required = false, readOnly = false, value, onchange }: Props = $props();
  let from = $state(untrack(() => value?.from ?? ''));
  let to = $state(untrack(() => value?.to ?? ''));
  let error = $state('');
  const inputType = $derived(precision === 'datetime' ? 'datetime-local' : precision);
  $effect(() => { from = value?.from ?? ''; to = value?.to ?? ''; error = ''; });
  function emit() {
    if (!from && !to && !required) { error = ''; onchange(null); return; }
    if (!from || !to) { error = '请填写完整的起止期间'; return; }
    const issues = validateCalendarTimeRange({ from, to }, precision);
    error = issues[0]?.message ?? '';
    if (!error) onchange({ from, to });
  }
  function clear() { from = ''; to = ''; error = ''; onchange(null); }
</script>

{#if precision !== 'datetime'}
  <DatePicker {label} {required} {precision} range disabled={readOnly} {value} onchange={next => { if (!next || !validateCalendarTimeRange(next, precision).length) onchange(next); }} />
{:else}
<div class="filter">
  {#if label}<span class="label">{label}</span>{/if}
  <input
    type={inputType}
    disabled={readOnly}
    aria-label={`${label ?? "期间"}开始`}
    aria-invalid={!!error}
    value={from}
    onchange={(e) => { from = e.currentTarget.value; emit(); }}
  />
  <span class="sep">至</span>
  <input
    type={inputType}
    disabled={readOnly}
    aria-label={`${label ?? "期间"}结束`}
    aria-invalid={!!error}
    value={to}
    onchange={(e) => { to = e.currentTarget.value; emit(); }}
  />
  {#if value && !required && !readOnly}
    <button type="button" class="clear" title="清除时间范围" onclick={clear}>✕</button>
  {/if}
  {#if error}<span class="error" role="status">{error}</span>{/if}
</div>
{/if}

<style>
  /* 控件铬与外置字段名标签的可见性经 --mc-filter-* 下发,真源在统一运行时根部。
     区间控件是并排两个输入框,不吃单值控件的 --mc-filter-control-min-width。 */
  .filter {
    min-width:0; max-width:100%;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: var(--mc-filter-font-size, 13px);
  }
  .error { flex-basis: 100%; color: #b91c1c; font-size: 12px; }
  .label {
    display: var(--mc-filter-label-display, inline);
    color: #71717a;
    white-space: nowrap;
  }
  input {
    min-width:0; max-width:100%; box-sizing:border-box;
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
