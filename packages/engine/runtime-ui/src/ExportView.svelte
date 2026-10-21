<svelte:options css="injected" />
<script lang="ts">
  import {compilePresentation} from '../../runtime/src/presentation';
  import {PRESENTATION_CONTEXT} from './presentation-context';
  import { chartOptionPaths } from '@metriccanvas/page/internal';
  import { CHART_OPTION_PATHS } from '../../widgets/src/shared/chart-option-extension';
  import FilterBar from './filters/FilterBar.svelte';
  import IocHeader from './ioc-header/IocHeader.svelte';
  import { resolvedIocHeader } from './ioc-header/model';
  import { setContext, untrack } from 'svelte';
  import { projectFieldSelections,isChartComponent, type Component } from '@metriccanvas/page/internal';
  import { EXPORT_SCALE_CONTEXT, STATIC_EXPORT_CONTEXT } from '../../widgets/src/shared/export-context';
  import { headerPeriod } from './report-date-header';
  import { exportComponentData,exportComponentSnapshot,exportComponentMap,type ExportRenderState } from './export-render-state';
  import ComponentRenderer from './ComponentRenderer.svelte';
  import RuntimeSection from './RuntimeSection.svelte';
  import type { NestedComponentRender,TableRenderBinding } from './component-render';
  let {state:inputState,width,padding,gap,scale=2}: {state:ExportRenderState;width:number;padding:string;gap:string;scale?:number}=$props();
  const state=$derived({...inputState,page:projectFieldSelections({...inputState.page,detailViews:undefined},inputState.filters)});
  const presentation=$derived(compilePresentation(state.page).evaluate({filters:state.filters,filterRevision:state.filterRevision,displaySnapshot:state.displaySnapshot}));
  setContext(PRESENTATION_CONTEXT,()=>presentation);
  setContext(CHART_OPTION_PATHS, () => chartOptionPaths(state.page));
  setContext(STATIC_EXPORT_CONTEXT,true);
  setContext(EXPORT_SCALE_CONTEXT,untrack(() => scale));
  function table(component:Component):TableRenderBinding|undefined {
    return component.type==='table'?{view:state.tables[component.id]??{pageIndex:0,sort:[],headerFilters:{}},filterOptions:{},paginationConfig:{mode:'none'},onpage:()=>{},onpagesize:()=>{},onsort:()=>{},onheaderfilter:()=>{},oncellselect:()=>{}}:undefined;
  }
  const nested:NestedComponentRender={map:c=>exportComponentMap(state,c),data:c=>exportComponentData(state,c),snapshot:c=>exportComponentSnapshot(state,c),table,onchartclick:()=>undefined,onmetriclink:()=>undefined,metricHref:()=>()=>undefined};
</script>
<div class="export-view" data-page-layout-form={state.page.layout ?? 'report'} data-export-view style:width={`${width}px`} style:padding={padding} style:gap={gap}>
  {#if state.page.iocHeader}
    <IocHeader model={resolvedIocHeader(state.page.iocHeader)} filterIds={state.page.iocHeader.filterIds??[]} controls={iocStaticControls} note={state.page.iocHeader.note} staticView/>
  {/if}
  {#snippet iocStaticControls(id:string,readOnly:boolean)}
    <FilterBar timeContext={{snapshot:state.displaySnapshot,revision:state.filterRevision}} declarations={(state.page.filters??[]).filter(f=>f.id===id)} values={state.filters} candidates={new Map()} {readOnly}
      ondimension={()=>{}} ontimerange={()=>{}} ontimepoint={()=>{}} onboolean={()=>{}} onnumberrange={()=>{}} onsearch={()=>{}}/>
  {/snippet}
  {#each state.page.filters??[] as filter}{#if filter.type==='timeRange' && filter.display==='period' && !state.page.iocHeader?.filterIds?.includes(filter.id)}{@const applied=state.filters.get(filter.id)}{#if applied?.type==='timeRange'}<p data-export-period>{filter.label??'统计期间'}：{applied.from} 至 {applied.to}</p>{/if}{/if}{/each}
  {#snippet componentContent(component:Component)}
    <div data-export-component={component.id}>
    <ComponentRenderer {component} data={exportComponentData(state,component)} snapshot={exportComponentSnapshot(state,component)}
      chartFilterValue={component => {
        if (!isChartComponent(component) || !component.props.filter) return undefined;
        const value = state.filters.get(component.props.filter.filterId);
        return value?.type === 'dimension' ? value.values[0] : undefined;
      }}
      pageSnapshots={state.snapshots} map={exportComponentMap(state,component)} exportMode={true} {nested} table={table(component)}
      summarySnapshot={component.type==='aiSummary'?state.summaries[component.id]:undefined}
      headerPeriod={header=>headerPeriod(header.props,state.page.filters??[],state.filters,state.page.schemaVersion)}/>
    </div>
  {/snippet}
  {#each presentation.sections as section (section.id)}
    <RuntimeSection {section} {componentContent}/>
  {/each}
</div>
<style>
  .export-view { display:flex; flex-direction:column; box-sizing:border-box; color:var(--mc-color-text,#191919); background:inherit; }
  [data-export-component] { display:contents; }
  .export-view :global(*) { box-sizing:border-box; animation:none!important; transition:none!important; }
</style>
