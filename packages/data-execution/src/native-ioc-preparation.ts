import {conditionSourceIds,nativeIocBindingTargets,nativeIocRuntimePage,queryLeaves,selectQuery,type Page,type QueryDataSource,type EffectiveQuery} from '@metriccanvas/page/internal';
import type {FilterValues} from './filter-values';
import type {FilterCandidate,RuntimeDataGateway} from './ports';

type MembershipBinding={target:'boolean';queryField:string;whenTrue:string[]};
function unavailable():Error {return Object.assign(new Error('当前授权重点国代完整名单尚未就绪'),{code:'DQE_CONFIG_ERROR'});}
function validMember(candidate:FilterCandidate):boolean {
  return !!candidate&&typeof candidate.value==='string'&&candidate.value.length>0&&typeof candidate.label==='string'&&candidate.parent===undefined&&candidate.level===undefined&&(candidate.disabled===undefined||typeof candidate.disabled==='boolean');
}
function memberNames(candidates:FilterCandidate[]):string[] {
  if(!Array.isArray(candidates)||candidates.length>10000)throw unavailable();
  const seen=new Set<string>(),names:string[]=[];
  for(const candidate of candidates){
    if(!validMember(candidate)||seen.has(candidate.value))throw unavailable();
    seen.add(candidate.value);if(!candidate.disabled)names.push(candidate.value);
  }
  return names;
}
function executionCopy(page:Page,targets:Map<string,string[]>) {
  if(!targets.size)return {page,bindings:new Map<string,MembershipBinding[]>()};
  const dataSources={...page.dataSources},bindings=new Map<string,MembershipBinding[]>();
  for(const [sourceId,ids]of targets){
    const source=structuredClone(dataSources[sourceId]) as QueryDataSource;
    dataSources[sourceId]=source;
    for(const leaf of queryLeaves(source.source.query))for(const id of ids){
      if(!leaf.filterBindings?.region||Object.hasOwn(leaf.filterBindings,id))continue;
      const binding:MembershipBinding={target:'boolean',queryField:'代表处',whenTrue:[]};
      leaf.filterBindings[id]=binding;
      bindings.set(id,[...(bindings.get(id)??[]),binding]);
    }
  }
  return {page:{...page,dataSources},bindings};
}
function waitFor<T>(promise:Promise<T>,signal:AbortSignal):Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}

/** One private execution copy per SourceProgram; pending bindings never escape through snapshots. */
export function createNativeIocPreparation(input:Page,gateway:RuntimeDataGateway) {
  input=nativeIocRuntimePage(input);
  const targets=nativeIocBindingTargets(input),copy=executionCopy(input,targets);
  const ready=new Set<string>(),pending=new Map<string,Promise<void>>(),failures=new Map<string,unknown>(),controller=new AbortController();
  function activeTargets(sourceId:string,values:FilterValues):string[] {
    const ids=targets.get(sourceId)??[],source=copy.page.dataSources[sourceId];
    if(source?.source.type!=='query')return [];
    try {
      const query=selectQuery(source.source.query,values);
      return ids.filter(id=>copy.bindings.get(id)?.includes(query.filterBindings?.[id] as MembershipBinding));
    }catch{return ids;}
  }
  function selected(sourceId:string,values:FilterValues):string[] {
    const ids=new Set([...conditionSourceIds(input,sourceId)].flatMap(id=>activeTargets(id,values)));
    return [...ids].filter(id=>{const value=values.get(id);return value?.type==='boolean'&&value.value;});
  }
  async function fetchMembership(id:string):Promise<void> {
    if(!gateway.fetchFilterCandidates)throw unavailable();
    const result=await gateway.fetchFilterCandidates({filterId:id,dimension:'rep-office-name',constraints:{dimensions:{},times:{},booleans:{[id]:true}}},{signal:controller.signal});
    controller.signal.throwIfAborted();
    if(result.kind!=='values')throw unavailable();
    const names=memberNames(result.candidates);
    for(const binding of copy.bindings.get(id)??[])binding.whenTrue=[...names];
    ready.add(id);
  }
  function load(id:string):Promise<void> {
    if(ready.has(id))return Promise.resolve();
    if(failures.has(id))return Promise.reject(failures.get(id));
    const existing=pending.get(id);if(existing)return existing;
    const request=fetchMembership(id).catch(cause=>{failures.set(id,cause);throw cause;}).finally(()=>pending.delete(id));pending.set(id,request);return request;
  }
  async function ensureSelected(ids:string[],signal:AbortSignal):Promise<void> {
    const bounded=AbortSignal.any([signal,controller.signal]);
    await Promise.all(ids.map(id=>waitFor(load(id),bounded)));bounded.throwIfAborted();
  }
  return {
    page:copy.page,
    active:(sourceId:string,values:FilterValues)=>selected(sourceId,values).length>0,
    waiting:(sourceId:string,values:FilterValues)=>selected(sourceId,values).some(id=>!ready.has(id)),
    captured:(sourceId:string,values:FilterValues,query:EffectiveQuery|undefined)=>selected(sourceId,values).length?undefined:query,
    retry(sourceId:string,values:FilterValues){for(const id of selected(sourceId,values))failures.delete(id);},
    ensure(sourceId:string,values:FilterValues,signal:AbortSignal){
      const ids=selected(sourceId,values);
      if(ids.length)return ensureSelected(ids,signal);
    },
    dispose(){controller.abort();pending.clear();ready.clear();failures.clear();}
  };
}
