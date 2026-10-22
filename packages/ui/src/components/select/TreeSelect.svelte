<svelte:options css="injected" />
<script lang="ts">
  import type {UiTreeNode} from '../../types';
  let {label,value,options,disabled=false,loading=false,error,required=false,onchange}: {label:string;value:string[];options:readonly UiTreeNode[];disabled?:boolean;loading?:boolean;error?:string;required?:boolean;onchange:(value:string[])=>void}=$props();
  let collapsed=$state<Record<string,boolean>>({});
  const selected=$derived(new Set(value));
  function toggle(node:UiTreeNode){if(disabled||loading||node.disabled||node.value===undefined||(required&&value.length===1&&selected.has(node.value)))return;onchange(selected.has(node.value)?value.filter(v=>v!==node.value):[...value,node.value]);}
</script>
<details class="tree-select" inert={disabled||undefined}><summary aria-label={label} aria-disabled={disabled||loading}>{value.length?`已选 ${value.length} 项`:'全部'}<span aria-hidden="true">▾</span></summary><div class="nodes" role="tree" aria-label={label}>
  {#if loading}<span role="status">加载中…</span>{/if}{#if error}<span role="alert">{error}</span>{/if}
  {#each options as node(node.key)}{@render row(node,0)}{/each}
  {#if !required}<button type="button" disabled={disabled||loading} onclick={()=>onchange([])}>清除筛选</button>{/if}
</div></details>
{#snippet row(node:UiTreeNode,depth:number)}
  <div class="node" role="treeitem" aria-selected={node.value!==undefined?selected.has(node.value):undefined} aria-expanded={node.children?.length?!collapsed[node.key]:undefined} style:padding-left="{depth*16}px">
    {#if node.children?.length}<button type="button" aria-label={`${collapsed[node.key]?'展开':'收起'}${node.label}`} onclick={()=>collapsed={...collapsed,[node.key]:!collapsed[node.key]}}>{collapsed[node.key]?'▸':'▾'}</button>{:else}<span class="spacer"></span>{/if}
    {#if node.value!==undefined}<label><input type="checkbox" checked={selected.has(node.value)} disabled={disabled||loading||node.disabled||(required&&value.length===1&&selected.has(node.value))} onchange={()=>toggle(node)}/>{node.label}</label>{:else}<span>{node.label}</span>{/if}
  </div>
  {#if !collapsed[node.key]}{#each node.children??[] as child(child.key)}{@render row(child,depth+1)}{/each}{/if}
{/snippet}
<style>
.tree-select{position:relative;min-width:var(--mc-filter-control-min-width,160px);max-width:100%}summary{list-style:none;display:flex;justify-content:space-between;gap:12px;border:1px solid var(--mc-filter-control-border-color,#d9d9d9);border-radius:var(--mc-filter-control-radius,4px);padding:6px 12px;min-height:var(--mc-filter-control-height,32px);box-sizing:border-box;cursor:pointer}summary::-webkit-details-marker{display:none}.nodes{position:absolute;z-index:10;left:0;top:calc(100% + 4px);background:#fff;border:1px solid #d9d9d9;border-radius:4px;min-width:100%;max-width:min(320px,calc(100vw - 64px));max-height:280px;overflow:auto;padding:8px;box-sizing:border-box;box-shadow:0 8px 24px rgb(0 0 0 / .1)}.node{display:flex;align-items:center;gap:4px;min-height:32px;white-space:nowrap}.node label{display:flex;align-items:center;gap:8px}.spacer,.node button{width:20px;flex-shrink:0}.nodes button{border:0;background:transparent;cursor:pointer;color:#1476ff}summary:focus-visible{outline:2px solid #1476ff;outline-offset:2px}
</style>
