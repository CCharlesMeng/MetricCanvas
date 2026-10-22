<script lang="ts">
  import { page } from '$app/state';
  import { goto, replaceState } from '$app/navigation';
  import { RuntimeSurface, RuntimeSection } from '@metriccanvas/engine/ui/composition';
  import { Select } from '@metriccanvas/ui';
  import type { RuntimeNavigation } from '@metriccanvas/engine/ui';
  import { pageRepository } from '$lib/services';
  import { pageReturnHref } from '$lib/page-return';
  import { createIocHeaderDemoGateway } from '../../../../../fixtures/ioc-header-demo';

  const document=pageRepository.load('ioc-header-demo');
  const dataGateway=createIocHeaderDemoGateway();
  const initialSearch=page.url.searchParams.toString();
  let chartType=$state('bar');
  const returnHref=page.url.searchParams.get('back')==='1' ? '/' : pageReturnHref('ioc-header-demo');
  const navigation:RuntimeNavigation={
    ...(returnHref?{returnContext:{entryId:returnHref,label:'返回'},back:()=>void goto(returnHref)}:{}),
    replaceSearch(search){const url=new URL(page.url);url.search=search;if(returnHref==='/')url.searchParams.set('back','1');replaceState(url,{});}
  };
</script>

<svelte:head><title>IOC Header · 经营概览</title></svelte:head>
{#await document}<p role="status">加载页面…</p>{:then document}
  <RuntimeSurface {document} {dataGateway} {navigation} {initialSearch}>
    {#snippet sectionsContent(sections, componentContent)}
      {#each sections as section (section.id)}
        {#if section.id==='trend'}
          <!-- Public composition seam: only this showcase owns chart-type presentation. -->
          <div class="trend-card" data-demo-trend>
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
