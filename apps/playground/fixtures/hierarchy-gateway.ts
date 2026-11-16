import { createDqeGateway } from '@metriccanvas/engine/dqe';
import fixture from '../../../tools/dqe-sim/fixtures/table-hierarchy-selection.json';
import type { DimensionValueCandidate, FilterCandidate, FilterCandidatesResult } from '@metriccanvas/engine';

/** The candidate tree uses the fixture's explicit relation; detail rows still have no parent column. */
function regionTree(parents: DimensionValueCandidate[], offices: DimensionValueCandidate[], globalLevel: string): FilterCandidate[] {
  const parentByOffice = new Map(fixture.lookup.map(row => [row.h_office, row.h_parent]));
  return [
    {value:'全球',label:'全球',level:globalLevel},
    ...parents.map(candidate => ({ ...candidate, level: 'region-dept' })),
    ...offices.map(candidate => {
      const parent = parentByOffice.get(candidate.value);
      return { ...candidate, level: 'office', ...(parent ? { parent: { level: 'region-dept', value: parent } } : {}) };
    })
  ];
}
/** The Sim scenario exercises the default DQE gateway and supplies a candidate tree. */
export function createHierarchyGateway(endpoint?: string){
  const base=createDqeGateway({endpoint});
  return {...base,async fetchFilterCandidates(request:import('@metriccanvas/engine').FilterCandidatesRequest,options:{signal:AbortSignal}):Promise<FilterCandidatesResult>{
    if (request.filterId === 'region') {
      const [parents, offices] = await Promise.all(['h_region', 'h_office'].map(dimension =>
        base.fetchDimensionValues(dimension, { signal: options.signal, constraints: request.constraints.dimensions })));
      if (parents!.kind !== 'values') return parents!;
      if (offices!.kind !== 'values') return offices!;
      const globalLevel = ['geo-pc-code', 'region-dept-code', 'rep-office-code'].includes(request.dimension) ? 'geo' : 'region-dept';
      return { kind: 'values', candidates: regionTree(parents!.candidates, offices!.candidates, globalLevel) };
    }
    const result=await base.fetchDimensionValues(request.dimension,{signal:options.signal,constraints:request.constraints.dimensions});
    return result.kind==='values'?{kind:'values' as const,candidates:result.candidates.map(c=>({...c,level:request.level}))}:result;
  }};
}
