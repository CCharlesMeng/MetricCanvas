<svelte:options css="injected" />
<script lang="ts">
  import { DEFAULT_NULL_TEXT } from '../../../widgets/src/shared/value-format';
  import { untrack } from 'svelte';
  import type { PendingPeriodChoice } from './pending-period-mode';
  import { DatePicker } from '@metriccanvas/ui';
  import { calendarEndpoint,timeAvailabilityIssue,resolvePeriodSelection, periodRangeLabel, type PeriodMode, type PeriodRange, type AppliedPeriodSelection } from '@metriccanvas/page/internal';
  let {label,precision='date',value,readOnly=false,rollingMonth,rollingPending=false,finalizationMonth,monthPending=false,initialMode,pendingMode,periodModes,min,max,blockedRanges=[],onchange,onpendingmode}:{label?:string;precision?:'month'|'date';value:PeriodRange|null;readOnly?:boolean;rollingMonth?:string;rollingPending?:boolean;finalizationMonth?:string;monthPending?:boolean;initialMode?:PeriodMode;pendingMode?:PeriodMode;periodModes?:PeriodMode[];min?:string;max?:string;blockedRanges?:readonly {from:string;to:string}[];onchange:(value:PeriodRange)=>void;onpendingmode?:(choice:PendingPeriodChoice)=>void}=$props();
  let error=$state('');
  function commit(range:PeriodRange){error=timeAvailabilityIssue({id:'period',type:'timeRange',min,max,blockedRanges:[...blockedRanges]},{type:'timeRange',...range})??'';if(!error)onchange(range);}
  const allModes=[{id:'year',label:'年'},{id:'quarter',label:'季'},{id:'month',label:'月'},{id:'last12Months',label:'近一年'}] as const;
  const modes=$derived(periodModes ? periodModes.map(id=>allModes.find(item=>item.id===id)!) : allModes);
  const mode=$derived(pendingMode ?? value?.selection?.mode ?? initialMode ?? periodModes?.[0] ?? 'month');
  type CalendarMode = Exclude<PeriodMode, 'last12Months'>;
  let anchor=$state(untrack(()=>anchorOf(value?.selection)));
  // The anchor supplies the initial value for a mode that has not been used yet.
  const rememberedValues: Partial<Record<CalendarMode, string>> = {};
  function anchorOf(selection?:AppliedPeriodSelection):string {
    if (selection?.mode==='last12Months' && selection.anchor) return selection.anchor;
    if (!selection || selection.mode==='last12Months') {const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;}
    if(selection.mode==='month')return selection.value;
    if(selection.mode==='quarter')return `${selection.value.slice(0,4)}-${String((Number(selection.value.slice(6))-1)*3+1).padStart(2,'0')}`;
    return `${selection.value}-01`;
  }
  $effect(()=>{
    const selection=value?.selection;
    if(!selection || selection.mode==='last12Months')return;
    rememberedValues[selection.mode] = selection.value;
    const previous=untrack(()=>anchor);
    if(selection.mode==='month') anchor=selection.value;
    else if(selection.mode==='year') anchor=`${selection.value}-${previous.slice(5,7)}`;
    else {
      const quarter=Number(selection.value.slice(6));
      const month=Number(previous.slice(5,7));
      anchor=`${selection.value.slice(0,4)}-${String(Math.ceil(month/3)===quarter?month:(quarter-1)*3+1).padStart(2,'0')}`;
    }
  });
  function initialValueFor(mode: CalendarMode): string {
    if (mode === 'month') return anchor;
    const year = anchor.slice(0, 4);
    if (mode === 'year') return year;
    const quarter = Math.ceil(Number(anchor.slice(5, 7)) / 3);
    return `${year}-Q${quarter}`;
  }
  function modePending(mode: PeriodMode): boolean {
    return mode === 'month' ? monthPending : mode === 'last12Months' && rollingPending;
  }
  function calendarModeValue(mode: CalendarMode): string {
    const value = rememberedValues[mode] ?? initialValueFor(mode);
    return mode === 'month' && finalizationMonth && value > finalizationMonth ? finalizationMonth : value;
  }
  const pickerMax=$derived(mode === 'month' && finalizationMonth
    && (!max || calendarEndpoint(finalizationMonth, true) < calendarEndpoint(max, true)) ? finalizationMonth : max);
  function select(next:PeriodMode) {
    if (modePending(next)) {
      if (next !== mode) requestPendingMode(next);
      return;
    }
    const selection = next === 'last12Months'
      ? { mode: next, anchor: rollingMonth } as const
      : { mode: next, value: calendarModeValue(next) };
    commit(resolvePeriodSelection(selection,new Date(),precision));
  }
  function requestPendingMode(next: PeriodMode) {
    if (next === 'month') onpendingmode?.({ mode: next, value: calendarModeValue(next) });
    if (next === 'last12Months') onpendingmode?.({ mode: next });
  }
  const range = $derived(value?.selection?.mode === mode ? value : null);
  const selected = $derived(range?.selection?.mode === 'last12Months' ? undefined : range?.selection.value);
  const text = $derived(mode === 'last12Months' ? range ? periodRangeLabel(range) : DEFAULT_NULL_TEXT : selected ? selected.replace('-Q',' 年 Q') + (mode === 'year' ? ' 年' : '') : DEFAULT_NULL_TEXT);
</script>
<div class="period-filter" data-period-filter>
  {#if label}<span class="label">{label}</span>{/if}
  {#if readOnly}
    <span data-filter-display>{text}{mode!=='last12Months' && range?`（${range.from} 至 ${range.to}）`:''}</span>
  {:else}
    {#if modes.length>1}
    <div class="segments" role="group" aria-label={label??'时间粒度'}>
      {#each modes as item}<button type="button" aria-pressed={mode===item.id} disabled={!onpendingmode && modePending(item.id)} onclick={()=>select(item.id)}>{item.label}</button>{/each}
    </div>
    {/if}
    {#if mode==='last12Months'}
      <span class="range" data-period-range>{text}</span>
    {:else}
      <div class="picker">
        <DatePicker label={label??'统计期间'} precision={mode} {min} max={pickerMax} {blockedRanges} disabled={modePending(mode)} required value={selected?{from:selected,to:selected}:null}
          onchange={next=>{if(next)commit(resolvePeriodSelection({mode,value:next.from},new Date(),precision));}} />
      </div>
    {/if}
  {/if}
{#if error}<span role="status">{error}</span>{/if}
</div>
<style>
  .period-filter {display:flex;align-items:center;gap:var(--mc-period-filter-gap,12px);flex-wrap:wrap;min-width:0;max-width:100%;font-size:14px;color:#191919;}
  .label {display:var(--mc-filter-label-display,inline);color:#71717a;white-space:nowrap;}
  .segments {display:flex;max-width:100%;height:32px;border:1px solid #c2c2c2;border-radius:6px;background:#fff;}
  button {height:30px;min-width:42px;padding:0 12px;border:0;border-right:1px solid #e5e5e5;background:#fff;color:#595959;cursor:pointer;font:inherit;white-space:nowrap;}
  button:first-child{border-radius:5px 0 0 5px;}button:last-child{border-right:0;border-radius:0 5px 5px 0;}
  button:hover{color:#1476ff;}button[aria-pressed=true]{color:#1476ff;background:#deecff;}button:focus-visible{outline:2px solid #1476ff;outline-offset:2px;}
  button:disabled{color:#71717a;cursor:wait;}
  .range{display:inline-flex;align-items:center;min-height:32px;white-space:nowrap;}
  .picker{max-width:100%;--mc-date-picker-width:var(--mc-period-picker-width,220px);--mc-filter-label-display:none;}
</style>
