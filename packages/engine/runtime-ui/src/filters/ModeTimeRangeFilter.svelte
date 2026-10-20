<svelte:options css="injected" />
<script lang="ts">
 import {untrack} from 'svelte';
 import {DatePicker} from '@metriccanvas/ui';
 import {initialModeRange,isoWeekRange,isoWeekLabel,timeAvailabilityIssue,timeFilterBoundaryError,type TimeRangeFilterDeclaration,type TimeRangeValue,type TimeMode,type DisplayInputsSnapshot} from '@metriccanvas/page/internal';
 interface Props {declaration:TimeRangeFilterDeclaration;value:TimeRangeValue|null;readOnly?:boolean;max?:string;blockedRanges?:readonly TimeRangeValue[];snapshot?:DisplayInputsSnapshot;revision?:number;onchange:(value:TimeRangeValue)=>void}
 let {declaration,value,readOnly=false,max,blockedRanges=[],snapshot,revision,onchange}:Props=$props();
 let memory=$state<Record<string,TimeRangeValue>>({});
 let error=$state('');
 const mode=$derived(value?.mode??declaration.defaultMode!);
 $effect(()=>{if(value?.mode){const current=value;untrack(()=>{memory={...memory,[current.mode!]:current};error='';});}});
 function commit(next:TimeRangeValue){
  error=timeAvailabilityIssue(declaration,{type:'timeRange',...next},snapshot,revision)??timeFilterBoundaryError(declaration,{type:'timeRange',...next})??'';
  if(!error){memory={...memory,[next.mode!]:next};onchange(next);}
 }
 function changeMode(next:TimeMode){
  const now=new Date(),remembered=memory[next];
  const legal=(range:TimeRangeValue)=>!timeAvailabilityIssue(declaration,{type:'timeRange',...range},snapshot,revision)&&!timeFilterBoundaryError(declaration,{type:'timeRange',...range},now);
  if(remembered&&legal(remembered)){commit(remembered);return;}
  try{const fallback=initialModeRange(declaration,next,now);if(legal(fallback))commit(fallback);else error='该模式的默认期间不可用';}catch{error='该模式的默认期间不可用';}
 }
</script>
<div class="mode-range" data-time-modes>
 {#if readOnly}<span data-filter-display>{declaration.label}：{mode==='day'?'日':mode==='month'?'月':'ISO周'} {value?`${value.from}～${value.to}`:'等待合法期间'}</span>{:else}
 <span class="mode-label">{declaration.label}</span>
 <div class="modes" role="group" aria-label={`${declaration.label??'期间'}模式`}>
  {#each declaration.modes??[] as item}<button type="button" aria-pressed={mode===item.id} disabled={readOnly} onclick={()=>changeMode(item.id)}>{item.id==='day'?'日':item.id==='month'?'月':'ISO周'}</button>{/each}
 </div>
 {#if mode==='isoWeek'}
  <DatePicker label={`${declaration.label??'期间'}周内日期`} precision="date" required disabled={readOnly} min={declaration.min} {max} {blockedRanges} disableFuture={declaration.disableFuture??true}
   value={value?{from:value.from,to:value.from}:null} onchange={next=>{if(next)commit({mode:'isoWeek',...isoWeekRange(next.from)});}} />
  {#if value}<span data-filter-display>{isoWeekLabel(value.from)} · {value.from}～{value.to}</span>{/if}
 {:else}
  <DatePicker label={declaration.label} precision={mode==='month'?'month':'date'} range required disabled={readOnly} min={declaration.min} {max} {blockedRanges} disableFuture={declaration.disableFuture??true}
   {value} onchange={next=>{if(next)commit({...next,mode});}} />
 {/if}
 {/if}
 {#if error}<span role="status" class="error">{error}</span>{/if}
</div>
<style>
 .mode-range{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0;max-width:100%;font-size:13px}.mode-label{color:#71717a}.modes{display:flex;flex:none;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden}.modes button{border:0;background:#fff;color:#52525b;padding:7px 10px;font:inherit;cursor:pointer}.modes button[aria-pressed=true]{background:#eaf3ff;color:#135dcc}.modes button:disabled{cursor:default}.error{color:#b91c1c;flex-basis:100%}[data-filter-display]{overflow-wrap:anywhere}
</style>
