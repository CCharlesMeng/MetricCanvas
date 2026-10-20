import {canonicalizeJson} from '@metriccanvas/page/internal';
import type {RuntimeDataGateway,FilterCandidatesRequest,FilterCandidatesResult} from './ports';

/** Per runtime instance. Reuse complete receipts across UI and execution validation, never across identities. */
export function createCandidateGatewaySession(base:RuntimeDataGateway) {
  const receipts=new Map<string,FilterCandidatesResult>(),generations=new Map<string,number>();let disposed=false;
  const key=(request:FilterCandidatesRequest)=>canonicalizeJson(request);
  const gateway:RuntimeDataGateway={fetchData:base.fetchData.bind(base),
    ...(base.fetchDimensionValues?{fetchDimensionValues:base.fetchDimensionValues.bind(base)}:{}),
    ...(base.fetchFilterCandidates?{fetchFilterCandidates:async(request:FilterCandidatesRequest,options:{signal:AbortSignal})=>{
      options.signal.throwIfAborted();if(disposed)throw Object.assign(new Error('候选会话已结束'),{code:'DQE_CANCELLED'});
      const id=key(request),generation=generations.get(id)??0,cached=receipts.get(id);if(cached)return structuredClone(cached);
      const result=await base.fetchFilterCandidates!(request,options);options.signal.throwIfAborted();
      if(!disposed&&(generations.get(id)??0)===generation&&result.kind==='values')receipts.set(id,structuredClone(result));
      return result;
    }}:{})
  };
  return {gateway,invalidate(request:FilterCandidatesRequest){const id=key(request);receipts.delete(id);generations.set(id,(generations.get(id)??0)+1);},dispose(){disposed=true;receipts.clear();generations.clear();}};
}
