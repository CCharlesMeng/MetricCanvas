import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {createFilterState,initialFilterValues} from '../src/filter-state';
import type {FilterValues} from '../src/filter-state';
const load=()=>{const result=parsePage(JSON.parse(readFileSync('pages/capabilities/ioc-header/scenarios/ioc-header-currency-demo.json','utf8')));if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;};
describe('amount coordinator',()=>{
 it('clears amount atomically with currency, waits explicit confirmation, and rejects an entire invalid group',()=>{
  const page=load(),state=createFilterState(initialFilterValues(page.filters??[]),page.filters);let updates=0;let values:FilterValues=initialFilterValues(page.filters??[]);state.subscribe(next=>{updates++;values=next;});
  state.write('amount',{type:'numberRange',from:1000000});expect(values.get('amount')).toMatchObject({from:1000000});const count=updates;
  expect(state.commit({type:'applyDraft',changes:[['currency',{type:'dimension',dimension:'currency_code',values:['USD']}],['amount',{type:'numberRange',from:-1}]]})).toMatchObject({ok:false});expect(updates).toBe(count);
  state.write('currency',{type:'dimension',dimension:'currency_code',values:['USD']});expect(updates).toBe(count+1);expect(values.get('amount')).toBeUndefined();expect(state.blocked().has('amount')).toBe(true);
  state.write('amount',null);expect(state.blocked().has('amount')).toBe(false);
 });
 it('allows independent period edits while required currency waits without a value',()=>{const page=load();const filters=page.filters!.map(f=>f.id==='currency'?{...f,default:undefined}:f);const state=createFilterState(initialFilterValues(filters),filters);expect(state.commit({type:'set',filterId:'period',value:{type:'timeRange',from:'2026-08',to:'2026-08',selection:{mode:'month',value:'2026-08'}}})).toMatchObject({ok:true});expect(state.commit({type:'set',filterId:'amount',value:{type:'numberRange',from:1}})).toMatchObject({ok:false});});
 it('validates URL/restore constraints without rescaling basic-unit values',()=>{
  const page=load(),state=createFilterState(initialFilterValues(page.filters??[]),page.filters);let values:FilterValues=initialFilterValues(page.filters??[]);state.subscribe(next=>values=next);
  state.fromURL('currency=USD&amount.from=1000000',page.filters??[]);expect(values.get('amount')).toMatchObject({from:1000000});
  const bad=new Map(values).set('amount',{type:'numberRange',from:5,to:5});expect(state.commit({type:'restore',values:bad})).toMatchObject({ok:false});expect(values.get('amount')).toMatchObject({from:1000000});
 });
});
