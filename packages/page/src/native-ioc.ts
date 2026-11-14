import {queryLeaves} from './query-selection';
import {sourceFilterIds,conditionSourceIds} from './data-source-references';
import type {Page} from './page';
import type {FilterDeclaration} from './filter';
import {nativeIocFilters} from './native-preparation-capability';
export {NATIVE_IOC_SCHEMA_MINOR,supportsNativePreparation,nativeIocFilters,nativePreparationPaths} from './native-preparation-capability';

/** Establish dependencies before any receipt exists, without modifying the declaration. */
export function nativeIocBindingTargets(page:Page):Map<string,string[]> {
  const filters=nativeIocFilters(page),targets=new Map<string,string[]>();
  if(!filters.length)return targets;
  for(const [id,source]of Object.entries(page.dataSources)){
    if(source.source.type!=='query')continue;
    const leaves=queryLeaves(source.source.query);
    const ids=filters.filter(filter=>leaves.some(leaf=>leaf.filterBindings?.region&&!Object.hasOwn(leaf.filterBindings,filter.id))).map(filter=>filter.id);
    if(ids.length)targets.set(id,ids);
  }
  return targets;
}
export function nativeSourceFilterIds(page:Page,sourceId:string):string[] {
  return [...new Set([...sourceFilterIds(page.dataSources[sourceId]),...(nativeIocBindingTargets(page).get(sourceId)??[])])];
}
function nativeRuntimeFilter(filter:FilterDeclaration,page:Page,targets:Map<string,string[]>,ids:Set<string>):FilterDeclaration {
  if(filter.type==='boolean'&&ids.has(filter.id)&&filter.overridesFilters?.includes('region'))return {...filter,overridesFilters:filter.overridesFilters.filter(id=>id!=='region')};
  if(filter.type!=='dimension'||!filter.candidates)return filter;
  const dependencies=[...conditionSourceIds(page,filter.candidates.dataSource)].flatMap(id=>targets.get(id)??[]);
  if(!dependencies.length)return filter;
  return {...filter,candidateContext:{...filter.candidateContext,reconcile:filter.candidateContext?.reconcile??'clear',filterIds:[...new Set([...(filter.candidateContext?.filterIds??[]),...dependencies])]}};
}
/** Runtime-only candidate dependencies and Region intersection; authored declarations stay intact. */
export function nativeIocRuntimePage(page:Page):Page {
  const ids=new Set(nativeIocFilters(page).map(filter=>filter.id));
  if(!ids.size)return page;
  const targets=nativeIocBindingTargets(page);
  const filters=page.filters?.map(filter=>nativeRuntimeFilter(filter,page,targets,ids));
  return {...page,filters};
}
