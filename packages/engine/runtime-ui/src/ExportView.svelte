<svelte:options css="injected" />
<script lang="ts">
  import {REGION_MAP_CONTEXT,type RegionMapContext} from './region-map';
  import {compilePresentation} from '../../runtime/src/presentation';
  import {PRESENTATION_CONTEXT} from './presentation-context';
  import { chartOptionPaths } from '@metriccanvas/page/internal';
  import { CHART_OPTION_PATHS } from '../../widgets/src/shared/chart-option-extension';
  import {SOURCE_FILTER_CONTEXT,sourceFilterSelection,type SourceFilterReader} from './dashboard/source-filter-context';
  import FilterBar from './filters/FilterBar.svelte';
  import { compatibilityHeaderSection } from './ioc-header/render-plan';
  import { iocHeaderDeclaration } from '@metriccanvas/page/internal';
  import { resolvedIocHeader } from './ioc-header/model';
  import { placeHeaderFilterRows, selectHeaderFilters } from './ioc-header/filter-groups';
  import { visibleFilterDeclarations } from './filters/filter-bar';
  import { setContext, untrack } from 'svelte';
  import { projectFieldSelections, type Component } from '@metriccanvas/page/internal';
  import { EXPORT_SCALE_CONTEXT, STATIC_EXPORT_CONTEXT } from '../../widgets/src/shared/export-context';
  import { headerPeriod } from './report-date-header';
  import { exportComponentData,exportComponentSnapshot,exportComponentMap,type ExportRenderState } from './export-render-state';
  import ComponentRenderer from './ComponentRenderer.svelte';
  import RuntimeSection from './RuntimeSection.svelte';
  import type { NestedComponentRender,TableRenderBinding } from './component-render';
  let {state:inputState,width,padding,gap,scale=2}: {state:ExportRenderState;width:number;padding:string;gap:string;scale?:number}=$props();
  const state=$derived({...inputState,page:projectFieldSelections({...inputState.page,detailViews:undefined},inputState.filters)});
  const presentation=$derived(compilePresentation(state.page).evaluate({filters:state.filters,filterRevision:state.filterRevision,displaySnapshot:state.displaySnapshot}));
  const frozenMap = $derived({geography:state.geography,displayNames:state.displayNames});
  setContext<RegionMapContext>(REGION_MAP_CONTEXT, {
    adapter:()=>frozenMap, overrides:()=>state.page.mapOverrides, selection:()=>state.regionSelection,
    frozenViewport:key=>state.viewports?.get(key)
  });
  setContext(PRESENTATION_CONTEXT,()=>presentation);
  setContext<SourceFilterReader>(SOURCE_FILTER_CONTEXT,id=>{
    const declaration=state.page.filters?.find(filter=>filter.id===id);
    if(declaration?.type!=='dimension'||!declaration.candidates)return;
    return {declaration,...sourceFilterSelection(state.filters,id),candidates:state.sourceCandidates?.get(id)??{status:'unavailable'},onchange:()=>{},onretry:()=>{}};
  });
  setContext(CHART_OPTION_PATHS, () => chartOptionPaths(state.page));
  setContext(STATIC_EXPORT_CONTEXT,true);
  setContext(EXPORT_SCALE_CONTEXT,untrack(() => scale));
  function table(component:Component):TableRenderBinding|undefined {
    return component.type==='table'?{view:state.tables[component.id]??{pageIndex:0,sort:[],headerFilters:{}},filterOptions:{},paginationConfig:{mode:'none'},onpage:()=>{},onpagesize:()=>{},onsort:()=>{},onheaderfilter:()=>{},oncellselect:()=>{}}:undefined;
  }
  const legacyHeader=$derived(compatibilityHeaderSection(state.page,true));
  const header=$derived(iocHeaderDeclaration(state.page));
  const headerPlacement = $derived(header?.filterRows ? placeHeaderFilterRows(
    visibleFilterDeclarations(selectHeaderFilters(presentation.filters, header.filterIds)),
    header.filterRows
  ) : undefined);
  const nested:NestedComponentRender={summarySnapshot:c=>state.summaries[c.id],map:c=>exportComponentMap(state,c),data:c=>exportComponentData(state,c),snapshot:c=>exportComponentSnapshot(state,c),table,onchartclick:()=>undefined,onmetriclink:()=>undefined,metricHref:()=>()=>undefined};
</script>
<div class="export-view" data-page-layout-form={state.page.layout ?? 'report'} data-export-view style:width={`${width}px`} style:padding={padding}>
  {#snippet iocStaticControls(id:string,readOnly:boolean)}
    <FilterBar iocHeader timeContext={{snapshot:state.displaySnapshot,revision:state.filterRevision}} declarations={(state.page.filters??[]).filter(f=>f.id===id)} values={state.filters} candidates={new Map()} {readOnly}
      ondimension={()=>{}} ontimerange={()=>{}} ontimepoint={()=>{}} onboolean={()=>{}} onnumberrange={()=>{}} onsearch={()=>{}}/>
  {/snippet}
  {#snippet componentContent(component:Component)}
    <div data-export-component={component.id}>
    <ComponentRenderer {component}
      iocHeader={header?{model:resolvedIocHeader(header),filterIds:headerPlacement?.primary.map(filter=>filter.id)??header.filterIds??[],filterRows:headerPlacement?.filterRows,controls:iocStaticControls,note:header.note,readOnly:true}:undefined} data={exportComponentData(state,component)} snapshot={exportComponentSnapshot(state,component)}
      filterGroupValue={component => {
        if (component.type !== 'filterGroup') return undefined;
        const value = state.filters.get(component.props.filterId);
        return value?.type === 'dimension' ? value.values[0] : undefined;
      }}
      pageSnapshots={state.snapshots} map={exportComponentMap(state,component)} exportMode={true} {nested} table={table(component)}
      summarySnapshot={component.type==='aiSummary'?state.summaries[component.id]:undefined}
      headerPeriod={header=>headerPeriod(header.props,state.page.filters??[],state.filters,state.page.schemaVersion)}/>
    </div>
  {/snippet}
  {#if legacyHeader}<RuntimeSection section={legacyHeader} {componentContent}/>{/if}
  <div class="export-content" style:gap={gap}>
  {#each state.page.filters??[] as filter}{#if filter.type==='timeRange' && filter.display==='period' && !header?.filterIds?.includes(filter.id)}{@const applied=state.filters.get(filter.id)}{#if applied?.type==='timeRange'}<p data-export-period>{filter.label??'统计期间'}：{applied.from} 至 {applied.to}</p>{/if}{/if}{/each}
  {#each presentation.sections as section (section.id)}
    <RuntimeSection {section} {componentContent}/>
  {/each}
  </div>
</div>
<style>
  .export-view { display:flex; flex-direction:column; box-sizing:border-box; color:var(--mc-color-text,#191919); background:inherit; }
  .export-content { display:flex; flex-direction:column; min-width:0; }
  [data-export-component] { display:contents; }
  .export-view :global(*) { box-sizing:border-box; animation:none!important; transition:none!important; }
</style>
