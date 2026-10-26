import { compilePresentation, projectPresentationRows } from '../../runtime/src/presentation';
import type { DisplaySnapshot } from '../../runtime/src/display-inputs';
import type { Page, Component, DataSnapshot, Row } from '@metriccanvas/page/internal';
import { resolveDataSourceFields } from '@metriccanvas/page/internal';
import type { PageDataSnapshots, FilterValues } from '../../runtime/src';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import type { TableViewState, TableHeaderFilterValue } from '../../widgets/src/components/table/view-state';
import { applyTableSearch } from './table-search';
import { applySearchFilters } from './filters/inline-search';
import { filterMapRows, isHierarchyDeclaration, resolveMapBasemap } from './map-hierarchy';
import { sortTableRows, filterTableRowsByHeaders } from './table-state';
import { renderableDataSnapshot, hostRenderSnapshot } from './widget-host-state';
import type { AiSummarySnapshot } from './ai-summary';

export const SUMMARY_EXPORT_CAPTURE = Symbol('metriccanvas.summaryCapture');
export type SummaryCapture = Map<string, () => AiSummarySnapshot>;
export interface ExportRenderState {
  page: Page;
  currentYear:number;now?:Date;
  filters: FilterValues;
  filterRevision?:number;
  displaySnapshot?:DisplaySnapshot;
  snapshots: PageDataSnapshots;
  tables: Record<string, TableViewState>;
  headerFilters: Record<string, import('@metriccanvas/page/internal').TableHeaderFilters>;
  sourceViews?: ReadonlyMap<string, import('@metriccanvas/page/internal').TableQueryView>;
  summaries: Record<string, AiSummarySnapshot>;
}
export function exportComponentSlots(state: ExportRenderState, component: Component): Map<string, DataSnapshot> {
  return new Map(Object.entries(component.data ?? {}).map(([slot,id])=>[slot,state.snapshots.get(id)??{status:'loading'}]));
}
export function exportComponentSnapshot(state: ExportRenderState, component: Component): DataSnapshot {
  const slots=exportComponentSlots(state,component);
  // A failed comparison slot must not erase the successfully downloaded main data.
  const available=new Map([...slots].map(([slot,snapshot])=>[slot,snapshot.status==='error'?{status:'empty' as const}:snapshot]));
  if([...slots.values()].some(snapshot=>snapshot.status==='ready'||snapshot.status==='empty'))return hostRenderSnapshot(component,available);
  return hostRenderSnapshot(component,slots);
}
export function exportComponentData(state:ExportRenderState,component:Component): NamedDataSlots {
  const data:NamedDataSlots={};
  for(const [slot,id] of Object.entries(component.data??{})) {
    const source=state.page.dataSources[id];
    const snapshot=state.snapshots.get(id);
    if(!source||!snapshot) continue;
    const fields=resolveDataSourceFields(source);
    const ready=renderableDataSnapshot(snapshot); if(!ready)continue;
    let rows:Row[]=component.type==='table'&&slot==='main'?projectPresentationRows(component,ready.rows,{declarations:state.page.filters??[],filters:state.filters,filterRevision:state.filterRevision,displaySnapshot:state.displaySnapshot}):ready.rows;
    if(component.type==='table'&&slot==='main'&&(source.source.type==='inline'||(source.source.type==='query'&&source.source.resultScope==='complete'))) {
      rows=applyTableSearch(rows,component,state.tables[component.id]?.searchQuery,state.tables[component.id]?.search);
    }
    if(component.type==='table'&&slot==='main'&&component.props.pagination?.mode!=='query') {
      rows=filterTableRowsByHeaders(applySearchFilters(rows,state.filters,fields),state.headerFilters[component.id]??{});
      rows=sortTableRows(rows,state.tables[component.id]?.sort??[]);
    }
    if(component.type==='mapChart'&&slot==='main'&&component.props.hierarchyFilter) {
      const declaration=state.page.filters?.find(f=>f.id===component.props.hierarchyFilter);
      if(isHierarchyDeclaration(declaration))rows=filterMapRows(rows,component.props,declaration,state.filters.get(declaration.id));
    }
    data[slot]={fields,sourceStatus:snapshot.status,snapshot:{status:'ready',rows}};
  }
  return data;
}

export function exportComponentMap(state:ExportRenderState,component:Component):'china'|'world'|undefined {
  if(component.type!=='mapChart')return;
  const declaration=state.page.filters?.find(f=>f.id===component.props.hierarchyFilter);
  return resolveMapBasemap(component.props,isHierarchyDeclaration(declaration)?declaration:undefined,state.filters.get(declaration?.id??''));
}
