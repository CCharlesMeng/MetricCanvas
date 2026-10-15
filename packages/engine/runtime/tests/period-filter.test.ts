import { afterEach, expect, it, vi } from 'vitest';
import { initialFilterValues } from '@metriccanvas/data-execution/runtime';
import { resolvePeriodSelection, type FilterDeclaration } from '@metriccanvas/page/internal';
import { createFilterState, parseFilterSearch } from '../src/filter-state';
const declarations:FilterDeclaration[]=[{id:'period',type:'timeRange',display:'period',precision:'date',required:true,default:{mode:'month'}}];
afterEach(()=>vi.useRealTimers());
it('restores relative intent with the new month and keeps malformed URLs from clearing required state',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,15));
  const state=createFilterState(initialFilterValues(declarations),declarations);
  state.write('period',{type:'timeRange',...resolvePeriodSelection({mode:'last12Months'},new Date())});
  const url=state.toURL();expect(url).toBe('period=last12Months');
  vi.setSystemTime(new Date(2026,10,1));
  expect(parseFilterSearch(url,declarations).get('period')).toMatchObject({from:'2025-11-01',to:'2026-10-31',selection:{mode:'last12Months'}});
  state.fromURL('period=quarter:2026-Q5',declarations);
  let value:unknown;state.subscribe(v=>value=v.get('period'))();expect(value).toMatchObject({selection:{mode:'last12Months'}});
});
it('publishes mode-only changes and rejects inconsistent external ranges atomically',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,0,15));
  const state=createFilterState(initialFilterValues(declarations),declarations);let count=0;state.subscribe(()=>count++);
  state.write('period',{type:'timeRange',...resolvePeriodSelection({mode:'year',value:'2025'},new Date())});
  state.write('period',{type:'timeRange',...resolvePeriodSelection({mode:'last12Months'},new Date())});expect(count).toBe(3);
  state.write('period',{type:'timeRange',from:'2025-01-02',to:'2025-12-31',selection:{mode:'year',value:'2025'}});expect(count).toBe(3);
  state.write('period',null);expect(count).toBe(3);
});
