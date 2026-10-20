<script lang="ts">
  import DatePicker from '../../src/components/date-picker/DatePicker.svelte';
  let {mode,from,to,onchange,disabled=false}:{mode:string;from:string;to:string;onchange:(from:string,to:string)=>void;disabled?:boolean}=$props();
  function end(month:string){return month+'-'+new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();}
  function isoWeek(value:string){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+3-(d.getUTCDay()+6)%7);const y=d.getUTCFullYear();const start=new Date(Date.UTC(y,0,4));return `${y}-W${String(1+Math.round((d.getTime()-start.getTime())/86400000/7)).padStart(2,'0')}`;}
</script>
{#key mode}
  {#if mode==='day'||mode==='singleDay'}<DatePicker label={mode==='day'?'日范围':'单日'} precision="date" range={mode==='day'} required {disabled} value={{from,to:mode==='day'?to:from}} onchange={v=>{if(v)onchange(v.from,v.to);}}/>
  {:else if mode==='month'||mode==='singleMonth'}<DatePicker label={mode==='month'?'月范围':'单月'} precision="month" range={mode==='month'} required {disabled} value={{from:from.slice(0,7),to:(mode==='month'?to:from).slice(0,7)}} onchange={v=>{if(v)onchange(v.from+'-01',end(v.to));}}/>
  {:else if mode==='week'}<label class="week">ISO 周（草案）<input type="week" aria-label="ISO 周" {disabled} value={isoWeek(from)} onchange={e=>{const [y,w]=e.currentTarget.value.split('-W').map(Number);if(!y||!w)return;const d=new Date(Date.UTC(y,0,4));d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7+7*(w-1));const end=new Date(d);end.setUTCDate(d.getUTCDate()+6);onchange(d.toISOString().slice(0,10),end.toISOString().slice(0,10));}}/></label>
  {:else if mode==='year'||mode==='quarter'}<DatePicker label={mode==='year'?'年份':'季度'} precision={mode} required {disabled} value={{from:mode==='year'?from.slice(0,4):from.slice(0,4)+'-Q'+Math.ceil(Number(from.slice(5,7))/3),to:mode==='year'?from.slice(0,4):from.slice(0,4)+'-Q'+Math.ceil(Number(from.slice(5,7))/3)}} onchange={v=>{if(!v)return;const y=Number(v.from.slice(0,4)),m=mode==='year'?1:(Number(v.from.slice(6))-1)*3+1,last=mode==='year'?12:m+2;onchange(`${y}-${String(m).padStart(2,'0')}-01`,end(`${y}-${String(last).padStart(2,'0')}`));}}/>
  {:else}<span>近一年：{from} ～ {to}</span>{/if}
{/key}
<style>.week{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.week input{font:inherit;padding:5px 8px;border:1px solid #c9cdd4;border-radius:5px;background:var(--surface,#fff);color:inherit}</style>
