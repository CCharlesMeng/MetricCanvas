import type {RuntimeDataGateway} from '@metriccanvas/engine';
import {createKeyOfficePriorityGateway} from './key-office-filter/gateway';

function observe(kind:string,value:unknown) {
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('metriccanvas:async-preparation',{detail:{kind,value,at:performance.now()}}));
}
function delay(ms:number,signal?:AbortSignal):Promise<void> {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(done,ms);
    function done(){signal?.removeEventListener('abort',abort);resolve();}
    function abort(){clearTimeout(timer);reject(signal?.reason);}
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
  });
}
/** Fixed synthetic delays expose the real initialization and query interfaces. */
export function createAsyncPreparationPreview(state='ready'):{dataGateway:RuntimeDataGateway} {
  const base=createKeyOfficePriorityGateway();
  const dataGateway:RuntimeDataGateway={
    ...base,
    finalizationSource:{body:{dsl_list:[{output_dims:['名称','截止日期'],filter:{}}]},nameField:'名称',dateField:'截止日期',timeoutMs:3000},
    async fetchFilterCandidates(request,options){
      if(request.dimension==='rep-office-name'&&request.filterId!=='region'){
        observe('membership-start',request);await delay(1000,options.signal);
        if(state==='error')return {kind:'denied'};
        observe('membership-ready',request);
        if(state==='empty')return {kind:'values',candidates:[]};
      }
      return base.fetchFilterCandidates!(request,options);
    },
    async fetchData(query,context,signal){
      if(query.fieldMappings.name){
        observe('finalization-start',{});await delay(1000,signal);
        observe('finalization-ready',{});
        if(state==='date-error')throw new Error('合成定稿查询失败');
        return {rows:[{name:'合成经营数据',date:'2026-04-18'}],totalCount:1};
      }
      observe('query',{query,context});
      if(context?.dataSourceIds?.includes('unrelated'))return {rows:[{office:'无关数据已就绪',amount:88,customer:'战略'}],totalCount:1};
      return base.fetchData(query,context,signal);
    }
  };
  return {dataGateway};
}
