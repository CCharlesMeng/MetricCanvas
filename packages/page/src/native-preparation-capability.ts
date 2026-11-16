import {iocHeaderDeclaration} from './header-binding';
import {finalizationName} from './finalization-default';
import {IOC_KEY_OFFICE_FILTER_IDS} from './filter-overrides';
import type {Page} from './page';
import type {BooleanFilterDeclaration} from './filter';

export const NATIVE_IOC_SCHEMA_MINOR=120;

/** Finalization and authoring version boundaries remain tied to 6.120. */
export function supportsNativePreparation(page:Pick<Page,'schemaVersion'>):boolean {
  if(typeof page.schemaVersion!=='string')return false;
  const [major,minor]=page.schemaVersion.split('.').map(Number);
  return major===6&&(minor??-1)>=NATIVE_IOC_SCHEMA_MINOR;
}
export function nativeIocFilters(page:Page,hasMembershipCandidates:boolean):BooleanFilterDeclaration[] {
  if(!hasMembershipCandidates&&!supportsNativePreparation(page))return [];
  const header=iocHeaderDeclaration(page);
  if(!Array.isArray(page.filters)||!Array.isArray(header?.filterIds))return [];
  return page.filters.filter((filter):filter is BooleanFilterDeclaration=>filter?.type==='boolean'&&IOC_KEY_OFFICE_FILTER_IDS.includes(filter.id)&&header.filterIds!.includes(filter.id));
}
export function nativePreparationPaths(document:unknown):string[] {
  const page=document as Page;
  if(!page||!supportsNativePreparation(page)||!Array.isArray(page.filters))return [];
  const ids=new Set(nativeIocFilters(page,false).map(filter=>filter.id));
  return page.filters.flatMap((filter,index)=>filter&&(ids.has(filter.id)||finalizationName(filter))?[`/filters/${index}`]:[]);
}
