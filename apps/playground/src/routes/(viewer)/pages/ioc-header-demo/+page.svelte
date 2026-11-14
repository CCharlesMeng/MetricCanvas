<script lang="ts">
  import { browser } from '$app/environment';
  import {onMount} from 'svelte';
  import PageDocument from '$lib/PageDocument.svelte';
  const framed = browser && window.self !== window.top;
  import { page } from '$app/state';
  import { goto, replaceState } from '$app/navigation';
  import { RuntimeSurface, RuntimeSection } from '@metriccanvas/engine/ui/composition';
  import { Select } from '@metriccanvas/ui';
  import type { RuntimeNavigation } from '@metriccanvas/engine/ui';
  import { pageRepository } from '$lib/services';
  import { createPlaygroundPageReturn } from '$lib/page-return';
  import {preserveNavigationEntry} from '@metriccanvas/engine/ui/navigation';
  import { createIocBusinessPreview } from '$lib/ioc-business-preview';

  const pageId=decodeURIComponent(page.url.pathname.split('/').filter(Boolean).at(-1) ?? '');
  const document=pageRepository.load(pageId);
  const dataGateway=createIocBusinessPreview(pageId).dataGateway;
  const initialSearch=page.url.searchParams.toString();
  let chartType=$state('bar');
  const returns=createPlaygroundPageReturn();
  let returnRevision=$state(0);
  onMount(()=>returns.subscribe(()=>returnRevision++));
  const returnHref=$derived.by(()=>{returnRevision;page.url.href;return page.url.searchParams.get('back')==='1' ? '/' : returns.current()?.sourceHref;});
  const navigation:RuntimeNavigation={
    get returnContext(){returnRevision;page.url.href;const context=returns.current();return context?{entryId:context.entryId,label:'返回',back:()=>void returns.back(href=>goto(href)).catch(error=>console.warn('[MetricCanvas][NAVIGATION_ERROR]',error))}:undefined;},
    get back(){const href=returnHref;return href?()=>void goto(href):undefined;},
    preserveSearchParams:['back'],
    replaceSearch(search){const url=new URL(page.url);url.search=search;if(returnHref==='/')url.searchParams.set('back','1');preserveNavigationEntry(()=>replaceState(url,page.state));}
  };
</script>

<svelte:head><title>IOC Header · 经营概览</title></svelte:head>
{#await document}<div aria-busy="true"><span class="skeleton" aria-hidden="true" style="display:block;width:68%;height:12px;border-radius:4px;background:#e4e4e7"></span></div>{:then document}
  {#if !framed}<PageDocument {pageId} {document} />{/if}
  <RuntimeSurface {document} {dataGateway} {navigation} {initialSearch}>
    {#snippet sectionsContent(sections, componentContent)}
      {#each sections as section (section.id)}
        {#if section.id==='trend'}
          <!-- Public composition seam: only this showcase owns chart-type presentation. -->
          <div class="trend-card" data-showcase-trend>
            <div class="trend-controls">
              <div>{@render componentContent(section.components[0]!)}</div>
              <div class="chart-type"><Select label="图表类型" value={chartType} options={[{value:'bar',label:'柱状图'},{value:'line',label:'折线图'}]} onchange={value=>chartType=value}/></div>
            </div>
            <RuntimeSection section={{...section,container:'plain',components:section.components.filter(component=>component.id===`trend-${chartType}`)}} {componentContent}/>
          </div>
        {:else}
          <RuntimeSection {section} {componentContent}/>
        {/if}
      {/each}
    {/snippet}
  </RuntimeSurface>
{:catch}<p role="alert">页面加载失败</p>{/await}

<style>
  .trend-card{min-width:0;background:var(--mc-color-surface,#fff);border-radius:var(--mc-radius-section,16px);padding:var(--mc-section-card-padding,20px);}
  .trend-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
  .chart-type{width:160px;max-width:100%;margin-left:auto;}
</style>
