import type {DataGateway} from '@metriccanvas/engine';
import type {EffectiveQuery} from '@metriccanvas/page/internal';
import {effectiveDqeItem} from '@metriccanvas/engine/dqe';

/** Echo the actual encoded conditions; this fixture makes no backend capability claim. */
export function createObjectPeriodPreview(state='ready') {
  const requests:EffectiveQuery[]=[];
  const dataGateway:DataGateway={
    async fetchData(query) {
      requests.push(structuredClone(query));
      if(state==='error')throw Object.assign(new Error('合成对象查询失败'),{code:'DQE_QUERY_REJECTED'});
      return {rows:[{request:JSON.stringify(effectiveDqeItem(query).filter)}],totalCount:1};
    }
  };
  return {dataGateway,requests};
}
