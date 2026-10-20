<svelte:options css="injected" />
<script lang="ts">
  import { untrack } from 'svelte';
  import { DatePicker } from '@metriccanvas/ui';
  import { timeAvailabilityIssue,resolvePeriodSelection, periodRangeLabel, type PeriodMode, type PeriodRange, type AppliedPeriodSelection } from '@metriccanvas/page/internal';
  let {label,precision='date',value,readOnly=false,periodModes,min,max,blockedRanges=[],onchange}:{label?:string;precision?:'month'|'date';value:PeriodRange|null;readOnly?:boolean;periodModes?:PeriodMode[];min?:string;max?:string;blockedRanges?:readonly {from:string;to:string}[];onchange:(value:PeriodRange)=>void}=$props();
  let error=$state('');
  function commit(range:PeriodRange){error=timeAvailabilityIssue({id:'period',type:'timeRange',min,max,blockedRanges:[...blockedRanges]},{type:'timeRange',...range})??'';if(!error)onchange(range);}
  const allModes=[{id:'year',label:'年'},{id:'quarter',label:'季'},{id:'month',label:'月'},{id:'last12Months',label:'近一年'}] as const;
  const modes=$derived(periodModes ? periodModes.map(id=>allModes.find(item=>item.id===id)!) : allModes);
  const mode=$derived(value?.selection.mode ?? periodModes?.[0] ?? 'month');
  let anchor=$state(untrack(()=>anchorOf(value?.selection)));
  function anchorOf(selection?:AppliedPeriodSelection):string {
    if (!selection || selection.mode==='last12Months') {const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;}
    if(selection.mode==='month')return selection.value;
    if(selection.mode==='quarter')return `${selection.value.slice(0,4)}-${String((Number(selection.value.slice(6))-1)*3+1).padStart(2,'0')}`;
    return `${selection.value}-01`;
  }
  $effect(()=>{
    const selection=value?.selection;
    if(!selection || selection.mode==='last12Months')return;
    const previous=untrack(()=>anchor);
    if(selection.mode==='month') anchor=selection.value;
    else if(selection.mode==='year') anchor=`${selection.value}-${previous.slice(5,7)}`;
    else {
      const quarter=Number(selection.value.slice(6));
      const month=Number(previous.slice(5,7));
      anchor=`${selection.value.slice(0,4)}-${String(Math.ceil(month/3)===quarter?month:(quarter-1)*3+1).padStart(2,'0')}`;
    }
  });
  function select(next:PeriodMode) {
    const selection=next==='last12Months'?{mode:next} as const:{mode:next,value:next==='year'?anchor.slice(0,4):next==='quarter'?`${anchor.slice(0,4)}-Q${Math.ceil(Number(anchor.slice(5,7))/3)}`:anchor};
    commit(resolvePeriodSelection(selection,new Date(),precision));
  }
  const selected=$derived(value?.selection.mode==='last12Months'?undefined:value?.selection.value);
  const text=$derived(mode==='last12Months'?value?periodRangeLabel(value):'—':selected?.replace('-Q',' 年 Q')+(mode==='year'?' 年':''));
</script>
<div class="period-filter" data-period-filter>
  {#if label}<span class="label">{label}</span>{/if}
  {#if readOnly}
    <span data-filter-display>{text}{mode!=='last12Months' && value?`（${value.from} 至 ${value.to}）`:''}</span>
  {:else}
    {#if modes.length>1}
    <div class="segments" role="group" aria-label={label??'时间粒度'}>
      {#each modes as item}<button type="button" aria-pressed={mode===item.id} onclick={()=>select(item.id)}>{item.label}</button>{/each}
    </div>
    {/if}
    {#if mode==='last12Months'}
      <span class="range" data-period-range>{value?periodRangeLabel(value):'—'}</span>
    {:else}
      <div class="picker">
        <DatePicker label={label??'统计期间'} precision={mode} {min} {max} {blockedRanges} required value={selected?{from:selected,to:selected}:null}
          onchange={next=>{if(next)commit(resolvePeriodSelection({mode,value:next.from},new Date(),precision));}} />
      </div>
    {/if}
  {/if}
{#if error}<span role="status">{error}</span>{/if}
</div>
<style>
  .period-filter {display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-width:0;max-width:100%;font-size:14px;color:#191919;}
  .label {display:var(--mc-filter-label-display,inline);color:#71717a;white-space:nowrap;}
  .segments {display:flex;max-width:100%;height:32px;border:1px solid #c2c2c2;border-radius:6px;background:#fff;}
  button {height:30px;min-width:42px;padding:0 12px;border:0;border-right:1px solid #e5e5e5;background:#fff;color:#595959;cursor:pointer;font:inherit;white-space:nowrap;}
  button:first-child{border-radius:5px 0 0 5px;}button:last-child{border-right:0;border-radius:0 5px 5px 0;}
  button:hover{color:#1476ff;}button[aria-pressed=true]{color:#1476ff;background:#deecff;}button:focus-visible{outline:2px solid #1476ff;outline-offset:2px;}
  .range{display:inline-flex;align-items:center;min-height:32px;white-space:nowrap;}
  .picker{max-width:100%;--mc-date-picker-width:220px;--mc-filter-label-display:none;}
</style>
