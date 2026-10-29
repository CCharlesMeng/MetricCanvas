import type {RuntimeDataGateway} from '@metriccanvas/engine';
import {iocRegionCandidates} from '../../../../tools/dqe-sim/fixtures/ioc-region-candidates.mjs';
/** Explicitly opted-in IOC demonstrations, never installed on the ordinary dimension gateway. */
export function withIocRegionCandidates(base:RuntimeDataGateway):RuntimeDataGateway {
 return {...base,async fetchFilterCandidates(request,options){
  options.signal.throwIfAborted();
  return iocRegionCandidates(request)??await base.fetchFilterCandidates?.(request,options)??{kind:'unavailable'};
 }};
}
