import { createDqeGateway, DqeGatewayError } from '@metriccanvas/engine/dqe';
import fixture from '../../../tools/dqe-sim/fixtures/table-hierarchy-selection.json';
import type { DimensionValueCandidate, FilterCandidate, FilterCandidatesResult } from '@metriccanvas/engine';

/** The candidate tree uses the fixture's explicit relation; detail rows still have no parent column. */
function regionTree(parents: DimensionValueCandidate[], offices: DimensionValueCandidate[]): FilterCandidate[] {
  const parentByOffice = new Map(fixture.lookup.map(row => [row.h_office, row.h_parent]));
  return [
    ...parents.map(candidate => ({ ...candidate, level: 'region-dept' })),
    ...offices.map(candidate => {
      const parent = parentByOffice.get(candidate.value);
      return { ...candidate, level: 'office', ...(parent ? { parent: { level: 'region-dept', value: parent } } : {}) };
    })
  ];
}
/** This named Sim scenario verifies its own text-search encoding over HTTP. */
export function createHierarchyGateway(endpoint?: string){
  const base=createDqeGateway({endpoint,encodeSearch(item,search){
    if(JSON.stringify(search.queryFields)!=='["h_office_name"]')throw new DqeGatewayError('DQE_CONFIG_ERROR','该合成示例仅提供代表处名称搜索');
    const filter=item.filter as {dims:import('@metriccanvas/page/internal').JsonValue[];metrics:import('@metriccanvas/page/internal').JsonValue[]};
    return {...item,filter:{...filter,dims:[...filter.dims,{dim_name:'h_office_name',operator:'contains',dim_value_list:[search.query]}]}};
  }});
  return {...base,async fetchFilterCandidates(request:import('@metriccanvas/engine').FilterCandidatesRequest,options:{signal:AbortSignal}):Promise<FilterCandidatesResult>{
    if (request.filterId === 'region') {
      const [parents, offices] = await Promise.all(['h_region', 'h_office'].map(dimension =>
        base.fetchDimensionValues(dimension, { signal: options.signal, constraints: request.constraints.dimensions })));
      if (parents!.kind !== 'values') return parents!;
      if (offices!.kind !== 'values') return offices!;
      return { kind: 'values', candidates: regionTree(parents!.candidates, offices!.candidates) };
    }
    const result=await base.fetchDimensionValues(request.dimension,{signal:options.signal,constraints:request.constraints.dimensions});
    return result.kind==='values'?{kind:'values' as const,candidates:result.candidates.map(c=>({...c,level:request.level}))}:result;
  }};
}
