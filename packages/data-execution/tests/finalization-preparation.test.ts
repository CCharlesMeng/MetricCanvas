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
  expect(await preparation.initialDates()).toEqual(new Map());expect(base.fetchData).not.toHaveBeenCalled();
  const state=createFilterState(new Map(),document.filters);state.preparing('mtime',true);
  expect(state.blocked().has('mtime')).toBe(true);
  const pending=preparation.resolve();expect(base.fetchData).toHaveBeenCalledTimes(1);receipt.resolve(result);
  state.completePreparation(preparation.values(await pending));
  expect(state.blocked().has('mtime')).toBe(false);
  expect(state.toURL()).toContain('2026-04');expect(state.preparation().size).toBe(0);
});
it('explicit time skips the default request',async()=>{
  const base=gateway(Promise.resolve(result));
  const explicit:FilterValues=new Map([['mtime',{type:'timeRange',from:'2026-03',to:'2026-03'}]]);
  const preparation=createFinalizationPreparation(page(),base,explicit,now,new AbortController().signal);
  expect(preparation.pending.size).toBe(0);await preparation.resolve();expect(base.fetchData).not.toHaveBeenCalled();
});
it('older pages still wait for the existing initialization query',async()=>{
  const receipt=deferred<DataGatewayResult>(),base=gateway(receipt.promise);
  const preparation=createFinalizationPreparation(page('6.119'),base,new Map(),now,new AbortController().signal);
  const pending=preparation.initialDates();expect(base.fetchData).toHaveBeenCalledTimes(1);
  expect(preparation.pending.size).toBe(0);receipt.resolve(result);expect((await pending).get('合成经营数据')).toBe('2026-04-18');
});
it('a user selection made while the default is loading wins over a late result',async()=>{
  const state=createFilterState(new Map(),page().filters);state.preparing('mtime',true);
  state.write('mtime',{type:'timeRange',from:'2026-03',to:'2026-03',selection:{mode:'month',value:'2026-03'}});
  state.completePreparation(new Map([['mtime',{type:'timeRange',from:'2026-04',to:'2026-04'}]]));
  expect(state.toURL()).toContain('2026-03');expect(state.preparation().size).toBe(0);
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
