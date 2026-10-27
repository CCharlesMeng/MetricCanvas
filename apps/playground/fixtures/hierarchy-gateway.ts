import { createDqeGateway, DqeGatewayError } from '@metriccanvas/engine/dqe';
/** This named Sim scenario verifies its own text-search encoding over HTTP. */
export function createHierarchyGateway(){
  const base=createDqeGateway({encodeSearch(item,search){
    if(JSON.stringify(search.queryFields)!=='["h_office_name"]')throw new DqeGatewayError('DQE_CONFIG_ERROR','该合成示例仅提供代表处名称搜索');
    const filter=item.filter as {dims:import('@metriccanvas/page/internal').JsonValue[];metrics:import('@metriccanvas/page/internal').JsonValue[]};
    return {...item,filter:{...filter,dims:[...filter.dims,{dim_name:'h_office_name',operator:'contains',dim_value_list:[search.query]}]}};
  }});
  return {...base,async fetchFilterCandidates(request:import('@metriccanvas/engine').FilterCandidatesRequest,options:{signal:AbortSignal}){
    const result=await base.fetchDimensionValues(request.dimension,{signal:options.signal,constraints:request.constraints.dimensions});
    return result.kind==='values'?{kind:'values' as const,candidates:result.candidates.map(c=>({...c,level:request.level}))}:result;
  }};
}
