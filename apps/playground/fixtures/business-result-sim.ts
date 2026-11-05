import type {DisplayInputs,RuntimeDataGateway} from '@metriccanvas/engine';
import {iocRegionCandidates} from '../../../tools/dqe-sim/fixtures/ioc-region-candidates.mjs';

/** Trusted development facts only; business rows still travel through the ordinary HTTP gateway. */
export const businessResultSimDisplayInputs: DisplayInputs = {
  getSnapshot: () => ({permissionRevision:'business-result-sim',permissions:{},values:{},timeZone:'Asia/Shanghai',periods:{'net-discount-through':{status:'ready',granularity:'date',latest:'2026-11-04'}}}),
  subscribe: () => () => {}
};

export function businessResultSimGateway(base: RuntimeDataGateway): RuntimeDataGateway {
  return {...base,async fetchFilterCandidates(request,options) {
    options.signal.throwIfAborted();
    return iocRegionCandidates(request) ?? await base.fetchFilterCandidates?.(request,options) ?? {kind:'unavailable'};
  }};
}
