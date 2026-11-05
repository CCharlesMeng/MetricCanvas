import type {FilterCandidate,FilterCandidatesRequest,FilterCandidatesResult,RuntimeDataGateway} from './ports';

/** Install once per host application; credentials and upstream access remain in the Adapter. */
export interface OperationMapRegionAdapter {
  fetchRegionCandidates(request:FilterCandidatesRequest,options:{signal:AbortSignal}):Promise<FilterCandidatesResult>;
}
const dimensions=new Set(['geo-pc-code','region-dept-code','rep-office-code']);

function canonicalRegionCandidates(candidates:FilterCandidate[]):FilterCandidate[] {
  const globals=candidates.filter(candidate=>candidate.label==='全球');
  const canonical=(level:string|undefined,value:string)=>globals.some(candidate=>candidate.level===level&&candidate.value===value)?'全球':value;
  return candidates.map(candidate=>({...candidate,value:canonical(candidate.level,candidate.value),...(candidate.parent?{parent:{...candidate.parent,value:canonical(candidate.parent.level,candidate.parent.value)}}:{})}));
}

/** Standard Region routes use the host adapter; all other capabilities keep the base gateway. */
export function withOperationMapRegion(base:RuntimeDataGateway,adapter:OperationMapRegionAdapter):RuntimeDataGateway {
  return {...base,async fetchFilterCandidates(request,options){
    options.signal.throwIfAborted();
    if(request.filterId!=='region'||!dimensions.has(request.dimension))return base.fetchFilterCandidates?.(request,options)??{kind:'unavailable'};
    const result=await adapter.fetchRegionCandidates(request,options);
    options.signal.throwIfAborted();
    return result.kind==='values'?{kind:'values',candidates:canonicalRegionCandidates(result.candidates)}:result;
  }};
}
