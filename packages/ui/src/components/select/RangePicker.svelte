<svelte:options css="injected" />
<script lang="ts">
  import { detailsPopover } from "../../shared/details-popover";
  type Range={from?:number;to?:number};
  let {label,value,unit='',context='',presets=[],validate,onchange}:{label:string;value:Range;unit?:string;context?:string;presets?:readonly {id:string;label:string;range:Range}[];validate?:(range:Range)=>string|undefined;onchange:(range:Range)=>void}=$props();
  let open=$state(false),from=$state(''),to=$state(''),error=$state('');
  function draft(range:Range){from=range.from===undefined?'':String(range.from);to=range.to===undefined?'':String(range.to);error='';}
  $effect(()=>{context;from='';to='';error='';open=false;});
  const summary=$derived(value.from===undefined&&value.to===undefined?'全部':`${value.from===undefined?'不限':value.from}～${value.to===undefined?'不限':value.to}${unit}`);
  function apply(){
    const range={...(from.trim()?{from:Number(from)}:{}),...(to.trim()?{to:Number(to)}:{})};
    error=[range.from,range.to].some(v=>v!==undefined&&!Number.isFinite(v))?'请输入有限数字':validate?.(range)??'';
    if(error)return;onchange(range);open=false;
  }
  function closeWhenInert(node:HTMLDetailsElement){const ancestor=node.closest('[data-ioc-filter]');const observer=new MutationObserver(()=>{if(node.closest('[inert]')){open=false;error='';}});if(ancestor)observer.observe(ancestor,{attributes:true,attributeFilter:['inert']});return {destroy:()=>observer.disconnect()};}
</script>
<details use:detailsPopover class="range-picker" bind:open use:closeWhenInert>
 <summary aria-label={label} onclick={event=>{event.preventDefault();if(!open)draft(value);open=!open;}}>{summary}<span aria-hidden="true">▾</span></summary>
 <div popover="auto" class="panel" role="group" aria-label={`${label}范围`}>
  {#if presets.length}<div class="presets">{#each presets as preset(preset.id)}<button type="button" onclick={()=>draft(preset.range)}>{preset.label}</button>{/each}</div>{/if}
  <div class="bounds"><label>下限<input aria-label={`${label}下限`} inputmode="decimal" bind:value={from}/></label><span>至</span><label>上限<input aria-label={`${label}上限`} inputmode="decimal" bind:value={to}/></label></div>
  {#if unit}<p class="unit">单位：{unit}</p>{/if}{#if error}<p role="alert">{error}</p>{/if}
  <div class="actions"><button type="button" onclick={()=>{open=false;error='';}}>取消</button><button type="button" onclick={apply}>确定</button></div>
 </div>
</details>
<style>
.range-picker{position:relative;min-width:160px;max-width:100%;font-size:13px}summary{list-style:none;display:flex;gap:12px;justify-content:space-between;border:1px solid #d9d9d9;border-radius:4px;padding:6px 12px;cursor:pointer;min-height:32px;box-sizing:border-box}summary::-webkit-details-marker{display:none}.panel{position:fixed;inset:auto;margin:0;left:0;z-index:20;width:min(300px,calc(100vw - 80px));box-sizing:border-box;overflow:auto;padding:12px;background:#fff;border:1px solid #d9d9d9;border-radius:4px;box-shadow:0 8px 24px rgb(0 0 0 / .1)}.presets{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}.bounds{display:flex;gap:8px;align-items:center}.bounds label{min-width:0;flex:1}.bounds input{box-sizing:border-box;width:100%;border:1px solid #d9d9d9;border-radius:4px;padding:6px;font:inherit}.unit{color:#71717a;margin:8px 0}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}button{background:#fff;border:1px solid #d9d9d9;border-radius:4px;padding:4px 8px;font:inherit;cursor:pointer}.actions button:last-child{background:#1476ff;color:#fff;border-color:#1476ff}[role=alert]{color:#b91c1c;margin:8px 0}summary:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid #1476ff;outline-offset:2px}
.panel[popover]:not(:popover-open){display:none}
</style>
