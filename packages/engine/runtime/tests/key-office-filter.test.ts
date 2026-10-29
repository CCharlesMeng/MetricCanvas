import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parsePage} from '../../../page/src/validate';
import {filterExtensionErrors} from '../../../page/src/filter-dependencies';
import {capabilityFloorErrors} from '../../../page/src/version';
import {filterCandidatesRequest,candidateContextKey} from '../../../data-execution/src/filter-candidates';
import {createFilterState,initialFilterValues,type FilterValues} from '../src/filter-state';
import {createDimensionValuesLoader} from '../src/dimension-values';
import {compilePresentation} from '../src/presentation';
import {createSharedFilterBridge} from '../../../embed/examples/shared-filter-bridge';
import {createKeyOfficeGateway} from '../../../../apps/playground/fixtures/key-office-filter/gateway';
import type {FilterDeclaration,DimensionFilterDeclaration} from '../../../page/src/filter';
import type {FilterCandidatesRequest,FilterCandidatesResult} from '../src/ports';
const raw=JSON.parse(readFileSync('pages/capabilities/filters/key-office-filter-demo.json','utf8'));
const parsed=parsePage(raw);if(!parsed.ok)throw new Error(JSON.stringify(parsed.errors));
const page=parsed.page,filters=page.filters!,office=filters.find(f=>f.id==='region') as DimensionFilterDeclaration;
const key=(value:boolean)=>new Map<string,import("../src/filter-state").FilterValue>([['key-office',{type:'boolean',value}]]);
const dimension=(values:string[])=>({type:'dimension' as const,dimension:'demo_office',level:'office',values});

describe('boolean candidate declaration and input',()=>{
 it('validates the complete demo and rejects new capabilities in old versions',()=>{
  expect(parsePage(raw).ok).toBe(true);
  const errors=capabilityFloorErrors({...raw,schemaVersion:'6.73'});
  expect(errors.some(e=>e.path==='/filters/1')).toBe(true);
  expect(errors.some(e=>e.path==='/filters/0')).toBe(true);
 });
 it('keeps invalid dependencies, cycles and illegal condition references rejected',()=>{
  expect(filterExtensionErrors([...filters,{id:'bad',type:'dimension',dimension:'bad',candidateContext:{filterIds:['missing'],reconcile:'intersection'}}]).length).toBeGreaterThan(0);
  const copy=structuredClone(raw);copy.filters[1].enabledWhen.filter='missing';expect(parsePage(copy).ok).toBe(false);
  const search:FilterDeclaration={id:'search',type:'search'};
  expect(filterExtensionErrors([search,{...office,candidateContext:{filterIds:['search'],reconcile:'intersection'}}]).length).toBeGreaterThan(0);
  expect(filterExtensionErrors([{...office,candidateContext:{filterIds:['rep-office'],reconcile:'intersection'}}]).length).toBeGreaterThan(0);
 });
 it.each([true,false])('serializes explicit %s and changes the context key',value=>{
  expect(filterCandidatesRequest(office,filters,key(value)).constraints.booleans).toEqual({'key-office':value});
  expect(candidateContextKey(office,filters,key(value))).not.toBe(candidateContextKey(office,filters,new Map()));
 });
 it('does not send undeclared booleans and preserves default:false compatibility',()=>{
  const values=key(true);values.set('private',{type:'boolean',value:true});
  expect(filterCandidatesRequest(office,filters,values).constraints.booleans).toEqual({'key-office':true});
  expect(initialFilterValues([{id:'key-office',type:'boolean',default:false}]).size).toBe(0);
 });
 it('collects transitive boolean dependencies',()=>{
  const middle:DimensionFilterDeclaration={id:'middle',type:'dimension',dimension:'middle',candidateContext:{filterIds:['key-office'],reconcile:'intersection'}};
  const target={...office,candidateContext:{filterIds:['middle'],reconcile:'intersection' as const}};
  expect(filterCandidatesRequest(target,[...filters,middle],key(false)).constraints.booleans).toEqual({'key-office':false});
 });
});

describe('candidate reconciliation and legality gate',()=>{
 function state(selected?:string[]){
  const input=key(false);if(selected)input.set('region',dimension(selected));
  // Generic non-IOC multi-selection still uses the same coordinator.
  const declarations=filters.map(f=>f.id==='region'&&f.type==='dimension'?{...f,selection:{mode:'multiple' as const}}:f);
  const state=createFilterState(input,declarations,new Map(),{candidates:true});
  state.candidate('region','ready',['A1','A2']);return state;
 }
 it('continues after a nonempty receipt when no office was previously selected',()=>{
  const s=state();s.write('key-office',{type:'boolean',value:true});expect(s.blocked().has('region')).toBe(true);
  s.candidate('region','ready',['A1']);expect(s.blocked().has('region')).toBe(false);
 });
 it('keeps the valid intersection',()=>{
  const s=state(['A1','A2']);s.write('key-office',{type:'boolean',value:true});s.candidate('region','ready',['A1']);
  expect(s.toURL()).toContain('region=A1');expect(s.toURL()).not.toContain('A2');expect(s.blocked().has('region')).toBe(false);
 });
 it('requires explicit confirmation after losing a selection, including another upstream change',()=>{
  const s=state(['A2']);s.write('key-office',{type:'boolean',value:true});s.candidate('region','ready',['A1']);
  expect(s.blocked().has('region')).toBe(true);
  s.write('key-office',{type:'boolean',value:false});s.candidate('region','ready',['A1','A2']);expect(s.blocked().has('region')).toBe(true);
  s.write('region',null);expect(s.blocked().has('region')).toBe(false);
 });
 it.each(['empty','error','unavailable','denied','unconfigured'] as const)('does not broaden on %s',status=>{
  const s=state();s.write('key-office',{type:'boolean',value:true});s.candidate('region',status);expect(s.blocked().has('region')).toBe(true);
 });
 it('enables through the unified presentation gate without changing existing values',()=>{
  const program=compilePresentation(page);expect(program.evaluate({filters:key(true)}).gate(filters[1]).enabled).toBe(false);
  const values=key(true);values.set('region',{type:'dimension',dimension:'demo_region',level:'region-dept',values:['A']});
  expect(program.evaluate({filters:values}).gate(filters[1]).enabled).toBe(true);expect(values.get('key-office')).toEqual({type:'boolean',value:true});
 });
});

it('loader sends booleans, cancels stale responses and isolates false from true cache',async()=>{
 const pending:Array<{request:FilterCandidatesRequest;signal:AbortSignal;resolve:(result:FilterCandidatesResult)=>void}>=[];
 const loader=createDimensionValuesLoader({async fetchData(){return {rows:[]};},fetchFilterCandidates(request,{signal}){return new Promise(resolve=>pending.push({request,signal,resolve}));}});
 let latest:any;loader.subscribe(value=>latest=[...value.values()].at(-1));
 loader.loadFilter(filterCandidatesRequest(office,filters,key(true)),'true');
 loader.loadFilter(filterCandidatesRequest(office,filters,key(false)),'false');
 expect(pending.map(p=>p.request.constraints.booleans)).toEqual([{'key-office':true},{'key-office':false}]);expect(pending[0].signal.aborted).toBe(true);
 pending[1].resolve({kind:'values',candidates:[{value:'A2',label:'ordinary'}]});await Promise.resolve();
 pending[0].resolve({kind:'values',candidates:[{value:'A1',label:'key'}]});await Promise.resolve();expect(latest.candidates[0].value).toBe('A2');
 loader.loadFilter(filterCandidatesRequest(office,filters,key(true)),'true');expect(pending).toHaveLength(3);loader.dispose();expect(pending[2].signal.aborted).toBe(true);
});

describe('host shared filter example',()=>{
 const bindings={'key-office':'key-office',region:'region',mtime:'mtime'};
 it('carries true and false, preserves explicit URL and nonfilter parameters, and records clears',()=>{
  const bridge=createSharedFilterBridge();bridge.recordSearch(filters,'key-office=true&region=A&mtime=2026-09&rep-office=A1',bindings);
  const next=new URLSearchParams(bridge.initialSearch(filters,'heading=keep&key-office=false',bindings));
  expect(next.get('key-office')).toBe('false');expect(next.get('region')).toBe('A');expect(next.get('heading')).toBe('keep');expect(next.has('rep-office')).toBe(false);
  bridge.recordSearch(filters,'key-office=false',bindings);expect(bridge.initialSearch(filters,'',bindings)).toBe('key-office=false');
 });
 it('maps IDs and rejects incompatible dimensions and precision',()=>{
  const bridge=createSharedFilterBridge();bridge.recordSearch(filters,'key-office=true&region=A&mtime=2026-09',bindings);
  expect(bridge.initialSearch([{id:'other',type:'boolean'}],'',{'key-office':'other'})).toBe('other=true');
  expect(bridge.initialSearch([{id:'region',type:'dimension',dimension:'different'},{id:'mtime',type:'timePoint',granularity:'date'}],'',bindings)).toBe('');
  bridge.recordSearch([],'',bindings);expect(bridge.snapshot()['key-office'].parts.value).toEqual(['true']);
 });
});

it('synthetic Adapter restores all offices when the checkbox is cancelled',async()=>{
 const gateway=createKeyOfficeGateway(),controller=new AbortController();
 const yes=await gateway.fetchFilterCandidates!(filterCandidatesRequest(office,filters,key(true)),{signal:controller.signal});
 const no=await gateway.fetchFilterCandidates!(filterCandidatesRequest(office,filters,key(false)),{signal:controller.signal});
 expect(yes.kind==='values'&&yes.candidates.map(c=>c.value)).toEqual(['A','B','A1','B1']);
 expect(no.kind==='values'&&no.candidates.map(c=>c.value)).toEqual(['A','B','A1','A2','B1','B2']);
});
