<script lang="ts">
  import { DatePicker } from '@metriccanvas/ui';
  import FilterBar from '../../src/filters/FilterBar.svelte';
  import type { TimeRangeValue } from '@metriccanvas/page/internal';
  import type { FilterValue } from '../../../runtime/src';
  let mode = $state('date');
  let required = $state(false);
  let disabled = $state(false);
  let second = $state(true);
  let value = $state<TimeRangeValue | null>(null);
  let other = $state<TimeRangeValue | null>({ from: '2026-01', to: '2026-06' });
  let events = $state<(TimeRangeValue | null)[]>([]);
  const precision = $derived(mode.startsWith('month') ? 'month' : 'date');
  const range = $derived(mode.endsWith('range'));
  function selectMode(next: string) { mode = next; value = null; events = []; }
</script>
<svelte:head><title>DatePicker · OS 验收</title></svelte:head>
<div class="tools">
  <label>形态<select value={mode} onchange={e => selectMode(e.currentTarget.value)}><option value="date">单日期</option><option value="month">单月份</option><option value="daterange">日期范围</option><option value="monthrange">月份范围</option></select></label>
  <label><input type="checkbox" bind:checked={required} />必填</label>
  <label><input type="checkbox" bind:checked={disabled} />禁用</label>
  <button onclick={() => value = range ? { from: precision === 'month' ? '2026-01' : '2026-10-01', to: precision === 'month' ? '2026-06' : '2026-10-06' } : { from: precision === 'month' ? '2026-01' : '2026-01-31', to: precision === 'month' ? '2026-01' : '2026-01-31' }}>预设值</button>
  <button onclick={() => { value = null; events = []; }}>空值</button>
  <button onclick={() => second = !second}>挂载/销毁第二实例</button>
</div>
<div class="reference" data-harness-primary><DatePicker {precision} {range} {required} {disabled} {value} onchange={next => { value = next; events = [...events, next]; }} /></div>
<pre data-harness-events>{JSON.stringify({ value, events })}</pre>
{#if second}<div class="secondary"><DatePicker precision="month" range value={other} onchange={next => other = next} /></div>{/if}
<div class="readonly" data-harness-readonly>
  <FilterBar declarations={[{ id: 'read', type: 'timeRange', precision: 'month', label: '只读范围' },{ id: 'point', type: 'timePoint', granularity: 'date', label: '只读日期' }]} values={new Map<string, FilterValue>([['read',{type:'timeRange',from:'2026-01',to:'2026-06'}],['point',{type:'timePoint',granularity:'date',value:'2026-01-31'}]])} candidates={new Map()} readOnly ondimension={() => {}} ontimerange={() => {}} ontimepoint={() => {}} onboolean={() => {}} onnumberrange={() => {}} onsearch={() => {}} />
</div>
<style>
  :global(body) { margin:0; background:#fff; }
  .tools { height:64px; box-sizing:border-box; display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:20px; font:14px Arial; }
  .reference { margin:100px 0 0 342px; --mc-date-picker-width:360px; }
  .secondary { margin:360px 0 0 342px; --mc-date-picker-width:360px; }
  pre { margin:20px; white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px; }
  .readonly { margin:20px; }
  @media(max-width:600px) { .tools { height:auto; } .reference,.secondary { margin-left:16px; margin-right:16px; } }
</style>
