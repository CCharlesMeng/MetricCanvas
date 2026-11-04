import type {EffectiveQuery} from '@metriccanvas/page/internal';
import type {RuntimeDataGateway,FilterCandidatesRequest} from '@metriccanvas/engine';
export {createSharedFilterBridge} from '../../../../packages/embed/examples/shared-filter-bridge';
export {prepareIocHeaderFilters} from '../../../../packages/embed/examples/ioc-header-candidate-bridge';

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

/** Synthetic authorized population; production permissions remain the Adapter owner's responsibility. */
const priorityOffices=[
  {office:'上海代表处',region:'华东地区部',key:'true',customer:'战略',amount:10},
  {office:'南京代表处',region:'华东地区部',key:'false',customer:'卓越',amount:20},
  {office:'深圳代表处',region:'华南地区部',key:'true',customer:'卓越',amount:30},
  {office:'广州代表处',region:'华南地区部',key:'false',customer:'战略',amount:40}
];

export function createKeyOfficePriorityGateway(observe?:(kind:'query'|'candidates',request:EffectiveQuery|FilterCandidatesRequest)=>void,state='ready'):RuntimeDataGateway {
  return {
    async fetchFilterCandidates(request,{signal}){
      signal.throwIfAborted();observe?.('candidates',request);
      if(request.dimension==='rep-office-name'&&request.filterId!=='region'){
        if(state==='denied')return {kind:'denied'};
        return {kind:'values',candidates:state==='empty'?[]:priorityOffices.filter(item=>item.key==='true').map(item=>({value:item.office,label:item.office}))};
      }
      if(request.dimension==='customer-level')return {kind:'values',candidates:['战略','卓越'].map(value=>({value,label:value}))};
      return {kind:'values',candidates:[
        ...['华东地区部','华南地区部'].map(value=>({value,label:value,level:'region-dept'})),
        ...priorityOffices.map(item=>({value:item.office,label:item.office,level:'office',parent:{level:'region-dept',value:item.region}}))
      ]};
    },
    async fetchData(query){
      observe?.('query',query);
      const rows=priorityOffices.filter(item=>query.filterValues.every(predicate=>{
        if(predicate.target!=='dimension')return true;
        const value=priorityValue(item,predicate.queryField);
        if(value===undefined)throw Object.assign(new Error('合成网关不支持该筛选字段'),{code:'DQE_QUERY_REJECTED'});
        return predicate.values.includes(value);
      })).map(item=>({office:item.office,amount:item.amount,customer:item.customer}));
      return {rows,totalCount:rows.length};
    }
  };
}
function priorityValue(item:typeof priorityOffices[number],field:string):string|undefined {
  const fields:Record<string,string>={'地区部':item.region,'代表处':item.office,'重点国代':item.key,'客户级别':item.customer};
  return fields[field];
}
