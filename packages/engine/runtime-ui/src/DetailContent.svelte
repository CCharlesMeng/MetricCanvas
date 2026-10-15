<script lang="ts">
  import {onDestroy,untrack} from 'svelte';
  import {detailExportData} from './table-export';
  import {downloadTableWorkbook} from './table-workbook';
  import {createTableController} from './table-controller';
  import {createExportController} from './export-controller';
  import type {Page} from '@metriccanvas/page';
  import {resolveDataSourceFields,type Component,type DataSnapshot,type TableComponent,type Row} from '@metriccanvas/page/internal';
  import type {PageDataSnapshots} from '../../runtime/src';
  import type {NamedDataSlots} from '../../widgets/src/shared/component-data';
  import type {TableRenderBinding} from './component-render';
  import {hostRenderSnapshot,renderableDataSnapshot} from './widget-host-state';
  import ComponentRenderer from './ComponentRenderer.svelte';
  import RuntimeSection from './RuntimeSection.svelte';

  let {page,components,snapshots}:{page:Page;components:Component[];snapshots:PageDataSnapshots}=$props();
  let revision=$state(0);
  let exports=$state<Record<string,{busy:boolean;error?:string}>>({});
  // Detail scope is complete/local; it shares the same state owner and pure rules.
  const controller=untrack(()=>createTableController(page,()=>null,()=>revision+=1));
  const exportController=createExportController(next=>exports=next);
  onDestroy(()=>{controller.dispose();exportController.reset();});
  function searchedRows(component:TableComponent,rows:Row[]){void revision;return controller.present(component,rows,true).rows;}
  async function exportTable(component:TableComponent){
    const frozen=JSON.parse(JSON.stringify(component)) as TableComponent;
    try{
      await exportController.run(component.id,async task=>{
        const data=detailExportData(page,frozen,snapshots);
        data.main!.snapshot.rows=structuredClone(searchedRows(component,data.main!.snapshot.rows));
        await downloadTableWorkbook(frozen,data,task.signal);
      });
    }catch{/* Export task feedback is projected by the common controller. */}
  }
  function slots(component:Component):Map<string,DataSnapshot>{return new Map(Object.entries(component.data??{}).map(([slot,id])=>[slot,snapshots.get(id)??{status:'loading'}]));}
  function data(component:Component):NamedDataSlots{
    void revision;const result:NamedDataSlots={};
    for(const [slot,id] of Object.entries(component.data??{})){
      const snapshot=snapshots.get(id);if(!snapshot)continue;
      let ready=renderableDataSnapshot(snapshot);if(!ready)continue;
      if(component.type==='table'&&slot==='main')ready={...ready,rows:controller.present(component,ready.rows,component.props.pagination?.mode!=='local').rows};
      result[slot]={snapshot:ready,fields:resolveDataSourceFields(page.dataSources[id])};
    }return result;
  }
  function table(component:Component):TableRenderBinding|undefined{
    if(component.type!=='table')return;void revision;
    const source=snapshots.get(component.data.main),pagination=component.props.pagination;
    return controller.binding(component,{filterOptions:{},paginationConfig:pagination,
      onexport:()=>{void exportTable(component);},oncancelexport:()=>exportController.cancel(component.id),
      exporting:exports[component.id]?.busy,exportError:exports[component.id]?.error,
      pagination:pagination?.mode==='local'?{pageSize:controller.view(component).pageSize,totalCount:source?.status==='ready'?searchedRows(component,source.rows).length:0}:undefined,
      oncellselect:()=>{}
    });
  }
</script>

<!-- Detail components use the same layout owner as main-page components,
     including declared span, chart drawing space and direct component boxes. -->
<div class="detail-layout">
  <RuntimeSection section={{ id: 'detail-view', container: 'plain', components }}>
    {#snippet componentContent(component: Component)}
      <ComponentRenderer {component} data={data(component)} snapshot={hostRenderSnapshot(component, slots(component))}
        pageSnapshots={snapshots} table={table(component)} />
    {/snippet}
  </RuntimeSection>
</div>

<style>
  .detail-layout {
    width: 100%;
    min-width: 0;
    flex: none;
    container: mc-runtime / inline-size;
  }
</style>
