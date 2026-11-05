import type { DimensionFilterDeclaration } from '@metriccanvas/page/internal';
import type { DimensionValuesSnapshot, FilterValues } from '../../../runtime/src';
export const SOURCE_FILTER_CONTEXT=Symbol('sourceFilters');
export interface SourceFilterBinding {
  declaration:DimensionFilterDeclaration;
  values:string[];
  candidates:DimensionValuesSnapshot;
  onchange:(values:string[])=>void;
  onretry:()=>void;
}
export type SourceFilterReader=(id:string)=>SourceFilterBinding|undefined;
export function sourceFilterValues(values:FilterValues,id:string):string[] {
  const selected=values.get(id);return selected?.type==='dimension'?selected.values:[];
}
