import type { FilterCandidatesGateway } from '@metriccanvas/engine';
import type { createPlatformSession } from './session';

/** Trusted Adapter stays outside Page JSON; every receipt shares platform session lifetime. */
export function platformFilterCandidates(input:unknown,session:ReturnType<typeof createPlatformSession>):FilterCandidatesGateway|undefined {
  if(input===undefined)return;
  if(!input||typeof input!=='object'||!('fetchFilterCandidates' in input)||typeof input.fetchFilterCandidates!=='function')throw Error('filterCandidates必须实现fetchFilterCandidates');
  const gateway=input as FilterCandidatesGateway;
  return {async fetchFilterCandidates(request,{signal}){
    if(!session.readConfig())throw Error('平台会话不可用');
    const combined=AbortSignal.any([signal,session.signal]);combined.throwIfAborted();
    const result=await gateway.fetchFilterCandidates(request,{signal:combined});
    if(!session.readConfig())throw Error('平台会话已失效');
    combined.throwIfAborted();return result;
  }};
}
