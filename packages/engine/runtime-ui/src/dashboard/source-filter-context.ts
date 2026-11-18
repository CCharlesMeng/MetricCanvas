import type { DimensionFilterDeclaration } from '@metriccanvas/page/internal';
import type { DimensionValuesSnapshot, FilterValues } from '../../../runtime/src';
import type { CandidatePageReader } from '../filters/candidate-paging';
export const SOURCE_FILTER_CONTEXT=Symbol('sourceFilters');
export interface SourceFilterBinding {
  declaration:DimensionFilterDeclaration;
  values:string[];
  level?:string;
  candidates:DimensionValuesSnapshot;
  pagination?:CandidatePageReader;
  confirmation?:boolean;
  preparing?:boolean;
  onchange:(values:string[],level?:string)=>void;
  onretry:()=>void;
}
export type SourceFilterReader=(id:string)=>SourceFilterBinding|undefined;
export function sourceFilterSelection(values:FilterValues,id:string):Pick<SourceFilterBinding,'values'|'level'> {
  const selected=values.get(id);
  return selected?.type==='dimension'?{values:selected.values,level:selected.level}:{values:[]};
}
