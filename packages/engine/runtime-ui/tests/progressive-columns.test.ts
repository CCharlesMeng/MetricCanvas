import { expect, it } from 'vitest';
import type { Component, TableComponent } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import { progressiveSlotData, usableTableProgress } from '../src/table/screen-progress';
import { createRetainedScreenData } from '../src/retained-screen-data';

const table={id:'table',type:'table',data:{main:'a',supplement:'b'},props:{columns:[]}} as unknown as TableComponent;
const view={pageIndex:0,sort:[],headerFilters:{}};
const data:NamedDataSlots={main:{sourceStatus:'ready',fields:{},snapshot:{status:'ready',rows:[{key:'A',value:10}]}},supplement:{sourceStatus:'loading',fields:{},snapshot:{status:'ready',rows:[]}}};

it('reveals a fresh main slot without mixing in a retained supplementary receipt',()=>{
  const cache=createRetainedScreenData();
  cache.read(table,data,{status:'ready',rows:[]});
  const partial=progressiveSlotData(table,data,view)!;
  expect(partial.main?.snapshot.rows).toEqual([{key:'A',value:10}]);
  expect(partial.supplement?.snapshot.rows).toEqual([]);
  expect(cache.read(table,partial,{status:'loading'}).retained).toBe(false);
  expect(partial.main?.progress).toBeDefined();
});

it('does not apply pending column values to local sorting, filtering, search or row visibility',()=>{
  const progress={snapshot:{status:'ready' as const,rows:[{value:null}]},pendingFields:['value']};
  expect(usableTableProgress(table,progress,{...view,sort:[{field:'value',direction:'asc'}]})).toBeUndefined();
  expect(usableTableProgress(table,progress,{...view,headerFilters:{value:{mode:'select',values:[1]}}})).toBeUndefined();
  expect(usableTableProgress(table,progress,{...view,search:{fields:['value'],query:'x'}})).toBeUndefined();
  expect(usableTableProgress(table,progress,view)).toBe(progress);
  expect(progressiveSlotData({...table,props:{...table.props,rowVisibleWhen:{op:'eq',left:{field:'value'},right:{value:1}}}} as unknown as Component,data,view)).toBeUndefined();
});

it('allows main-only sort while deferring a sort bound to a waiting supplementary slot',()=>{
  const withColumns={...table,props:{columns:[{title:'Main',field:'value'},{title:'Extra',field:{data:'supplement',field:'extra'}}]}} as unknown as TableComponent;
  expect(progressiveSlotData(withColumns,data,{...view,sort:[{field:'value',direction:'asc'}]})).toBeDefined();
  expect(progressiveSlotData(withColumns,data,{...view,sort:[{field:'extra',direction:'asc'}]})).toBeUndefined();
});
