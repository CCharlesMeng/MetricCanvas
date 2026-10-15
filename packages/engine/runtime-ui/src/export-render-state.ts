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
import type { AiSummarySnapshot } from './ai-summary/session';

export const SUMMARY_EXPORT_CAPTURE = Symbol('metriccanvas.summaryCapture');
export type SummaryCapture = Map<string, () => AiSummarySnapshot>;
export interface ExportRenderState {
  page: Page;
  currentYear:number;
  filters: FilterValues;
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
  return hostRenderSnapshot(component,exportComponentSlots(state,component));
}
export function exportComponentData(state:ExportRenderState,component:Component): NamedDataSlots {
  const data:NamedDataSlots={};
  for(const [slot,id] of Object.entries(component.data??{})) {
    const source=state.page.dataSources[id];
    const snapshot=state.snapshots.get(id);
    if(!source||!snapshot) continue;
    const fields=resolveDataSourceFields(source);
    const ready=renderableDataSnapshot(snapshot); if(!ready)continue;
    let rows:Row[]=ready.rows;
    if(component.type==='table'&&slot==='main'&&source.source.type!=='pagedJoin') {
      rows=applyTableSearch(rows,component,state.tables[component.id]?.searchQuery);
    }
    if(component.type==='table'&&slot==='main'&&component.props.pagination?.mode!=='query') {
      rows=filterTableRowsByHeaders(applySearchFilters(rows,state.filters,fields),state.headerFilters[component.id]??{});
      rows=sortTableRows(rows,state.tables[component.id]?.sort??[]);
    }
    if(component.type==='mapChart'&&slot==='main'&&component.props.hierarchyFilter) {
      const declaration=state.page.filters?.find(f=>f.id===component.props.hierarchyFilter);
      if(isHierarchyDeclaration(declaration))rows=filterMapRows(rows,component.props,declaration,state.filters.get(declaration.id));
    }
    data[slot]={fields,snapshot:{status:'ready',rows}};
  }
  return data;
}

export function exportComponentMap(state:ExportRenderState,component:Component):'china'|'world'|undefined {
  if(component.type!=='mapChart')return;
  const declaration=state.page.filters?.find(f=>f.id===component.props.hierarchyFilter);
  return resolveMapBasemap(component.props,isHierarchyDeclaration(declaration)?declaration:undefined,state.filters.get(declaration?.id??''));
}
