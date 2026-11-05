import {withOperationMapRegion,type RuntimeDataGateway} from '@metriccanvas/engine';
import {iocRegionCandidates} from '../../../tools/dqe-sim/fixtures/ioc-region-candidates.mjs';

/** Synthetic application-level installation; no Operation Map endpoint or production query. */
export function createIocHeaderControlsPreview(){
  const base:RuntimeDataGateway={async fetchData(query){
    const organization=query.filterValues.find(value=>value.target==='dimension');
    return {rows:[{region:organization?.values.join('、')??'全球（当前范围不限）',amount:100}],totalCount:1};
  }};
  const dataGateway=withOperationMapRegion(base,{
    async fetchRegionCandidates(request,{signal}){
      signal.throwIfAborted();
      return iocRegionCandidates(request,{names:true})??{kind:'unconfigured'};
    }
  });
  return {dataGateway};
}
