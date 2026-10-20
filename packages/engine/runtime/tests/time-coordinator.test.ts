import {readFileSync} from 'node:fs';
import {it,expect,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {type DisplayInputsSnapshot} from '@metriccanvas/page/internal';
import {createFilterState,initialFilterValues,parseFilterSearch} from '../src/filter-state';
import {orchestrate} from '../src/orchestrator';
const load=(name='time-modes')=>{const p=parsePage(JSON.parse(readFileSync(`pages/ioc-header-${name}-demo.json`,'utf8')));if(!p.ok)throw Error(JSON.stringify(p));return p.page;};
it('serializes mode/from/to atomically, validates ISO weeks and prevents readonly writes',()=>{
 const page=load(),state=createFilterState(initialFilterValues(page.filters??[]),page.filters);let events=0;state.subscribe(()=>events++);
 expect(state.commit({type:'set',filterId:'period',value:{type:'timeRange',mode:'isoWeek',from:'2026-10-06',to:'2026-10-12'}}).ok).toBe(false);expect(events).toBe(1);
 expect(state.commit({type:'set',filterId:'period',value:{type:'timeRange',mode:'month',from:'2026-01',to:'2026-03'}}).ok).toBe(true);expect(events).toBe(2);expect(state.toURL()).toBe('period.mode=month&period.from=2026-01&period.to=2026-03');
 expect(parseFilterSearch(state.toURL(),page.filters!)).toEqual(new Map([['period',{type:'timeRange',mode:'month',from:'2026-01',to:'2026-03'}]]));
 const readonly=createFilterState(initialFilterValues(page.filters??[]),page.filters,new Map(),{readOnly:()=>true});expect(readonly.commit({type:'set',filterId:'period',value:{type:'timeRange',mode:'month',from:'2026-01',to:'2026-03'}}).ok).toBe(false);
});
it('blocks missing trusted initial values and initializes once without rejecting other pending required fields',()=>{
 const page=load('availability'),loading:DisplayInputsSnapshot={permissions:{},values:{},permissionRevision:'u1',timeZone:'Asia/Shanghai',periods:{sales:{status:'loading'}}};let snapshot=loading;
 const state=createFilterState(initialFilterValues(page.filters??[],new Date(),snapshot),page.filters,new Map(),{displayInputs:()=>snapshot});expect([...state.blocked()]).toContain('month');
 snapshot={...loading,periods:{sales:{status:'ready',granularity:'month',latest:'2026-10',latestComplete:'2026-09'}}};expect(state.commit({type:'initialize',values:initialFilterValues(page.filters??[],new Date(),snapshot)}).ok).toBe(true);expect([...state.blocked()]).toEqual([]);
});
it('refreshes only the fact-bound source and aborts old reads when facts change without a selection change',async()=>{
 const page=load('availability');let snapshot:DisplayInputsSnapshot={permissions:{},values:{},permissionRevision:'u1',timeZone:'Asia/Shanghai',periods:{sales:{status:'ready',granularity:'month',latest:'2026-10',latestComplete:'2026-09'}}};
 const fetchData=vi.fn(async(..._args:unknown[])=>({rows:[],totalCount:0}));const state=createFilterState(initialFilterValues(page.filters??[],new Date(),snapshot),page.filters,new Map(),{displayInputs:()=>snapshot});
 const stream=orchestrate(page,{fetchData},state,undefined,undefined,{displayInputs:()=>snapshot,filterRevision:()=>state.revision});const stop=stream.subscribe(()=>{});await new Promise(r=>setTimeout(r,0));expect(fetchData).toHaveBeenCalledTimes(2);
 snapshot={...snapshot,periods:{sales:{status:'ready',granularity:'month',latest:'2026-09',latestComplete:'2026-08'}}};state.refreshContext();await new Promise(r=>setTimeout(r,0));expect(fetchData).toHaveBeenCalledTimes(3);expect(fetchData.mock.calls.at(-1)?.[1]).toMatchObject({dataSourceIds:['bound']});stop();
});
it('the public orchestrate path initializes availability without an external filter state',async()=>{
 const page=load('availability'),snapshot:DisplayInputsSnapshot={permissions:{},values:{},permissionRevision:'u1',timeZone:'Asia/Shanghai',periods:{sales:{status:'ready',granularity:'month',latest:'2026-10',latestComplete:'2026-09'}}};const fetchData=vi.fn(async(..._args:unknown[])=>({rows:[],totalCount:0}));const stream=orchestrate(page,{fetchData},undefined,undefined,undefined,{displayInputs:()=>snapshot,now:new Date(2026,9,19)});const stop=stream.subscribe(()=>{});await new Promise(r=>setTimeout(r,0));expect(fetchData).toHaveBeenCalledTimes(2);expect(fetchData.mock.calls.find(args=>(args[1] as any).dataSourceIds.includes('bound'))?.[0]).toMatchObject({filterValues:[{target:'dimension',queryField:'sales_month',values:['2026-09']}]});stop();
});
