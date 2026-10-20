import {requiresTimeValidation,timeAvailabilityIssue,timeFilterBoundaryError,type DisplayInputsSnapshot} from '@metriccanvas/page/internal';
import { queryFilterIds,numberRangeIssue,rangeContextIssue,chartFilterOptions, candidateDependencies, filterDependencies, dimensionSelectionIssue, conditionSourceIds, canonicalizeJson, type Page, type FilterDeclaration } from '@metriccanvas/page/internal';
import type {RuntimeDataGateway,FilterCandidate} from './ports';
import type {FilterValues} from './filter-values';
import {candidateContextKey,filterCandidatesRequest,validFilterCandidates} from './filter-candidates';

/** Execution consumers share this fail-closed boundary, including seeded/initial receipts. */
export function createCandidateValidator(page:Page,gateway:RuntimeDataGateway,context:{displayInputs?:()=>DisplayInputsSnapshot|undefined;filterRevision?:()=>number;now?:Date}={}) {
  const localOptions=chartFilterOptions(page);
  const declarations=page.filters??[],byId=new Map(declarations.map(filter=>[filter.id,filter]));
  function filterIds(sourceId:string):string[] {
    const ids=new Set<string>();
    for(const source of conditionSourceIds(page,sourceId)){const definition=page.dataSources[source];if(definition?.source.type==='query')for(const id of queryFilterIds(definition.source.query))ids.add(id);}
    const queue=[...ids];for(const id of queue){const filter=byId.get(id);if(filter)for(const parent of filterDependencies(filter))if(!ids.has(parent)){ids.add(parent);queue.push(parent);}}
    return [...ids];
  }
  function dynamic(filter:FilterDeclaration):boolean {return filter.type==='dimension'&&!filter.options&&!localOptions.has(filter.id);}
  function key(filter:Extract<FilterDeclaration,{type:'dimension'}>,values:FilterValues) {
    const selected=values.get(filter.id);const level=selected?.type==='dimension'?selected.level:filter.defaultLevel??filter.hierarchy?.[0]?.id;
    const frozen={displayInputs:context.displayInputs?.(),filterRevision:context.filterRevision?.(),now:context.now??new Date()};
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
    const effective=candidates.filter(item=>!item.disabled&&(!filter.treeSelection||item.level===(selected?.type==='dimension'?selected.level:filter.defaultLevel??filter.hierarchy?.[0]?.id)));
    return effective.length>0 && (selected?.type!=='dimension'||selected.values.every(value=>effective.some(item=>item.value===value)));
  }
  function trusted(sourceId:string,values:FilterValues):boolean {
    return filterIds(sourceId).every(id=>{const filter=byId.get(id);if(!filter||!selection(filter,values))return false;return !dynamic(filter)||!requires(sourceId);});
  }
  async function verify(sourceId:string,values:FilterValues,signal:AbortSignal) {
    const done=new Set<string>();
    const cache=new Map<string,readonly FilterCandidate[]>();
    async function verifyFilter(id:string):Promise<void> {
      if(done.has(id))return;done.add(id);signal.throwIfAborted();
      const filter=byId.get(id);if(!filter||!selection(filter,values))reject();
      for(const parent of candidateDependencies(filter!))await verifyFilter(parent);
      if(!filter||filter.type!=='dimension'||!dynamic(filter))return;
      const selected=values.get(id);
      if(!filter.candidateContext&&!filter.treeSelection&&!filter.candidateWindow&&!(selected?.type==='dimension'&&selected.values.length))return;
      const dimension=filter;
      const identity=key(dimension,values);let candidates=cache.get(identity.key);
      if(!candidates){
        if(dimension.candidateContext||dimension.treeSelection||dimension.candidateWindow){
          if(!gateway.fetchFilterCandidates)reject();
          const result=await gateway.fetchFilterCandidates!(identity.request,{signal});signal.throwIfAborted();
          if(result.kind!=='values'||!Array.isArray(result.candidates)||!validFilterCandidates(result.candidates,dimension.treeSelection?dimension.hierarchy?.map(item=>item.id):undefined))reject();
          candidates=result.kind==='values'?result.candidates:[];
        }else{
          if(!gateway.fetchDimensionValues)reject();
          const parent=dimension.dependsOn?values.get(dimension.dependsOn):undefined;
          const constraints=parent?.type==='dimension'&&parent.values.length?{[parent.dimension]:parent.values}:{};
          const result=await gateway.fetchDimensionValues!(identity.request.dimension,{signal,constraints});signal.throwIfAborted();
          if(result.kind!=='values')reject();
          candidates=[...new Map(result.candidates.map(item=>[item.value,item])).values()];
          if(!validFilterCandidates(candidates))reject();
        }
        cache.set(identity.key,candidates);
      }
      if(!allowed(dimension,values,candidates))reject();
    }
    for(const id of filterIds(sourceId))await verifyFilter(id);
  }
  const requires=(sourceId:string)=>filterIds(sourceId).some(id=>{const filter=byId.get(id);return (filter?.type==='dimension'&&!!(filter.selection||filter.options||filter.candidateContext||filter.treeSelection||filter.candidateWindow))||(filter&&requiresTimeValidation(filter))||(filter?.type==='numberRange'&&!!(filter.constraints||filter.units||filter.presets));});
  return {trusted,verify,requires};
}
function reject():never {throw Object.assign(new Error('筛选条件尚未通过当前完整候选或选择规则校验'),{code:'DQE_QUERY_REJECTED'});}
