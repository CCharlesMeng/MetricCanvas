import {requiresTimeValidation,timeAvailabilityIssue,timeFilterBoundaryError,type DisplayInputsSnapshot} from '@metriccanvas/page/internal';
import { queryFilterIds,numberRangeIssue,rangeContextIssue,filterGroupOptions, candidateDependencies, filterDependencies, dimensionSelectionIssue, conditionSourceIds, canonicalizeJson, type Page, type FilterDeclaration } from '@metriccanvas/page/internal';
import type {RuntimeDataGateway,FilterCandidate} from './ports';
import type {FilterValue,FilterValues} from './filter-values';
import {candidateContextKey,filterCandidatesRequest,validFilterCandidates} from './filter-candidates';
import {overriddenFilterIds,isUnrestrictedIocRegion,iocHeaderDeclaration} from '@metriccanvas/page/internal';

/** Execution consumers share this fail-closed boundary, including seeded/initial receipts. */
export function createCandidateValidator(page:Page,gateway:RuntimeDataGateway,context:{displayInputs?:()=>DisplayInputsSnapshot|undefined;filterRevision?:()=>number;now?:Date}={}) {
  const localOptions=filterGroupOptions(page);
  const declarations=page.filters??[],byId=new Map(declarations.map(filter=>[filter.id,filter]));
  function filterIds(sourceId:string,values?:FilterValues):string[] {
    const ids=new Set<string>();
    for(const source of conditionSourceIds(page,sourceId)){const definition=page.dataSources[source];if(definition?.source.type==='query')for(const id of queryFilterIds(definition.source.query,values))ids.add(id);}
    const queue=[...ids];for(const id of queue){const filter=byId.get(id);if(filter)for(const parent of filterDependencies(filter))if(!ids.has(parent)){ids.add(parent);queue.push(parent);}}
    const overridden=overriddenFilterIds(declarations,values??new Map());
    return [...ids].filter(id=>!overridden.has(id));
  }
  function dynamic(filter:FilterDeclaration):boolean {return filter.type==='dimension'&&!filter.options&&!localOptions.has(filter.id);}
  function key(filter:Extract<FilterDeclaration,{type:'dimension'}>,values:FilterValues) {
    const selected=values.get(filter.id);const level=selected?.type==='dimension'?selected.level:filter.defaultLevel??filter.hierarchy?.[0]?.id;
    const frozen={page,displayInputs:context.displayInputs?.(),filterRevision:context.filterRevision?.(),now:context.now??new Date()};
    const request=filterCandidatesRequest(filter,declarations,values,level,frozen);
    return {request,key:canonicalizeJson([request,candidateContextKey(filter,declarations,values,frozen)])};
  }
  function selection(filter:FilterDeclaration,values:FilterValues):boolean {
    if(filter.type==='timeRange'||filter.type==='timePoint'){const value=values.get(filter.id);return (!value?!filter.required:value.type===filter.type)&&!timeAvailabilityIssue(filter,value,context.displayInputs?.(),context.filterRevision?.())&&!(value&&(value.type==='timeRange'||value.type==='timePoint')&&timeFilterBoundaryError(filter,value,context.now))&&!(filter.type==='timeRange'&&filter.display==='modes'&&value?.type!=='timeRange');}
    if(filter.type==='numberRange'){const value=values.get(filter.id);return (!value||value.type==='numberRange')&&!(value?.type==='numberRange'&&numberRangeIssue(filter,value))&&!rangeContextIssue(filter,values);}
    if(filter.type!=='dimension')return true;
    const value=values.get(filter.id),local=localOptions.get(filter.id);
    if(local)return value?.type==='dimension'&&value.values.length===1&&local.includes(value.values[0]!);
    return !dimensionSelectionIssue(filter,value?.type==='dimension'?value.values:[]);
  }
  function allowed(filter:Extract<FilterDeclaration,{type:'dimension'}>,values:FilterValues,candidates:readonly FilterCandidate[]):boolean {
    const selected=values.get(filter.id);
    const effective=candidates.filter(item=>!item.disabled&&(filter.treeSelection!=='level'||item.level===(selected?.type==='dimension'?selected.level:filter.defaultLevel??filter.hierarchy?.[0]?.id)));
    return effective.length>0 && (selected?.type!=='dimension'||selected.values.every(value=>effective.some(item=>item.value===value)));
  }
  function trusted(sourceId:string,values:FilterValues):boolean {
    return filterIds(sourceId,values).every(id=>{
      const filter=byId.get(id);
      if(!filter||!selection(filter,values))return false;
      const selected=values.get(filter.id);
      // Optional empty choices need no candidate receipt; explicit contexts still do.
      const receipt=filter.type==='dimension'&&needsCandidateReceipt(filter,selected);
      return !dynamic(filter)||!requires(sourceId)||!receipt;
    });
  }
  async function verify(sourceId:string,values:FilterValues,signal:AbortSignal,extraIds:readonly string[] = []) {
    const overridden=overriddenFilterIds(declarations,values);
    const done=new Set<string>();
    const cache=new Map<string,readonly FilterCandidate[]>();
    function alreadyVerified(id:string):boolean {return done.has(id)||overridden.has(id);}
    async function requestCandidates(dimension:Extract<FilterDeclaration,{type:'dimension'}>,request:import('./ports').FilterCandidatesRequest):Promise<readonly FilterCandidate[]> {
      if(dimension.candidates||dimension.candidateContext||dimension.treeSelection==='level'||dimension.candidateWindow){
        if(!gateway.fetchFilterCandidates)reject();
        const result=await gateway.fetchFilterCandidates!(request,{signal});signal.throwIfAborted();
        if(result.kind!=='values'||!Array.isArray(result.candidates)||!validFilterCandidates(result.candidates,dimension.treeSelection==='level'?dimension.hierarchy?.map(item=>item.id):undefined))reject();
        return result.kind==='values'?result.candidates:[];
      }
      if(!gateway.fetchDimensionValues)reject();
      const result=await gateway.fetchDimensionValues!(request.dimension,{signal,constraints:legacyConstraints(page,dimension,values,overridden)});signal.throwIfAborted();
      if(result.kind!=='values')reject();
      const candidates=[...new Map(result.candidates.map(item=>[item.value,item])).values()];
      if(!validFilterCandidates(candidates))reject();
      return candidates;
    }
    async function verifyFilter(id:string):Promise<void> {
      if(alreadyVerified(id))return;done.add(id);signal.throwIfAborted();
      const filter=byId.get(id);if(!filter||!selection(filter,values))reject();
      for(const parent of candidateDependencies(filter!))await verifyFilter(parent);
      if(!filter||filter.type!=='dimension'||!dynamic(filter))return;
      const selected=values.get(id);
      if(!needsCandidateReceipt(filter,selected))return;
      const dimension=filter;
      const identity=key(dimension,values);let candidates=cache.get(identity.key);
      if(!candidates){
        candidates=await requestCandidates(dimension,identity.request);
        validateGlobalRegionNames(page,dimension,candidates);
        cache.set(identity.key,candidates);
      }
      if(!allowed(dimension,values,candidates))reject();
    }
    for(const id of new Set([...filterIds(sourceId,values),...extraIds]))await verifyFilter(id);
  }
  const requires=(sourceId:string)=>filterIds(sourceId).some(id=>{const filter=byId.get(id);return localOptions.has(id)||(filter?.type==='dimension'&&!!(filter.selection||filter.options||filter.candidates||filter.candidateContext||filter.treeSelection||filter.candidateWindow))||(filter&&requiresTimeValidation(filter))||(filter?.type==='numberRange'&&!!(filter.constraints||filter.units||filter.presets));});
  return {trusted,verify,requires};
}
function legacyConstraints(page:Page,filter:Extract<FilterDeclaration,{type:'dimension'}>,values:FilterValues,overridden:ReadonlySet<string>):Record<string,string[]> {
  const parent=filter.dependsOn&&!overridden.has(filter.dependsOn)&&!isUnrestrictedIocRegion(page,filter.dependsOn,values.get(filter.dependsOn))?values.get(filter.dependsOn):undefined;
  return parent?.type==='dimension'&&parent.values.length?{[parent.dimension]:parent.values}:{};
}
function reject():never {throw Object.assign(new Error('筛选条件尚未通过当前完整候选或选择规则校验'),{code:'DQE_QUERY_REJECTED'});}

function validateGlobalRegionNames(page:Page,filter:FilterDeclaration,candidates:readonly FilterCandidate[]):void {
  if(filter.id!=='region'||!iocHeaderDeclaration(page)?.filterIds?.includes('region'))return;
  if(candidates.some(candidate=>candidate.label==='全球'&&candidate.value!=='全球'))throw Object.assign(new Error('IOC Region 的全球节点必须归一为中文值“全球”'),{code:'DQE_CONFIG_ERROR'});
}

function needsCandidateReceipt(filter:Extract<FilterDeclaration,{type:'dimension'}>,selected:FilterValue|undefined):boolean {
  return !!(filter.candidates||filter.candidateContext||filter.candidateWindow||selected?.type==='dimension'&&selected.values.length>0);
}
