import { pageFilesById } from '../../../tools/scripts/page-files.mjs';
import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {type DisplayInputsSnapshot} from '@metriccanvas/page/internal';
import {createSourceProgram} from '../src/source-program/session';
import {initialFilterValues} from '../src/filter-values';
import {filterCandidatesRequest} from '../src/filter-candidates';
const load=(name='time-modes')=>{const p=parsePage(JSON.parse(readFileSync(pageFilesById('pages').get(`ioc-header-${name}-demo`)!,'utf8')));if(!p.ok)throw Error(JSON.stringify(p.errors));return p.page;};
const facts:DisplayInputsSnapshot={permissions:{},values:{},permissionRevision:'u1',timeZone:'Asia/Shanghai',periods:{sales:{status:'ready',granularity:'month',latest:'2026-10',latestComplete:'2026-09'}}};
const collect=async(program:ReturnType<typeof createSourceProgram>,request:Parameters<ReturnType<typeof createSourceProgram>['read']>[0])=>{const result=[];for await(const update of program.read(request))result.push(update);return result;};
describe('B4 execution boundaries',()=>{
 it.each([['day','2026-10-01','2026-10-07','day'],['month','2026-08','2026-09','month'],['isoWeek','2026-10-05','2026-10-11','week']])('executes full static %s case and never reuses unproved seeds',async(mode,from,to,period)=>{
  const page=load(),values=initialFilterValues(page.filters??[]);values.set('period',{type:'timeRange',mode:mode as 'day'|'month'|'isoWeek',from,to});
  const fetchData=vi.fn(async(..._args:unknown[])=>({rows:[],totalCount:0})),program=createSourceProgram(page,{gateway:{fetchData}});
  expect(program.initialSnapshots({roots:['bound'],conditions:values}).get('bound')).toEqual({status:'loading'});
  await collect(program,{roots:['bound'],conditions:values,seeds:new Map([['bound',{status:'ready',rows:[]}]]),useInitial:true});
  expect(fetchData).toHaveBeenCalledOnce();expect(fetchData.mock.calls[0][0]).toMatchObject({body:{dsl_list:[{filter:{time:{period}}}]},filterValues:[{target:'time',value:{from,to}}]});program.dispose();
 });
 it('rejects a captured query for another mode before executing',async()=>{
  const page=load(),values=initialFilterValues(page.filters??[]),fetchData=vi.fn(async()=>({rows:[],totalCount:0})),program=createSourceProgram(page,{gateway:{fetchData}}),captured=program.captureQueries(values,new Map(),new Map());
  values.set('period',{type:'timeRange',mode:'month',from:'2026-08',to:'2026-09'});await expect(collect(program,{roots:['bound'],conditions:values,queries:captured})).rejects.toMatchObject({code:'DQE_QUERY_REJECTED'});expect(fetchData).not.toHaveBeenCalled();program.dispose();
 });
 it.each(['loading','empty','unavailable','error','stale','over-max','missing-complete'])('blocks %s facts before seeds while independent queries continue',async(kind)=>{
  const page=load('availability'),snapshot=structuredClone(facts),values=initialFilterValues(page.filters??[],new Date(2026,9,19),facts);
  if(['loading','empty','unavailable','error'].includes(kind))snapshot.periods={sales:{status:kind as 'loading'}};
  if(kind==='stale')snapshot.periods={sales:{status:'ready',granularity:'month',latest:'2026-10',filterRevision:2}};
  if(kind==='over-max')values.set('month',{type:'timePoint',granularity:'month',value:'2026-11'});
  if(kind==='missing-complete'){const f=page.filters![0];if(f.type==='timePoint')f.availability!.max='latestComplete';snapshot.periods={sales:{status:'ready',granularity:'month',latest:'2026-10'}};}
  const fetchData=vi.fn(async()=>({rows:[],totalCount:0})),program=createSourceProgram(page,{gateway:{fetchData},displayInputs:()=>snapshot,filterRevision:()=>1});
  const result=await collect(program,{roots:['bound','unbound'],conditions:values,seeds:new Map([['bound',{status:'ready',rows:[]}]])});expect(fetchData).toHaveBeenCalledOnce();expect(result.find(x=>x.sourceId==='bound')).toMatchObject({candidateRejected:true,snapshot:{status:'error'}});program.dispose();
 });
 it('uses calendar windows and mode/full upstream context without filling gaps',()=>{
  const page=load('calendar-window'),values=initialFilterValues(page.filters??[]),filter=page.filters!.find(f=>f.id==='months')!;if(filter.type!=='dimension')throw Error();
  const request=filterCandidatesRequest(filter,page.filters!,values,undefined,{displayInputs:facts,now:new Date(2026,9,19)});expect(request.calendarWindow).toEqual({granularity:'month',from:'2025-11',to:'2026-10'});expect(request.factRevision).toContain('2026-10');
  const model=page.filters!.find(f=>f.id==='model')!;if(model.type!=='dimension')throw Error();expect(filterCandidatesRequest(model,page.filters!,values).constraints).toMatchObject({dimensions:{ioc_b4_month:['2026-01','2026-03']},times:{period:{mode:'month',from:'2026-01',to:'2026-03'}}});
 });
 it('does not fall back to a legacy dimension port when calendarWindow alone requires V2',async()=>{
  const page=load('calendar-window'),fetchData=vi.fn(async()=>({rows:[],totalCount:0})),fetchDimensionValues=vi.fn();const program=createSourceProgram(page,{gateway:{fetchData,fetchDimensionValues},displayInputs:()=>facts});
  const result=await collect(program,{roots:['bound'],conditions:initialFilterValues(page.filters??[])});expect(result[0].candidateRejected).toBe(true);expect(fetchDimensionValues).not.toHaveBeenCalled();expect(fetchData).not.toHaveBeenCalled();program.dispose();
 });
});
it('rebuilds captured temporal predicates from frozen conditions and rejects invalid calendar ranges',async()=>{
 const page=load('time-presets'),values=initialFilterValues(page.filters??[]),fetchData=vi.fn(async(..._args:unknown[])=>({rows:[],totalCount:0})),program=createSourceProgram(page,{gateway:{fetchData}}),queries=program.captureQueries(values,new Map(),new Map());
 queries.get('bound')!.filterValues=[{target:'time',value:{from:'2030-01-01',to:'2030-12-31'}}];await collect(program,{roots:['bound'],conditions:values,queries});expect(fetchData.mock.calls[0][0]).toMatchObject({filterValues:[{target:'time',value:{from:'2026-10-01',to:'2026-10-07'}}]});
 values.set('period',{type:'timeRange',from:'2026-10-07',to:'2026-10-01'});const result=await collect(program,{roots:['bound'],conditions:values,queries});expect(result[0].candidateRejected).toBe(true);expect(fetchData).toHaveBeenCalledOnce();program.dispose();
});
it('uses a frozen read/capture clock throughout effective compilation',async()=>{
 const page=load(),values=initialFilterValues(page.filters??[]),fetchData=vi.fn(async(..._args:unknown[])=>({rows:[],totalCount:0}));values.set('period',{type:'timeRange',mode:'day',from:'2030-10-01',to:'2030-10-07'});
 const program=createSourceProgram(page,{gateway:{fetchData},now:new Date(2030,9,19)});const queries=program.captureQueries(values,new Map(),new Map());await collect(program,{roots:['bound'],conditions:values,queries});expect(fetchData).toHaveBeenCalledOnce();program.dispose();
});
it('one-shot execution writes fresh mode rows and removes old unproved rows after a failed read',async()=>{
 const {createPageDataExecutor}=await import('../src/execute');const raw=JSON.parse(readFileSync('pages/capabilities/ioc-header/scenarios/ioc-header-time-modes-demo.json','utf8'));raw.dataSources.bound.source.initial={capturedAt:'2026-10-19T00:00:00Z',rows:[{ioc_header_scope:'old',ioc_header_count:9}],totalCount:1};
 const result=await createPageDataExecutor({now:new Date(2026,9,19),gateway:{async fetchData(){return {rows:[{scope:'fresh',count:1}],totalCount:1};}}}).execute(raw);expect(result.dataSources.bound.source).toMatchObject({initial:{rows:[{ioc_header_scope:'fresh',ioc_header_count:1}],totalCount:1}});
 const failed=await createPageDataExecutor({now:new Date(2026,9,19),gateway:{async fetchData(){throw Error('failed');}}}).execute(raw);expect('initial' in failed.dataSources.bound.source).toBe(false);
});
