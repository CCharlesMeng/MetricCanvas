<script lang="ts">
  import { setContext } from 'svelte';
  import type { Component } from '@metriccanvas/page/internal';
  import { STATIC_EXPORT_CONTEXT } from '../../widgets/src/shared/export-context';
  import { headerPeriod } from './report-date-header';
  import { exportComponentData,exportComponentSnapshot,exportComponentMap,type ExportRenderState } from './export-render-state';
  import ComponentRenderer from './ComponentRenderer.svelte';
  import RuntimeSection from './RuntimeSection.svelte';
  import type { NestedComponentRender,TableRenderBinding } from './component-render';
  let {state,width,padding,gap}: {state:ExportRenderState;width:number;padding:string;gap:string}=$props();
  setContext(STATIC_EXPORT_CONTEXT,true);
  function table(component:Component):TableRenderBinding|undefined {
    return component.type==='table'?{view:state.tables[component.id]??{pageIndex:0,sort:[],headerFilters:{}},filterOptions:{},paginationConfig:{mode:'none'},onpage:()=>{},onpagesize:()=>{},onsort:()=>{},onheaderfilter:()=>{},oncellselect:()=>{}}:undefined;
  }
  const nested:NestedComponentRender={map:c=>exportComponentMap(state,c),data:c=>exportComponentData(state,c),snapshot:c=>exportComponentSnapshot(state,c),table,onchartclick:()=>undefined,onmetriclink:()=>undefined,metricHref:()=>()=>undefined};
</script>
<div class="export-view" data-export-view data-export-paper="A4" style:width={`${width}px`} style:padding={padding} style:gap={gap}>
  {#each state.page.filters??[] as filter}{#if filter.type==='timeRange' && filter.display==='period'}{@const applied=state.filters.get(filter.id)}{#if applied?.type==='timeRange'}<p data-export-period>{filter.label??'统计期间'}：{applied.from} 至 {applied.to}</p>{/if}{/if}{/each}
  {#snippet componentContent(component:Component)}
    <div data-export-component={component.id}>
    <ComponentRenderer {component} data={exportComponentData(state,component)} snapshot={exportComponentSnapshot(state,component)}
      pageSnapshots={state.snapshots} map={exportComponentMap(state,component)} exportMode={true} {nested} table={table(component)}
      summarySnapshot={component.type==='aiSummary'?state.summaries[component.id]:undefined}
      headerPeriod={header=>headerPeriod(header.props,state.page.filters??[],state.filters,state.page.schemaVersion)}/>
    </div>
  {/snippet}
  {#each state.page.sections as section (section.id)}
    <RuntimeSection {section} {componentContent}/>
  {/each}
</div>
<style>
  .export-view { display:flex; flex-direction:column; box-sizing:border-box; color:var(--mc-color-text,#191919); background:inherit; }
  [data-export-component] { display:contents; }
  .export-view :global(*) { box-sizing:border-box; animation:none!important; transition:none!important; }
</style>
