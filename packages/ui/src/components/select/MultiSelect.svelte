<svelte:options css="injected" />
<script lang="ts">
  import type {UiOption} from '../../types';
  let {label,value,options,disabled=false,loading=false,error,searchable=false,required=false,onchange}: {
    label:string;value:string[];options:readonly UiOption[];disabled?:boolean;loading?:boolean;error?:string;
    searchable?:boolean;required?:boolean;onchange:(values:string[])=>void;
  }=$props();
  let keyword=$state('');
  const filtered=$derived(options.filter(option=>!searchable||`${option.label} ${option.value}`.toLowerCase().includes(keyword.toLowerCase())));
  const summary=$derived(value.length?value.map(v=>options.find(o=>o.value===v)?.label??v).join('、'):'全部');
  function toggle(option:UiOption){if(disabled||loading||option.disabled)return;const next=value.includes(option.value)?value.filter(v=>v!==option.value):[...value,option.value];if(required&&next.length!==1)return;onchange(next);}
</script>
<details class="multi" inert={disabled||undefined}><summary aria-label={label} aria-disabled={disabled||loading}>{summary}<span aria-hidden="true">▾</span></summary>
  <div class="options" role="group" aria-label={label}>
    {#if searchable}<input type="search" aria-label={`搜索${label}候选`} placeholder="筛选当前候选" bind:value={keyword} disabled={disabled||loading}/>{/if}
    {#if loading}<span role="status">加载中…</span>{/if}
    {#if error}<span role="alert">{error}</span>{/if}
    {#each filtered as option(option.value)}<label><input type="checkbox" checked={value.includes(option.value)} disabled={disabled||loading||option.disabled} onchange={()=>toggle(option)}/>{option.label}</label>{/each}
    {#if !required}<button type="button" disabled={disabled||loading} onclick={()=>onchange([])}>清除筛选</button><button type="button" disabled={disabled||loading} onclick={()=>onchange(options.filter(o=>!o.disabled).map(o=>o.value))}>全选</button>{/if}
  </div>
</details>
<style>
.multi{position:relative;min-width:var(--mc-filter-control-min-width,160px);max-width:100%}summary{list-style:none;cursor:pointer;border:1px solid var(--mc-filter-control-border-color,#d9d9d9);border-radius:var(--mc-filter-control-radius,4px);min-height:var(--mc-filter-control-height,32px);box-sizing:border-box;padding:6px 12px;display:flex;gap:12px;align-items:center;justify-content:space-between;max-width:320px;overflow-wrap:anywhere}summary::-webkit-details-marker{display:none}.options{position:absolute;z-index:10;top:calc(100% + 4px);left:0;min-width:100%;max-width:min(320px,calc(100vw - 64px));box-sizing:border-box;background:#fff;border:1px solid #d9d9d9;border-radius:4px;padding:8px;box-shadow:0 8px 24px rgb(0 0 0 / .1);max-height:280px;overflow:auto;display:flex;flex-direction:column;gap:6px}.options label{display:flex;gap:8px;align-items:center}.options button{border:0;background:transparent;color:#1476ff;text-align:left;padding:6px}.options input[type=search]{min-width:0;max-width:100%;box-sizing:border-box}summary:focus-visible{outline:2px solid #1476ff;outline-offset:2px}
</style>
