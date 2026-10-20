<script lang="ts">
  // Prototype adapter: preserve the user's month anchor without modifying the production control.
  import { untrack } from 'svelte';
  import PeriodFilter from '../../../engine/runtime-ui/src/filters/PeriodFilter.svelte';
  import { resolvePeriodSelection, type PeriodRange } from '../../../page/src/period-filter';
  let {value,onchange,readOnly=false,anchor}:{value:PeriodRange;onchange:(v:PeriodRange,anchor:string)=>void;readOnly?:boolean;anchor?:string}=$props();
  let remembered=$state(untrack(()=>anchor??value.from.slice(0,7)));
  $effect(()=>{if(anchor)remembered=anchor;else if(value.selection.mode==='month')remembered=value.selection.value;});
  function change(next:PeriodRange){
    const previous=value.selection.mode;const nextMode=next.selection.mode;
    if(nextMode==='last12Months'){onchange(next,remembered);return;}
    if(nextMode==='month'&&previous!=='month'){
      onchange(resolvePeriodSelection({mode:'month',value:remembered},new Date()),remembered);return;
    }
    if(nextMode==='year')remembered=next.selection.value.slice(0,4)+'-'+remembered.slice(5,7);
    if(nextMode==='quarter'&&previous==='quarter'){
      const month=(Number(next.selection.value.slice(6))-1)*3+1+(Number(remembered.slice(5,7))-1)%3;
      remembered=next.selection.value.slice(0,4)+'-'+String(month).padStart(2,'0');
    }
    if(nextMode==='month')remembered=next.selection.value;
    onchange(next,remembered);
  }
</script>
<PeriodFilter label="统计期间" {value} {readOnly} onchange={change}/>
