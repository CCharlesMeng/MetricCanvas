<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ResolvedIocHeader } from './model';
  let {model, filterIds, overflowIds=[], controls, returnContext, onback, readOnly=false, note, staticView=false}: {
    model:ResolvedIocHeader;filterIds:string[];overflowIds?:string[];controls:Snippet<[string,boolean]>;
    returnContext?:{entryId:string;label?:string};onback?:()=>void;readOnly?:boolean;note?:string;staticView?:boolean;
  } = $props();
  const flow=$derived(model.layout==='inline' && model.density==='normal' && model.collapse==='none');
  const uid = $props.id();
  const displayedIds=$derived(staticView?[...filterIds,...overflowIds]:filterIds);
  const showBack=$derived(!staticView && model.back && !!onback && (model.legacyBack || !!returnContext?.entryId));
  const hasIdentity=$derived(!!(model.title || model.code || model.tags.length || model.description || model.facts.length || showBack));
  let expanded=$state(false), overflowing=$state(false), firstHeight=$state(0), hiddenIds=$state<string[]>([]);
  let filters=$state<HTMLDivElement>();
  $effect(()=>{
    displayedIds;
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
{#if model.title || model.code || model.tags.length || model.description || model.facts.length || displayedIds.length || overflowIds.length || showBack}
<header data-ioc-header data-dashboard-toolbar={model.layout==='inline'?true:undefined} data-density={model.density} class:flow={flow} class:inline={model.layout==='inline'} class:identityless={!hasIdentity} class:static-view={staticView} class:compact={model.density==='compact'}>
  {#if hasIdentity}
    <div class="identity">
      <div class="heading">
        {#if showBack}<button data-dashboard-back class="back" type="button" aria-label={model.legacyBack?'返回':returnContext?.label ?? '返回来源页'} onclick={onback}>{flow?'<':'←'}</button>{/if}
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
  {#if displayedIds.length || overflowIds.length}
    <div class="filter-region">
      <div data-dashboard-primary-filters id={uid} bind:this={filters} class="filters" class:collapsed style:max-height={collapsed?`${firstHeight}px`:undefined}>
        {#each displayedIds as id (id)}
          {@const hidden=collapsed && hiddenIds.includes(id)}
          <div data-ioc-filter={id} class="filter" class:concealed={hidden} inert={hidden} aria-hidden={hidden || undefined}>
            {@render controls(id,readOnly || staticView)}
          </div>
        {/each}
      </div>
      {#if !staticView && overflowIds.length}
        <details data-dashboard-filter-overflow class="filter-overflow">
          <summary><span>更多筛选</span><span data-dashboard-filter-count class="filter-count">{overflowIds.length}</span><span class="overflow-arrow" aria-hidden="true">▾</span></summary>
          <div data-dashboard-overflow-panel class="overflow-panel">
            {#each overflowIds as id (id)}<div data-ioc-filter={id} class="filter">{@render controls(id,readOnly)}</div>{/each}
          </div>
        </details>
      {/if}
      {#if !staticView && model.collapse==='firstRow' && overflowing}<button class="toggle" type="button" aria-expanded={expanded} aria-controls={uid} onclick={toggle}>{expanded?'收起筛选':'展开筛选'}</button>{/if}
    </div>
  {/if}
  {#if note}<p class="note" role="status">{note}</p>{/if}
</header>
{/if}
<style>
  header{margin-bottom:16px;background:#fff;color:#191919;padding:22px 32px;min-width:0;max-width:100%;box-sizing:border-box;font-size:14px;}
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

  header.inline{display:grid;grid-template-columns:minmax(204px,max-content) minmax(0,1fr);align-items:center;gap:40px;min-height:80px;background:var(--mc-color-surface,#fff);}
  .inline .identity{margin-bottom:0;}.inline h1{font-weight:var(--mc-page-title-font-weight,500);white-space:nowrap;color:var(--mc-page-title-color,#191919);margin:0;}
  .inline .filter-region{align-items:center;}.inline .filters{gap:16px;align-items:center;}
  .inline .filter{--mc-filter-label-display:none;}
  .inline.identityless>.filter-region{grid-column:1 / -1;}
  .filter-overflow{position:relative;z-index:70;flex:none;}
  .filter-overflow summary{display:inline-flex;box-sizing:border-box;height:var(--mc-filter-control-height,34px);align-items:center;gap:6px;padding:0 12px;color:#191919;background:#fff;border:1px solid var(--mc-filter-control-border-color,#c2c2c2);border-radius:var(--mc-filter-control-radius,6px);cursor:pointer;font-size:var(--mc-filter-font-size,14px);list-style:none;white-space:nowrap;}
  .filter-overflow summary::-webkit-details-marker{display:none;}
  .filter-overflow summary:focus-visible{outline:2px solid var(--mc-color-primary,#08359e);outline-offset:2px;}
  .filter-count{display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;padding:0 4px;color:var(--mc-color-primary,#08359e);background:#eef3ff;border-radius:9px;font-size:12px;line-height:18px;}
  .overflow-arrow{color:#8c8c8c;}.filter-overflow[open] .overflow-arrow{transform:rotate(180deg);}
  .overflow-panel{position:absolute;top:calc(100% + 10px);right:0;box-sizing:border-box;width:min(760px,calc(100cqi - 48px));max-width:calc(100cqi - 48px);display:flex;flex-wrap:wrap;gap:16px;padding:16px;background:#fff;border:1px solid var(--mc-color-border,#e4e4e7);border-radius:8px;box-shadow:0 12px 32px rgb(15 23 42 / .16);}
  .overflow-panel .filter{--mc-filter-bar-flex:0 1 auto;--mc-filter-bar-wrap:wrap;}
  .inline>.note{grid-column:1 / -1;}
  header.inline.compact{position:sticky;z-index:66;top:0;display:flex;width:100%;height:56px;min-height:56px;gap:0;padding:0 24px;border-bottom:1px solid #e8e8e8;}
  .inline.compact .identity{flex:none;margin-right:24px;}.inline.compact .filter-region{flex:1;overflow-x:auto;}.inline.compact .filters{flex:0 0 auto;flex-wrap:nowrap;gap:12px;}
  .inline.compact h1{font-size:18px;font-weight:600;line-height:24px;}.inline.compact>.note{margin:0 0 0 12px;white-space:nowrap;}
  @container mc-runtime (max-width: 1050px){header.inline{grid-template-columns:minmax(0,1fr);gap:12px;padding:18px 20px;}.inline .filter-region{align-items:flex-start;}.inline h1{white-space:normal;}header.inline.compact{height:auto;min-height:56px;flex-wrap:wrap;gap:8px;}.inline.compact>.note{flex-basis:100%;white-space:normal;margin:0;}}

  header.static-view.inline.compact{position:static;height:auto;flex-wrap:wrap;}
  .static-view.inline.compact .filter-region{overflow:visible;flex-basis:100%;}
  .static-view.inline.compact .filters{flex:1;flex-wrap:wrap;}
  .static-view.inline.compact>.note{flex-basis:100%;white-space:normal;}

  header.flow{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;}
  .flow .identity,.flow .heading,.flow .filter-region,.flow .filters{display:contents;}
  .flow .back{font-size:20px;width:20px;min-height:32px;padding:0;}
  .flow h1{margin:0 24px 0 0;white-space:normal;}
  .flow .code,.flow .description,.flow dl,.flow .note{flex-basis:100%;}
</style>
