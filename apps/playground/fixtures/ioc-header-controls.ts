import {withOperationMapRegion,type RuntimeDataGateway} from '@metriccanvas/engine';
import {iocRegionCandidates} from '../../../tools/dqe-sim/fixtures/ioc-region-candidates.mjs';

/** Synthetic application-level installation; no Operation Map endpoint or production query. */
export function createIocHeaderControlsPreview(){
  const base:RuntimeDataGateway={async fetchData(query){
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('metriccanvas:synthetic-header-controls',{detail:query.filterValues}));
    const organization=query.filterValues.find(value=>value.target==='dimension');
    return {rows:[{region:organization?.values.join('、')??'全球（当前范围不限）',amount:100}],totalCount:1};
  }};
  const dataGateway=withOperationMapRegion(base,{
    async fetchRegionCandidates(request,{signal}){
      signal.throwIfAborted();
      const result=iocRegionCandidates(request,{names:true});
      if(!result)return {kind:'unconfigured'};
      if(result.kind!=='values')return result;
      return {...result,candidates:[...result.candidates,
        {level:'region-dept',value:'SAME',label:'同码地区部',parent:{level:'geo',value:'全球'}},
        {level:'office',value:'SAME',label:'同码代表处',parent:{level:'region-dept',value:'SAME'}}]};
    }
  });
  return {dataGateway};
}
