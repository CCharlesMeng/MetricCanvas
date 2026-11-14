import {canonicalizeJson} from '@metriccanvas/page/internal';
import type {RuntimeDataGateway} from './ports';

const lifetimeMs=4*60*60*1000;
export interface FinalizationLookup {dates:ReadonlyMap<string,string>;cacheable:boolean}
interface Session {
  revision:number;
  cached?:{key:string;expiresAt:number;dates:ReadonlyMap<string,string>};
}
// The only result cache. Page-owned wrappers share the original gateway's session.
const sessions=new WeakMap<RuntimeDataGateway,Session>();
function session(gateway:RuntimeDataGateway):Session {
  let value=sessions.get(gateway);
  if(!value){value={revision:0};sessions.set(gateway,value);}
  return value;
}
export function inheritFinalizationCache(wrapper:RuntimeDataGateway,base:RuntimeDataGateway):void {
  sessions.set(wrapper,session(base));
}
export function invalidateFinalizationCache(gateway:RuntimeDataGateway):void {
  const value=session(gateway);value.revision++;delete value.cached;
}

/** Completed values only: simultaneous misses execute and cancel independently. */
export async function cachedFinalizations(gateway:RuntimeDataGateway,names:ReadonlySet<string>,load:()=>Promise<FinalizationLookup>,signal?:AbortSignal):Promise<ReadonlyMap<string,string>> {
  signal?.throwIfAborted();
  const scope=session(gateway),revision=scope.revision,key=canonicalizeJson(gateway.finalizationSource??null);
  const cached=scope.cached;
  if(cached&&cached.key===key&&cached.expiresAt>Date.now()&&[...names].every(name=>cached.dates.has(name)))return new Map(cached.dates);
  const result=await load();
  signal?.throwIfAborted();
  if(result.cacheable&&scope.revision===revision&&key===canonicalizeJson(gateway.finalizationSource??null)){
    scope.cached={key,expiresAt:Date.now()+lifetimeMs,dates:new Map(result.dates)};
  }
  return result.dates;
}
