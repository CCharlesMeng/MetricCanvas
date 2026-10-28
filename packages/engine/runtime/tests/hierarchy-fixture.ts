import {readFileSync} from 'node:fs';
import {parsePage} from '@metriccanvas/page';
import type {TableComponent} from '@metriccanvas/page/internal';
import {initialFilterValues,type FilterValues} from '../src/filter-state';
import {createDqeGateway} from '../../data-gateway/src/dqe';
import {createDqeSimServer,DQE_EXECUTE_PATH} from '../../../../tools/dqe-sim/src/server';
export function hierarchyFixture(){
  const document=JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/table-hierarchy-selection.json',import.meta.url),'utf8'));
  const parsed=parsePage(document);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page,table=page.sections[0]!.components[0] as TableComponent;
  return {document,page,table,filters:initialFilterValues(page.filters??[])};
}
export function choose(filters:FilterValues,value?:string,level='office'){
  const next=new Map(filters);if(!value)next.delete('region');
  else next.set('region',{type:'dimension',dimension:level==='office'?'h_office':'h_region',level,values:[value]});
  return next;
}
export async function hierarchySim(){
  const server=createDqeSimServer({logger:false});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw Error('server');
  const base=createDqeGateway({endpoint:`http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`,encodeSearch(item,search){
    const filter=item.filter as {dims:import('@metriccanvas/page/internal').JsonValue[]};
    return {...item,filter:{...filter,dims:[...filter.dims,{dim_name:search.queryFields[0],operator:'contains',dim_value_list:[search.query]}]}};
  }});
  const gateway:import('../src').RuntimeDataGateway={...base,async fetchFilterCandidates(request:import('../src').FilterCandidatesRequest,options:{signal:AbortSignal}){
    const result=await base.fetchDimensionValues(request.dimension,{signal:options.signal,constraints:request.constraints.dimensions});
    return result.kind==='values'?{kind:'values' as const,candidates:result.candidates.map(c=>({...c,level:request.level}))}:result;
  }};
  return {gateway,async close(){server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}};
}
