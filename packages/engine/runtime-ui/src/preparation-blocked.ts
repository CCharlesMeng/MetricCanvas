import {conditionSourceIds,flattenPageComponents,filterDependencies,nativeSourceFilterIds,type FilterDeclaration,type Page} from '@metriccanvas/page/internal';
import type {FilterValues,SourceProgram} from '@metriccanvas/data-execution/runtime';
import type {RetainedScreenData} from './retained-screen-data';

/** Broader display receipts are invalid as soon as a new scope starts waiting. */
export function discardPreparingData(page:Page,pending:readonly string[],values:FilterValues,program:SourceProgram|undefined,retained:RetainedScreenData):void {
  function waiting(sourceId:string):boolean {
    return !!program?.preparing(sourceId,values)||[...conditionSourceIds(page,sourceId)].some(id=>nativeSourceFilterIds(page,id).some(filter=>pending.includes(filter)));
  }
  for(const component of flattenPageComponents(page))if(Object.values(component.data??{}).some(waiting))retained.forget(component.id);
}

export function preparationBlocksPage(page:Page,pending:readonly string[]):boolean {
  return Object.keys(page.dataSources).some(id=>nativeSourceFilterIds(page,id).some(filter=>pending.includes(filter)));
}
export function preparationBlocksFilter(filter:FilterDeclaration,filters:readonly FilterDeclaration[],pending:readonly string[]):boolean {
  const queue=filterDependencies(filter),seen=new Set<string>();
  for(const id of queue){
    if(seen.has(id))continue;
    if(pending.includes(id))return true;
    seen.add(id);const parent=filters.find(item=>item.id===id);
    if(parent)queue.push(...filterDependencies(parent));
  }
  return false;
}
