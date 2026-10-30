import type {RuntimeDataGateway} from '@metriccanvas/engine';
import {iocRegionCandidates} from '../../../../tools/dqe-sim/fixtures/ioc-region-candidates.mjs';
/** Opted-in synthetic IOC candidates, never installed on the ordinary dimension gateway. */
export function withIocRegionCandidates(base:RuntimeDataGateway):RuntimeDataGateway {
 return {...base,async fetchFilterCandidates(request,options){
  options.signal.throwIfAborted();
  return iocRegionCandidates(request)??await base.fetchFilterCandidates?.(request,options)??{kind:'unavailable'};
 }};
}
