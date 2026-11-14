import {iocHeaderDeclaration} from './header-binding';
import {finalizationName} from './finalization-default';
import type {Page} from './page';
import type {BooleanFilterDeclaration} from './filter';

export const NATIVE_IOC_SCHEMA_MINOR=120;
const filterIds=['key-office','key-national-only','key-rep-only'];

/** Native preparation is opt-in through the page version; older documents keep explicit bindings. */
export function supportsNativePreparation(page:Pick<Page,'schemaVersion'>):boolean {
  if(typeof page.schemaVersion!=='string')return false;
  const [major,minor]=page.schemaVersion.split('.').map(Number);
  return major===6&&(minor??-1)>=NATIVE_IOC_SCHEMA_MINOR;
}
export function nativeIocFilters(page:Page):BooleanFilterDeclaration[] {
  if(!supportsNativePreparation(page))return [];
  const header=iocHeaderDeclaration(page);
  if(!Array.isArray(page.filters)||!Array.isArray(header?.filterIds))return [];
  return page.filters.filter((filter):filter is BooleanFilterDeclaration=>filter?.type==='boolean'&&filterIds.includes(filter.id)&&header.filterIds!.includes(filter.id));
}
export function nativePreparationPaths(document:unknown):string[] {
  const page=document as Page;
  if(!page||!supportsNativePreparation(page)||!Array.isArray(page.filters))return [];
  const ids=new Set(nativeIocFilters(page).map(filter=>filter.id));
  return page.filters.flatMap((filter,index)=>filter&&(ids.has(filter.id)||finalizationName(filter))?[`/filters/${index}`]:[]);
}
