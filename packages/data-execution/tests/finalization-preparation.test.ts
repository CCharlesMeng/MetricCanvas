import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import type {Page} from '@metriccanvas/page/internal';
import {createFinalizationPreparation} from '../src/finalization-preparation';
import {createFilterState} from '../../engine/runtime/src/filter-state';
import type {RuntimeDataGateway,DataGatewayResult} from '../src/ports';
import type {FilterValues} from '../src/filter-values';
import {requiredMinorVersion,versionErrors,versionPolicy} from '../../page/src/version';
function page(version='6.120'):Page {
  const value=JSON.parse(readFileSync('pages/capabilities/filters/ioc-async-preparation.json','utf8'));value.schemaVersion=version;return value;
}
function deferred<T>() {let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
const now=new Date(2026,10,14,12);
function gateway(promise:Promise<DataGatewayResult>):RuntimeDataGateway {
  return {finalizationSource:{body:{dsl_list:[{output_dims:['名称','日期'],filter:{}}]},nameField:'名称',dateField:'日期'},fetchData:vi.fn(()=>promise)};
}
const result={rows:[{name:'合成经营数据',date:'2026-04-18'}],totalCount:1};
it('native initialization stays pending until the final date is installed with its gate',async()=>{
  const receipt=deferred<DataGatewayResult>(),base=gateway(receipt.promise),document=page();
  const preparation=createFinalizationPreparation(document,base,new Map(),now,new AbortController().signal);
  expect(await preparation.initialDates()).toBeUndefined();expect(base.fetchData).not.toHaveBeenCalled();
  const state=createFilterState(new Map(),document.filters);state.preparing('mtime',true);
  expect(state.blocked().has('mtime')).toBe(true);
  const pending=preparation.resolve();expect(base.fetchData).toHaveBeenCalledTimes(1);receipt.resolve(result);
  state.completePreparation(preparation.values(await pending));
  expect(state.blocked().has('mtime')).toBe(false);
  expect(state.toURL()).toContain('2026-04');expect(state.preparation().size).toBe(0);
});
it('an explicit quarter has no pending default while the finalization date loads',async()=>{
  const base=gateway(Promise.resolve(result));
  const explicit:FilterValues=new Map([['mtime',{type:'timeRange',from:'2026-01',to:'2026-03',selection:{mode:'quarter',value:'2026-Q1'}}]]);
  const preparation=createFinalizationPreparation(page(),base,explicit,now,new AbortController().signal);
  expect(preparation.pending.size).toBe(0);
  expect(preparation.values(await preparation.resolve())).toEqual(new Map());
  expect(base.fetchData).toHaveBeenCalledTimes(1);
});
function month(value: string): import('../src/filter-values').TimeRangeFilterValue {
  return {type:'timeRange',from:value,to:value,selection:{mode:'month',value}};
}

it.each([['2026-03','2026-03'],['2026-04','2026-04'],['2026-11','2026-04']])(
  'validates an explicit month %s before applying %s', async (requested, applied)=>{
    const document=page(), base=gateway(Promise.resolve(result));
    const preparation=createFinalizationPreparation(document,base,new Map([['mtime',month(requested)]]),now,new AbortController().signal);
    expect(preparation.immediate.has('mtime')).toBe(false);
    expect(preparation.pending.has('mtime')).toBe(true);
    expect(preparation.values(await preparation.resolve()).get('mtime')).toEqual(month(applied));
  }
);

it('applies an explicit legal month without waiting when the gateway has no finalization source',async()=>{
  const document=page();
  const value=month('2026-03');
  const base:RuntimeDataGateway={fetchData:vi.fn()};
  const preparation=createFinalizationPreparation(document,base,new Map([['mtime',value]]),now,new AbortController().signal);
  expect(preparation.pending.has('mtime')).toBe(false);
  expect(preparation.immediate.get('mtime')).toEqual(value);
  expect(await preparation.initialDates()).toEqual(new Map());
  expect(base.fetchData).not.toHaveBeenCalled();
});

it('rejects programmatic writes while the cutoff loads and beyond the finalized month',()=>{
  let dates:ReadonlyMap<string,string>|undefined;
  const state=createFilterState(new Map(),page().filters,new Map(),{now:()=>now,finalizationDates:()=>dates});
  state.preparing('mtime',true);
  expect(state.commit({type:'set',filterId:'mtime',value:month('2026-11')}).ok).toBe(false);
  expect(state.blocked().has('mtime')).toBe(true);
  dates=new Map([['合成经营数据','2026-04-18']]);
  state.completePreparation(new Map([['mtime',month('2026-04')]]));
  expect(state.commit({type:'set',filterId:'mtime',value:month('2026-11')}).ok).toBe(false);
  state.fromURL('mtime=month:2026-11',page().filters!);
  expect(state.toURL()).toContain('2026-04');
  expect(state.commit({type:'set',filterId:'mtime',value:month('2026-03')}).ok).toBe(true);
});

it('uses a mode-only rolling input as the pending selection',async()=>{
  const base=gateway(Promise.resolve(result));
  const preparation=createFinalizationPreparation(page(),base,new Map(),now,new AbortController().signal,undefined,new Set(['mtime']));
  expect(preparation.pending.has('mtime')).toBe(true);
  expect(preparation.values(await preparation.resolve()).get('mtime')).toMatchObject({
    from:'2025-05',to:'2026-04',selection:{mode:'last12Months',anchor:'2026-04'}
  });
});
it('older pages still wait for the existing initialization query',async()=>{
  const receipt=deferred<DataGatewayResult>(),base=gateway(receipt.promise);
  const preparation=createFinalizationPreparation(page('6.119'),base,new Map(),now,new AbortController().signal);
  const pending=preparation.initialDates();expect(base.fetchData).toHaveBeenCalledTimes(1);
  expect(preparation.pending.size).toBe(0);receipt.resolve(result);expect((await pending).get('合成经营数据')).toBe('2026-04-18');
});
it('a user selection made while the default is loading wins over a late result',async()=>{
  const state=createFilterState(new Map(),page().filters);state.preparing('mtime',true);
  state.write('mtime',{type:'timeRange',from:'2026-01',to:'2026-03',selection:{mode:'quarter',value:'2026-Q1'}});
  state.completePreparation(new Map([['mtime',{type:'timeRange',from:'2026-04',to:'2026-04'}]]));
  expect(state.toURL()).toContain('2026-Q1');expect(state.preparation().size).toBe(0);
});
it('cancellation does not publish the current-date fallback',async()=>{
  const receipt=deferred<DataGatewayResult>(),controller=new AbortController();
  const preparation=createFinalizationPreparation(page(),gateway(receipt.promise),new Map(),now,controller.signal);
  const pending=preparation.resolve();controller.abort(new Error('page disposed'));
  await expect(pending).rejects.toThrow('page disposed');receipt.resolve(result);
});
it('nonblocking time defaults have an explicit capability floor even without an IOC boolean',()=>{
  const document=page();document.filters=document.filters!.filter(filter=>filter.type!=='boolean');
  expect(requiredMinorVersion(document)).toBe(120);
  expect(versionErrors(document,{...versionPolicy,minor:119,current:'6.119'})).not.toEqual([]);
  document.schemaVersion='6.119';expect(requiredMinorVersion(document)).toBe(104);
});
