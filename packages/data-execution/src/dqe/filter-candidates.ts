import type {DimensionValuesGateway,FilterCandidatesGateway,FilterCandidate} from '../ports';

/** Reuse the real dimension query; never fabricate cross-level parent relationships. */
export function dimensionFilterCandidates(fetch:DimensionValuesGateway['fetchDimensionValues']):FilterCandidatesGateway['fetchFilterCandidates'] {
  return async(request,{signal})=>{
    if(request.calendarWindow||Object.keys(request.constraints.times).length||Object.keys(request.constraints.booleans??{}).length)return {kind:'unavailable'};
    signal.throwIfAborted();
    if(Object.values(request.constraints.dimensions).some(values=>!values.length))return {kind:'values',candidates:[]};
    const result=await fetch(request.dimension,{signal,constraints:request.constraints.dimensions});
    signal.throwIfAborted();
    if(result.kind!=='values')return result;
    const candidates:FilterCandidate[]=result.candidates.map(candidate=>({
      ...candidate,
      value:request.filterId==='region'&&candidate.label==='全球'?'全球':candidate.value,
      ...(request.level?{level:request.level}:{}),
      ...(request.level&&candidate.parentValue?{parent:{level:request.level,value:candidate.parentValue}}:{})
    }));
    return {kind:'values',candidates};
  };
}
