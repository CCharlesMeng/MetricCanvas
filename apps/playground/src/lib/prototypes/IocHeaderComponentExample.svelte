<script lang="ts">
  import { mount,unmount } from 'svelte';
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import { RuntimeSurface } from '@metriccanvas/engine/ui/composition';
  import RuntimeSection from '../../../../../packages/engine/runtime-ui/src/RuntimeSection.svelte';
  import ExportView from '../../../../../packages/engine/runtime-ui/src/ExportView.svelte';
  import { parsePage } from '@metriccanvas/page';
  import { dataGateway } from '../services';
  import placement from '../../../../../pages/capabilities/ioc-header/section-component/ioc-header-section-placement.json';
  import sticky from '../../../../../pages/capabilities/ioc-header/section-component/ioc-header-section-sticky.json';
  import grouped from '../../../../../pages/capabilities/ioc-header/section-component/ioc-header-section-groups.json';
  import type { ExportRenderState } from '../../../../../packages/engine/runtime-ui/src/export-render-state';
  let mode=$state('custom'),backs=$state(0);
  function documentFor(mode:string):any {
    const document=structuredClone(mode==='export-groups'?grouped:mode==='custom'?placement:sticky) as any;
    if(mode.includes('legacy')) {
      document.schemaVersion='6.80';
      const header=document.sections[0].components.shift();
      if(mode.includes('toolbar'))document.dashboardToolbar={variant:'compact'};
      else document.iocHeader=header.props;
    }
    if(mode==='no-header')document.sections[0].components.shift();
    return document;
  }
  const document=$derived(documentFor(mode));
  const navigation={returnContext:{entryId:'component-acceptance',label:'返回验收入口'},back:()=>{backs++;}};
  function shadowRuntime(node:HTMLElement) {
    const shadow=node.attachShadow({mode:'open'});
    const instance=mount(RuntimeView,{target:shadow,props:{document,dataGateway,navigation}});
    return {destroy:()=>{void unmount(instance);}};
  }
  function exportState(document:unknown,hidden:boolean):ExportRenderState {
    const parsed=parsePage(document);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
    return {page:parsed.page,currentYear:2026,filters:new Map([
      ['team',{type:'dimension',dimension:'team',values:['B']}],['show-header',{type:'boolean',value:!hidden}]
    ]),snapshots:new Map(),tables:{},headerFilters:{},summaries:{}};
  }
</script>
<label>验收模式<select bind:value={mode}>
  <option value="custom">定制分区布局</option><option value="nested">嵌套滚动</option>
  <option value="shadow">ShadowRoot</option><option value="mount-scroll">公共页头与 Mount 滚动区域</option><option value="legacy-root">旧根级</option>
  <option value="legacy-toolbar">旧工具栏</option><option value="no-header">新页无页头</option>
  <option value="export">静态导出</option><option value="export-hidden">条件隐藏导出</option>
  <option value="export-groups">分组导出</option><option value="export-legacy-root">旧根级导出</option>
  <option value="export-legacy-toolbar">旧工具栏导出</option>
</select></label>
<output>返回次数：{backs}</output>
{#key mode}
  {#if mode==='shadow'}
    <div use:shadowRuntime data-shadow-host></div>
  {:else if mode==='mount-scroll'}
    <div class="mount-shell">
      <header data-public-header>集成应用公共页头</header>
      <div class="nested" data-mount-scroll><div use:shadowRuntime></div></div>
    </div>
  {:else if mode.startsWith('export')}
    <ExportView state={exportState(document,mode==='export-hidden')} width={1000} padding="0px" gap="16px"/>
  {:else if mode==='custom'||mode.startsWith('legacy')}
    <RuntimeSurface {document} {dataGateway} {navigation}>
      {#snippet sectionsContent(sections,componentContent)}
        <div data-custom-section-ids={sections.map(section=>section.id).join(',')}>
          {#each sections as section (section.id)}<RuntimeSection {section} {componentContent}/>{/each}
        </div>
      {/snippet}
    </RuntimeSurface>
  {:else}
    <div data-nested-scroll class:nested={mode==='nested'}><RuntimeView {document} {dataGateway} {navigation}/></div>
  {/if}
{/key}
<style>
  label{display:inline-flex;gap:8px;padding:12px;}output{margin:12px;}
  .nested{height:440px;overflow:auto;border:1px solid #ddd;margin:20px;}
  .mount-shell{margin:20px;border:1px solid #ddd;}
  .mount-shell>header{height:88px;display:flex;align-items:center;padding:0 20px;background:#fff;}
  .mount-shell>.nested{margin:0;}
</style>
