import {describe,it,expect} from 'vitest';
import type {FilterDeclaration} from '@metriccanvas/page/internal';
import {seedPageParamFilters} from '../../../data-execution/src/page-params';
import {detailViewInput} from '../src/detail-view';
import {parsePage} from '@metriccanvas/page';
import type {OpenDetailAction} from '@metriccanvas/page/internal';
import fixture from '../../../../pages/capabilities/ioc-header/selection/ioc-header-selection.json';
import {createFilterState,parseFilterSearch,initialFilterValues} from '../src/filter-state';

const declarations:FilterDeclaration[]=[{id:'region',type:'dimension',dimension:'region',selection:{mode:'single'},default:['SZ']}];
const multi={type:'dimension' as const,dimension:'region',values:['SZ','BJ']};
describe('single cardinality across state entry points',()=>{
 it('rejects initial/write/writeMany and does not notify on illegal writes',()=>{
  expect(()=>createFilterState(new Map([['region',multi]]),declarations)).toThrow();
  const state=createFilterState(initialFilterValues(declarations),declarations);let calls=0;state.subscribe(()=>calls++);
  state.write('region',multi);state.writeMany([['region',multi]]);expect(calls).toBe(1);expect(state.toURL()).toContain('SZ');
 });
 it('ignores multivalue URL while preserving valid applied value; absent URL clears',()=>{
  expect(parseFilterSearch('region=SZ&region=BJ',declarations).size).toBe(0);
  const state=createFilterState(initialFilterValues(declarations),declarations);state.fromURL('region=SZ&region=BJ',declarations);expect(state.toURL()).toContain('SZ');
  state.fromURL('',declarations);expect(state.toURL()).toBe('');
 });
 it('does not truncate multi-defaults or injected arrays',()=>{
  expect(()=>initialFilterValues([{...declarations[0],default:['SZ','BJ']} as FilterDeclaration])).toThrow();
 });
});

it('empty single initial value is a legitimate no-filter state',()=>{
 expect(()=>createFilterState(new Map([['region',{type:'dimension',dimension:'region',values:[]}]]),declarations)).not.toThrow();
});
it('parameter arrays and detail row arrays cannot bypass single cardinality',()=>{
 const result=parsePage(fixture);if(!result.ok)throw Error('fixture');
 const page={...result.page,filters:[{id:'region',type:'dimension' as const,dimension:'region',selection:{mode:'single' as const},initialParam:'regions',visible:false}]};
 expect(()=>seedPageParamFilters(page,new Map([['regions',['SZ','BJ']]]))).toThrow();
 const view={...page,detailViews:[{id:'detail',mode:'query' as const,filters:['region'],components:result.page.sections[0].components}]};
 const action:OpenDetailAction={on:'click',openDetail:{surface:'modal',view:'detail',bindings:{region:{source:'filter',id:'upstream'}}}};
 expect(()=>detailViewInput(view,action,{},new Map([['upstream',multi]]),new Map())).toThrow();
});
