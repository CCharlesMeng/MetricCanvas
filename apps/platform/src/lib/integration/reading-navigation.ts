import {projectNavigationInputs} from '@metriccanvas/engine';
import type {RuntimeNavigation} from '@metriccanvas/engine/ui';
import {platformPath} from './routes';
import type {PlatformServices} from './services';
/** Page reading passes explicit URL inputs only; no view-state storage or restoration. */
export function createReadingRuntimeNavigation(services:Pick<PlatformServices,'navigation'|'pageAssets'>):RuntimeNavigation {
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
 return {
  resolveHref,
  async resolveTargetInputs(href,{signal}){
   const found=target(href);if(!found)return;
   const ref=await pageAssets.resolve(found.pageId,signal),revision=await pageAssets.read(ref,signal);
   if(signal.aborted||revision.pageId!==found.pageId)return;
   const projection=projectNavigationInputs(revision.document);
   return projection.pageId===found.pageId?projection:undefined;
  },
  navigate({href}){if(!target(href))return false;void navigation.navigate(resolveHref(href));return true;},
  replaceSearch(search){const next=new URLSearchParams(search),resource=navigation.current().searchParams.get('resource');if(resource)next.set('resource',resource);navigation.replaceSearch(next.toString());}
 };
}
