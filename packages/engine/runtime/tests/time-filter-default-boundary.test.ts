import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resolvePeriodSelection, type FilterDeclaration } from '@metriccanvas/page/internal';
import { createFilterState, initialFilterValues, parseFilterSearch } from '../src/filter-state';
const point = (value: string) => ({type:'timePoint' as const,granularity:'month' as const,value});
const declarations: FilterDeclaration[] = [
  {id:'month',type:'timePoint',granularity:'month',required:true,default:'2026-05'},
  {id:'range',type:'timeRange',precision:'date',required:true,default:{from:'2026-05-01',to:'2026-05-15'}},
  {id:'datetime',type:'timeRange',precision:'datetime',default:'today'},
  {id:'period',type:'timeRange',display:'period',precision:'date',default:{mode:'month'}}
];
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date(2026,4,15,12,30));});
afterEach(()=>vi.useRealTimers());
it('omitted disableFuture rejects future point, date and datetime writes without publishing or querying',()=>{
  const state=createFilterState(initialFilterValues(declarations),declarations);let pushes=0;state.subscribe(()=>pushes++);
  state.write('month',point('2026-06'));
  state.writeMany([
    ['range',{type:'timeRange',from:'2026-05-01',to:'2026-05-16'}],
    ['datetime',{type:'timeRange',from:'2026-05-15T00:00',to:'2026-05-15T12:31'}]
  ]);
  expect(pushes).toBe(1);
  state.write('range',{type:'timeRange',from:'2026-05-01',to:'2026-05-15'});
  expect(pushes).toBe(1);
  state.write('datetime',{type:'timeRange',from:'2026-05-15T00:00',to:'2026-05-15T12:29'});
  expect(pushes).toBe(2);
});
it('future URL values fall back to valid required values and cannot remain in shareable state',()=>{
  const state=createFilterState(initialFilterValues(declarations),declarations);
  const query='month=2027-01&range.from=2026-05-01&range.to=2027-01-01&period=quarter:2026-Q3';
  expect(parseFilterSearch(query,declarations).size).toBe(0);
  state.fromURL(query,declarations);
  expect(state.toURL()).toContain('month=2026-05');
  expect(state.toURL()).toContain('range.to=2026-05-15');
  expect(state.toURL()).not.toContain('2027');
});
it('current natural year and quarter remain complete; later periods are rejected',()=>{
  const state=createFilterState(initialFilterValues(declarations),declarations);let current:any;state.subscribe(v=>current=v.get('period'));
  for(const selection of [{mode:'year',value:'2026'},{mode:'quarter',value:'2026-Q2'}] as const){
    const resolved=resolvePeriodSelection(selection,new Date());state.write('period',{type:'timeRange',...resolved});expect(current).toMatchObject(resolved);
  }
  const before=structuredClone(current);
  for(const selection of [{mode:'year',value:'2027'},{mode:'quarter',value:'2026-Q3'},{mode:'month',value:'2026-06'}] as const){
    state.write('period',{type:'timeRange',...resolvePeriodSelection(selection,new Date())});expect(current).toEqual(before);
  }
  expect(current.to).toBe('2026-06-30');
});
it('initial values and supplied execution state fail closed; month rollover admits the new month',()=>{
  expect(()=>initialFilterValues([{id:'range',type:'timeRange',default:{from:'2026-05-01',to:'2026-05-16'}}])).toThrow('不得晚于');
  expect(()=>initialFilterValues([{id:'month',type:'timePoint',granularity:'month',default:'2026-06'}])).toThrow('不得晚于');
  expect(()=>createFilterState(new Map([['month',point('2026-06')]]),declarations)).toThrow('初值');
  const state=createFilterState(initialFilterValues(declarations),declarations);vi.setSystemTime(new Date(2026,5,1));state.write('month',point('2026-06'));expect(state.toURL()).toContain('month=2026-06');
});
it('an explicit timePoint exception keeps its existing false semantics and still respects min',()=>{
  const allowed:FilterDeclaration[]=[{id:'point',type:'timePoint',granularity:'month',disableFuture:false,min:'2020-06',default:'2027-01'}];
  const state=createFilterState(initialFilterValues(allowed),allowed);state.write('point',point('2019-01'));expect(state.toURL()).toBe('point=2027-01');
});

it('month presets retain month encoding at the inclusive current-month boundary',()=>{
  expect(initialFilterValues([{id:'month-range',type:'timeRange',precision:'month',default:'today'}]).get('month-range')).toEqual({type:'timeRange',from:'2026-05',to:'2026-05'});
});
