import type {RuntimeNavigation} from '@metriccanvas/engine/ui';
import {projectNavigationInputs} from '@metriccanvas/engine';
import {createBrowserDrillReturn,preserveNavigationEntry} from '@metriccanvas/engine/ui/navigation';
import {platformPath} from './routes';
import type {PlatformServices} from './services';
/** Page reading passes explicit URL inputs only; no view-state storage or restoration. */
export function createReadingRuntimeNavigation(services:Pick<PlatformServices,'navigation'|'pageAssets'>,trackReturn:()=>void=()=>{}):RuntimeNavigation & {subscribeReturn(listener:()=>void):()=>void} {
 const {navigation,pageAssets}=services;
 function target(href:string){
  const url=new URL(href,navigation.current());
  if(url.origin!==navigation.current().origin)return;
  const canonical=/^\/pages\/([^/]+)$/.exec(url.pathname);
  const prefix=platformPath(navigation.base,'/manage/pages/');
  const id=canonical?.[1]??(url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):undefined);
  if(!id||id.includes('/'))return;
  const pageId=decodeURIComponent(id);if(!pageId.trim())return;
  return {url,pageId};
 }
 function resolveHref(href:string){const found=target(href);if(!found)return href;const {url,pageId}=found;url.pathname=platformPath(navigation.base,'/manage/pages/[pageId]',{pageId});return url.href;}
 const returns=createBrowserDrillReturn(url=>target(url.href)?.pageId);
 return {
  subscribeReturn:returns.subscribe,
  get returnContext(){trackReturn();const context=returns.current();return context?{entryId:context.entryId,label:'返回来源页',back:()=>void returns.back(href=>navigation.navigate(href)).catch(error=>console.warn('[MetricCanvas][NAVIGATION_ERROR]',error))}:undefined;},
  preserveSearchParams:['resource'],
  resolveHref,
  async resolveTargetInputs(href,{signal}){
   const found=target(href);if(!found)return;
   const ref=await pageAssets.resolve(found.pageId,signal),revision=await pageAssets.read(ref,signal);
   if(signal.aborted||revision.pageId!==found.pageId)return;
   const projection=projectNavigationInputs(revision.document);
   return projection.pageId===found.pageId?projection:undefined;
  },
  navigate({href,sourcePageId}){if(!target(href))return false;void returns.navigate(resolveHref(href),sourcePageId,value=>navigation.navigate(value)).catch(error=>console.warn('[MetricCanvas][NAVIGATION_ERROR]',error));return true;},
  replaceSearch(search){const next=new URLSearchParams(search),resource=navigation.current().searchParams.get('resource');if(resource)next.set('resource',resource);preserveNavigationEntry(()=>navigation.replaceSearch(next.toString()));}
 };
}
