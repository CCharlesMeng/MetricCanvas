import type {EffectiveQuery} from '@metriccanvas/page/internal';
import type {RuntimeDataGateway,FilterCandidatesRequest} from '@metriccanvas/engine';
export {createSharedFilterBridge} from '../../../../packages/embed/examples/shared-filter-bridge';

/** Entirely synthetic values; no business-derived names, codes or receipts. */
export const offices=[
  {office:'A1',region:'A',key:true,amount:10},
  {office:'A2',region:'A',key:false,amount:20},
  {office:'B1',region:'B',key:true,amount:30},
  {office:'B2',region:'B',key:false,amount:40}
];
export function createKeyOfficeGateway(observe?:(kind:'query'|'candidates',request:EffectiveQuery|FilterCandidatesRequest)=>void):RuntimeDataGateway {
  return {
    async fetchFilterCandidates(request,{signal}){
      signal.throwIfAborted();observe?.('candidates',request);
      const visible=offices.filter(item=>!request.constraints.booleans?.['key-office']||item.key);
      return {kind:'values',candidates:[
        ...['A','B'].map(value=>({value,label:`地区 ${value}`,level:'region-dept'})),
        ...visible.map(item=>({value:item.office,label:`代表处 ${item.office}`,level:'office',parent:{level:'region-dept',value:item.region}}))
      ]};
    },
    async fetchData(query){
      observe?.('query',query);
      const rows=offices.filter(item=>query.filterValues.every(predicate=>{
        if(predicate.target!=='dimension')return true;
        if(predicate.queryField==='demo_region')return predicate.values.includes(item.region);
        if(predicate.queryField==='demo_office')return predicate.values.includes(item.office);
        if(predicate.queryField==='demo_key_office')return predicate.values.includes(String(item.key));
        return true;
      })).map(item=>({office:item.office,amount:item.amount}));
      return {rows,totalCount:rows.length};
    }
  };
}
