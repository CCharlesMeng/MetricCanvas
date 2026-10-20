<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ResolvedIocHeader } from './model';
  let {model, filterIds, controls, returnContext, onback, readOnly=false, note, staticView=false}: {
    model:ResolvedIocHeader;filterIds:string[];controls:Snippet<[string,boolean]>;
    returnContext?:{entryId:string;label?:string};onback?:()=>void;readOnly?:boolean;note?:string;staticView?:boolean;
  } = $props();
  const uid = $props.id();
  let expanded=$state(false), overflowing=$state(false), firstHeight=$state(0), hiddenIds=$state<string[]>([]);
  let filters=$state<HTMLDivElement>();
  $effect(()=>{
    if(!filters)return;
    const measure=()=>{
      const nodes=Array.from(filters!.children) as HTMLElement[];
      const first=nodes[0]?.getBoundingClientRect().top ?? 0;
      const hidden=nodes.filter(node=>node.getBoundingClientRect().top > first+2);
      hiddenIds=hidden.map(node=>node.dataset.iocFilter!);
      overflowing=hidden.length>0;
      firstHeight=Math.max(0,...nodes.filter(node=>!hidden.includes(node)).map(node=>node.getBoundingClientRect().bottom-first));
    };
    const observer=new ResizeObserver(measure);observer.observe(filters);
    for(const node of filters.children)observer.observe(node);
    void filters.ownerDocument.fonts?.ready.then(measure);
    measure();return()=>observer.disconnect();
  });
  const collapsed=$derived(!staticView && model.collapse==='firstRow' && overflowing && !expanded);
  function toggle(){
    if(expanded){for(const details of filters!.querySelectorAll('details[open]'))details.removeAttribute('open');const active=(filters!.getRootNode() as Document|ShadowRoot).activeElement;if(active && filters!.contains(active)) (active as HTMLElement).blur();}
    expanded=!expanded;
  }
</script>
{#if model.title || model.code || model.tags.length || model.description || model.facts.length || filterIds.length || (!staticView && model.back && returnContext?.entryId && onback)}
<header data-ioc-header data-density={model.density} class:compact={model.density==='compact'}>
  {#if model.title || model.code || model.tags.length || model.description || model.facts.length || (!staticView && model.back && returnContext && onback)}
    <div class="identity">
      <div class="heading">
        {#if !staticView && model.back && returnContext?.entryId && onback}<button class="back" type="button" aria-label={returnContext.label ?? '返回来源页'} onclick={onback}>←</button>{/if}
        {#if model.title}<h1 data-ioc-title>{model.title}</h1>{/if}
        {#each model.tags as tag (tag.id)}<span data-ioc-tag={tag.id} data-tone={tag.tone} class="tag">{tag.text}</span>{/each}
      </div>
      {#if model.code}<div class="code" data-ioc-code><span>{model.code.label}：</span><span>{model.code.value}</span></div>{/if}
      {#if model.description}
        {#if !staticView && model.description.presentation==='tooltip'}<details class="description"><summary aria-label="查看页面说明">说明</summary><p>{model.description.text}</p></details>
        {:else}<p class="description">{model.description.text}</p>{/if}
      {/if}
      {#if model.facts.length}<dl>{#each model.facts as fact (fact.id)}<div data-ioc-fact={fact.id}><dt>{fact.label}：</dt><dd>{fact.value}</dd></div>{/each}</dl>{/if}
    </div>
  {/if}
  {#if filterIds.length}
    <div class="filter-region">
      <div id={uid} bind:this={filters} class="filters" class:collapsed style:max-height={collapsed?`${firstHeight}px`:undefined}>
        {#each filterIds as id (id)}
          {@const hidden=collapsed && hiddenIds.includes(id)}
          <div data-ioc-filter={id} class="filter" class:concealed={hidden} inert={hidden} aria-hidden={hidden || undefined}>
            {@render controls(id,readOnly || staticView)}
          </div>
        {/each}
      </div>
      {#if !staticView && model.collapse==='firstRow' && overflowing}<button class="toggle" type="button" aria-expanded={expanded} aria-controls={uid} onclick={toggle}>{expanded?'收起筛选':'展开筛选'}</button>{/if}
    </div>
  {/if}
  {#if note}<p class="note" role="status">{note}</p>{/if}
</header>
{/if}
<style>
  header{background:#fff;color:#191919;padding:22px 32px;min-width:0;max-width:100%;box-sizing:border-box;font-size:14px;}
  header.compact{padding-block:16px;}
  .identity{margin-bottom:16px;min-width:0;}.heading{display:flex;gap:12px;align-items:center;flex-wrap:wrap;min-width:0;}
  h1{font-size:24px;line-height:36px;font-weight:600;margin:0 40px 0 0;overflow-wrap:anywhere;max-width:100%;}
  .back{border:0;background:transparent;font-size:24px;width:32px;min-height:32px;cursor:pointer;flex:none;}
  .tag{padding:3px 8px;background:#f4f4f5;color:#52525b;border-radius:4px;overflow-wrap:anywhere;max-width:100%;}
  [data-tone=info]{background:#e8f1ff;color:#1476ff;}[data-tone=success]{background:#eef8e8;color:#397b16;}[data-tone=warning]{background:#fff5df;color:#905800;}[data-tone=danger]{background:#fff0f0;color:#b91c1c;}
  .code,.description,dl{margin:8px 0 0;color:#71717a;overflow-wrap:anywhere;}.code{display:flex;flex-wrap:wrap;gap:4px;}
  dl{display:flex;flex-wrap:wrap;gap:8px 24px;}dl>div{display:flex;flex-wrap:wrap;}dt,dd{margin:0;}
  .filter-region{display:flex;align-items:flex-start;gap:16px;min-width:0;}.filters{position:relative;display:flex;flex-wrap:wrap;align-items:flex-start;gap:5px 16px;min-width:0;flex:1;}
  .filter{min-width:0;max-width:100%;}.concealed{visibility:hidden;}.collapsed{overflow:visible;}
  .toggle{border:0;background:transparent;color:#1476ff;font:inherit;cursor:pointer;min-height:32px;flex:none;padding:0;}
  .note{margin:10px 0 0;color:#71717a;overflow-wrap:anywhere;}
  button:focus-visible{outline:2px solid #1476ff;outline-offset:2px;}
  .filter{--mc-filter-bar-padding:0;--mc-filter-bar-margin:0;--mc-filter-bar-border:0;--mc-filter-bar-background:transparent;--mc-filter-bar-gap:0;--mc-filter-label-display:inline;}
</style>
