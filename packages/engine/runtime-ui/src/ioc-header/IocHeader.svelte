<svelte:options css="injected" />
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import type { ResolvedIocHeader } from './model';
  import { headerBackAction, type BrowserReturn } from './back';
  let {model, titleLink, filterIds, overflowIds=[], controls, returnContext, onback, readOnly=false, note, staticView=false}: {
    titleLink?:import('../../../widgets/src/components/text/links').TextBlockLink;
    model:ResolvedIocHeader;filterIds:string[];overflowIds?:string[];controls:Snippet<[string,boolean]>;
    returnContext?:{entryId:string;label?:string;back?:()=>void};onback?:()=>void;readOnly?:boolean;note?:string;staticView?:boolean;
  } = $props();
  let browser = $state<BrowserReturn>();
  onMount(() => { browser = window; });
  const backAction = $derived(headerBackAction(model, onback, browser));
  $effect(() => {
    if (note && !staticView) console.warn('[MetricCanvas][IOC_HEADER_NOTICE]', note);
  });
  const flow=$derived(model.layout==='inline' && model.collapse!=='firstRow');
  const uid = $props.id();
  const displayedIds=$derived(staticView?[...filterIds,...overflowIds]:filterIds);
  const showBack=$derived(!staticView && !!backAction);
  const hasIdentity=$derived(!!(model.title || model.code || model.tags.length || model.description || model.facts.length || showBack));
  let expanded=$state(false), overflowing=$state(false), firstHeight=$state(0), hiddenIds=$state<string[]>([]);
  let filters=$state<HTMLDivElement>();
  $effect(()=>{
    displayedIds;
    if(!filters)return;
    const element=filters;
    let active=true;
    const measure=()=>{
      if(!active)return;
      const nodes=Array.from(element.children) as HTMLElement[];
      const first=nodes[0]?.getBoundingClientRect().top ?? 0;
      const hidden=nodes.filter(node=>node.getBoundingClientRect().top > first+2);
      hiddenIds=hidden.map(node=>node.dataset.iocFilter!);
      overflowing=hidden.length>0;
      firstHeight=Math.max(0,...nodes.filter(node=>!hidden.includes(node)).map(node=>node.getBoundingClientRect().bottom-first));
    };
    const observer=new ResizeObserver(measure);observer.observe(element);
    for(const node of element.children)observer.observe(node);
    void element.ownerDocument.fonts?.ready.then(measure);
    measure();return()=>{active=false;observer.disconnect();};
  });
  const collapsed=$derived(!staticView && model.collapse==='firstRow' && overflowing && !expanded);
  function activateTitleLink(event:KeyboardEvent){
    if(!titleLink?.href && event.key==='Enter'){event.preventDefault();(event.currentTarget as HTMLAnchorElement).click();}
  }
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
        {#if showBack}<button data-dashboard-back class="back" type="button" aria-label={model.legacyBack?'返回':returnContext?.label ?? '返回上一页'} onclick={backAction}>{flow?'<':'←'}</button>{/if}
        {#if model.title}<h1 data-ioc-title>{#if titleLink && !staticView && !titleLink.disabled}<a href={titleLink.href} role={titleLink.href?undefined:'link'} aria-disabled={titleLink.href?undefined:true} tabindex={titleLink.href?undefined:0} onkeydown={activateTitleLink} onclick={titleLink.onclick}>{model.title}</a>{:else}<span aria-disabled={titleLink?.disabled || undefined}>{model.title}</span>{/if}</h1>{/if}
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
</header>
{/if}
<style>
  header{margin-bottom:16px;background:#fff;color:#191919;padding:22px 32px;min-height:77px;min-width:0;max-width:100%;box-sizing:border-box;font-size:14px;--mc-filter-control-height:33px;}
  .identity{margin-bottom:16px;min-width:0;}.heading{display:flex;gap:0;align-items:center;flex-wrap:wrap;min-width:0;}
  h1{font-size:24px;line-height:33px;font-weight:700;margin:0 40px 0 0;overflow-wrap:anywhere;max-width:100%;}
  h1 a{color:inherit;font:inherit;text-decoration:none;}h1 a:hover{text-decoration:underline;}h1 a:focus-visible{outline:2px solid #1476ff;outline-offset:2px;}
  .back{border:0;background:transparent;font-size:20px;font-weight:400;width:20px;min-height:32px;margin:0 4px 0 0;padding:0;cursor:pointer;flex:none;}
  .tag{margin-right:12px;padding:3px 8px;background:#f4f4f5;color:#52525b;border-radius:4px;overflow-wrap:anywhere;max-width:100%;}
  [data-tone=info]{background:#e8f1ff;color:#1476ff;}[data-tone=success]{background:#eef8e8;color:#397b16;}[data-tone=warning]{background:#fff5df;color:#905800;}[data-tone=danger]{background:#fff0f0;color:#b91c1c;}
  .code,.description,dl{margin:8px 0 0;color:#71717a;overflow-wrap:anywhere;}.code{display:flex;flex-wrap:wrap;gap:4px;}
  dl{display:flex;flex-wrap:wrap;gap:8px 24px;}dl>div{display:flex;flex-wrap:wrap;}dt,dd{margin:0;}
  .filter-region{display:flex;align-items:flex-start;gap:16px;min-width:0;}.filters{position:relative;display:flex;flex-wrap:wrap;align-items:flex-start;gap:5px 16px;min-width:0;flex:1;}
  .filter{min-width:0;max-width:100%;}.concealed{visibility:hidden;}.collapsed{overflow:visible;}
  .toggle{border:0;background:transparent;color:#1476ff;font:inherit;cursor:pointer;min-height:32px;flex:none;padding:0;}
  button:focus-visible{outline:2px solid #1476ff;outline-offset:2px;}
  .filter{--mc-filter-bar-padding:0;--mc-filter-bar-margin:0;--mc-filter-bar-border:0;--mc-filter-bar-background:transparent;--mc-filter-bar-gap:0;--mc-filter-label-display:inline;}

  header.inline{display:flex;flex-wrap:wrap;align-items:center;gap:12px 0;background:var(--mc-color-surface,#fff);}
  .inline .identity,.inline .heading{display:contents;}
  .inline h1{white-space:normal;color:var(--mc-page-title-color,#191919);max-width:100%;}
  .inline .code,.inline .description,.inline dl{flex-basis:100%;}
  .inline .filter-region{flex:1 1 240px;flex-wrap:wrap;align-items:center;}.inline .filters{gap:16px;align-items:center;}
  .inline .filter{--mc-filter-label-display:none;}
  .filter-overflow{position:relative;z-index:70;flex:none;margin-left:auto;}
  .filter-overflow summary{display:inline-flex;box-sizing:border-box;height:var(--mc-filter-control-height,34px);align-items:center;gap:6px;padding:0 12px;color:#191919;background:#fff;border:1px solid var(--mc-filter-control-border-color,#c2c2c2);border-radius:var(--mc-filter-control-radius,6px);cursor:pointer;font-size:var(--mc-filter-font-size,14px);list-style:none;white-space:nowrap;}
  .filter-overflow summary::-webkit-details-marker{display:none;}
  .filter-overflow summary:focus-visible{outline:2px solid var(--mc-color-primary,#08359e);outline-offset:2px;}
  .filter-count{display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;padding:0 4px;color:var(--mc-color-primary,#08359e);background:#eef3ff;border-radius:9px;font-size:12px;line-height:18px;}
  .overflow-arrow{color:#8c8c8c;}.filter-overflow[open] .overflow-arrow{transform:rotate(180deg);}
  .overflow-panel{position:absolute;top:calc(100% + 10px);right:0;box-sizing:border-box;width:min(760px,calc(100cqi - 48px));max-width:calc(100cqi - 48px);display:flex;flex-wrap:wrap;gap:16px;padding:16px;background:#fff;border:1px solid var(--mc-color-border,#e4e4e7);border-radius:8px;box-shadow:0 12px 32px rgb(15 23 42 / .16);}
  .overflow-panel .filter{--mc-filter-bar-flex:0 1 auto;--mc-filter-bar-wrap:wrap;}
  .flow .filter-region,.flow .filters{display:contents;}
  .flow .filter{margin-right:16px;}
  .filter :global([data-period-filter] .segments){height:33px;box-sizing:border-box;}
  .filter :global([data-period-filter] .segments button){height:31px;}
</style>
