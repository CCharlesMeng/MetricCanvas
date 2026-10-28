import {expect,it} from 'vitest';
import {hierarchyFixture,hierarchySim,choose} from './hierarchy-fixture';
import {resolveHierarchySelection,hierarchyRows,rowExpansionFilters,createHierarchySelectionSession} from '../src/table/hierarchy-selection';
import {createRowExpansionController} from '../src/table/expansion';
import {orchestrate} from '../src/orchestrator';
import {createFilterState} from '../src/filter-state';
import {initialQuerySourceIds} from '../../../data-execution/src/source-scope';
const parent={'row-id':1,'region-id':'R01','region-name':'华东',amount:1200};
it('executes only the complete parent on first screen and keeps selection out of parent inputs',async()=>{
 const {page,filters}=hierarchyFixture(),sim=await hierarchySim();
 const calls:string[]=[];const gateway={...sim.gateway,fetchData:((q,c,s)=>{calls.push(c!.dataSourceIds![0]);return sim.gateway.fetchData(q,c,s);}) as typeof sim.gateway.fetchData};
 const state=createFilterState(filters,page.filters??[]);const stream=orchestrate(page,gateway,state);const stop=stream.subscribe(()=>{});
 try{expect(initialQuerySourceIds(page)).toEqual(['region-summary']);await expect.poll(()=>stream.captureRawSnapshots().get('region-summary')?.status).toBe('ready');expect(calls).toEqual(['region-summary']);state.write('region',{type:'dimension',dimension:'h_office',level:'office',values:['O101']});await new Promise(r=>setTimeout(r,5));expect(calls).toEqual(['region-summary']);expect(stream.captureRawSnapshots().get('region-summary')).toMatchObject({status:'ready',rows:expect.any(Array)});}finally{stop();await sim.close();}
});
it('locates an office explicitly, projects a numeric-keyed parent and injects a private child input',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();
 try{
  const selected=choose(filters,'O101');const context={filters:selected,params:new Map()};
  const receipt=await resolveHierarchySelection(page,table,sim.gateway,context,new AbortController().signal);
  expect(receipt).toMatchObject({status:'selected',parentValue:'R01',childValue:'O101'});
  expect(hierarchyRows(table,[parent,{'row-id':2,'region-id':'R02'}],receipt)).toEqual([parent]);
  const values=rowExpansionFilters(page,table,parent,context,receipt);expect(values.get('detail-office')).toMatchObject({values:['O101']});expect(selected.has('detail-office')).toBe(false);
  expect(()=>hierarchyRows(table,[parent,{...parent,'row-id':99}],receipt)).toThrow('多行');
  expect(()=>rowExpansionFilters(page,table,{'region-id':'R02'},context,receipt)).toThrow('不匹配');
 }finally{await sim.close();}
});
it.each([['O-empty','unresolved'],['O-multi','ambiguous']])('fails closed for %s',async(office,status)=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();
 try{const receipt=await resolveHierarchySelection(page,table,sim.gateway,{filters:choose(filters,office),params:new Map()},new AbortController().signal);expect(receipt.status).toBe(status);expect(hierarchyRows(table,[parent],receipt)).toEqual([]);}finally{await sim.close();}
});
it('rejects illegal candidates, lookup failure and unavailable candidate evidence',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();
 try{
  const run=(office:string,gateway:import('../src').RuntimeDataGateway=sim.gateway)=>resolveHierarchySelection(page,table,gateway,{filters:choose(filters,office),params:new Map()},new AbortController().signal);
  const empty=new Map(filters);empty.set('region',{type:'dimension',dimension:'h_office',level:'office',values:['']});await expect(resolveHierarchySelection(page,table,sim.gateway,{filters:empty,params:new Map()},new AbortController().signal)).rejects.toThrow('稳定值');
  await expect(run('unknown')).rejects.toThrow();await expect(run('O-error')).rejects.toThrow();
  await expect(run('O101',{...sim.gateway,fetchFilterCandidates:async()=>({kind:'denied' as const})})).rejects.toThrow();
 }finally{await sim.close();}
});
it('preserves expansion and committed child state on common refresh, resets its page before one request and honors manual collapse',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();
 const calls:number[]=[];const gateway={...sim.gateway,fetchData:((q,c,s)=>{calls.push(q.pagination?.offset??-1);return sim.gateway.fetchData(q,c,s);}) as typeof sim.gateway.fetchData};
 const control=createRowExpansionController(page,table,gateway,filters,new Map(),()=>{});
 try{
  control.sync([parent],{filters,params:new Map()},{status:'unrestricted',identity:'null'});control.toggle(parent);
  await expect.poll(()=>control.get(parent)?.snapshots.get('office-detail')?.status).toBe('ready');
  const instance=control.get(parent)!;instance.stream!.setQueryPage('office-detail',1);
  await expect.poll(()=>instance.snapshots.get('office-detail')?.status).toBe('ready');
  const changed=new Map(filters);changed.set('year',{type:'dimension',dimension:'h_year',values:['2025']});const before=calls.length;
  control.sync([{...parent,amount:960}],{filters:changed,params:new Map()},{status:'unrestricted',identity:'null'});
  await expect.poll(()=>instance.snapshots.get('office-detail')?.status).toBe('ready');
  expect(control.get(parent)).toBe(instance);expect(instance.stream!.getQueryView('office-detail')?.pageIndex).toBe(0);expect(calls.slice(before)).toEqual([0]);
  control.toggle(parent);control.sync([parent],{filters,params:new Map()},{status:'unrestricted',identity:'null'});expect(control.get(parent)).toBeUndefined();
 }finally{control.dispose();await sim.close();}
});
it('auto-opens once for a logical child choice and removes the optional input for a parent choice',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();const selected=choose(filters,'O101');
 const receipt={status:'selected' as const,identity:'office-O101',parentValue:'R01',childValue:'O101'};
 const control=createRowExpansionController(page,table,sim.gateway,selected,new Map(),()=>{});
 try{
  control.sync([parent],{filters:selected,params:new Map()},receipt);await expect.poll(()=>control.get(parent)?.snapshots.get('office-detail')?.status).toBe('ready');
  expect(control.get(parent)!.snapshots.get('office-detail')).toMatchObject({rows:[{'office-id':'O101',amount:360}],totalCount:1});
  control.toggle(parent);control.sync([parent],{filters:selected,params:new Map()},receipt);expect(control.get(parent)).toBeUndefined();
  const values=rowExpansionFilters(page,table,parent,{filters:choose(filters,'R01','region-dept'),params:new Map()},{status:'selected',identity:'p',parentValue:'R01'});expect(values.has('detail-office')).toBe(false);
 }finally{control.dispose();await sim.close();}
});
it('cancels stale lookup receipts and does not repeat lookup for unconsumed business conditions',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();let calls=0;
 const pending:Array<()=>void>=[];const gateway={...sim.gateway,async fetchData(...args:Parameters<typeof sim.gateway.fetchData>){calls++;await new Promise<void>(resolve=>pending.push(resolve));return sim.gateway.fetchData(...args);}};
 const session=createHierarchySelectionSession(page,table,gateway,()=>{});
 try{
  session.sync({filters:choose(filters,'O101'),params:new Map()});await expect.poll(()=>pending.length).toBe(1);
  session.sync({filters:choose(filters,'O201'),params:new Map()});await expect.poll(()=>pending.length).toBe(2);
  pending[1]!();await expect.poll(()=>session.snapshot().parentValue).toBe('R02');pending[0]!();await new Promise(r=>setTimeout(r,5));expect(session.snapshot().parentValue).toBe('R02');
  const next=choose(filters,'O201');next.set('year',{type:'dimension',dimension:'h_year',values:['2025']});session.sync({filters:next,params:new Map()});expect(calls).toBe(2);
 }finally{session.dispose();pending.forEach(done=>done());await sim.close();}
});
it('restores committed search, sort and page size before refreshing a child',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();const received:import('@metriccanvas/page/internal').EffectiveQuery[]=[];
 const gateway={...sim.gateway,fetchData:((q,c,s)=>{received.push(q);return sim.gateway.fetchData(q,c,s);}) as typeof sim.gateway.fetchData};
 const control=createRowExpansionController(page,table,gateway,filters,new Map(),()=>{}),context={filters,params:new Map()};
 try{
  control.sync([parent],context,{status:'unrestricted',identity:'null'});control.toggle(parent);
  await expect.poll(()=>control.get(parent)?.snapshots.get('office-detail')?.status).toBe('ready');
  const instance=control.get(parent)!;instance.stream!.setQuerySearch('office-detail',{fields:['office-name'],query:'上海'});
  instance.stream!.setQuerySort('office-detail',[{field:'amount',direction:'desc'}]);instance.stream!.setQueryPageSize('office-detail',1);
  await expect.poll(()=>instance.snapshots.get('office-detail')?.status).toBe('ready');
  const next=new Map(filters);next.set('year',{type:'dimension',dimension:'h_year',values:['2025']});const count=received.length;
  control.sync([{...parent,amount:960}],{filters:next,params:new Map()},{status:'unrestricted',identity:'null'});
  await expect.poll(()=>instance.snapshots.get('office-detail')?.status).toBe('ready');
  expect(received.slice(count)).toHaveLength(1);expect(received.at(-1)).toMatchObject({pagination:{offset:0,limit:1},search:{query:'上海'},sort:[{queryField:'h_child_amount',direction:'desc'}]});
 }finally{control.dispose();await sim.close();}
});
it('aborts a superseded child scope and discards an ignored-abort late response',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();
 type Result=Awaited<ReturnType<typeof sim.gateway.fetchData>>;
 const pending:Array<{signal?:AbortSignal;finish:(v:Result)=>void}>=[];
 const gateway={...sim.gateway,fetchData:((_q,_c,signal)=>new Promise<Result>(finish=>pending.push({signal,finish}))) as typeof sim.gateway.fetchData};
 const control=createRowExpansionController(page,table,gateway,filters,new Map(),()=>{});
 try{
  control.sync([parent],{filters,params:new Map()},{status:'unrestricted',identity:'null'});control.toggle(parent);await expect.poll(()=>pending.length).toBe(1);
  const next=new Map(filters);next.set('year',{type:'dimension',dimension:'h_year',values:['2025']});control.sync([parent],{filters:next,params:new Map()},{status:'unrestricted',identity:'null'});
  await expect.poll(()=>pending.length).toBe(2);expect(pending[0]!.signal!.aborted).toBe(true);
  pending[1]!.finish({rows:[{'office-id':'current','office-name':'当前',amount:2025}],totalCount:1});await expect.poll(()=>control.get(parent)?.snapshots.get('office-detail')?.status).toBe('ready');
  pending[0]!.finish({rows:[{'office-id':'late','office-name':'过期',amount:2026}],totalCount:1});await new Promise(r=>setTimeout(r,5));
  expect(control.get(parent)!.snapshots.get('office-detail')).toMatchObject({rows:[{'office-id':'current',amount:2025}]});
 }finally{control.dispose();await sim.close();}
});

it('moves a selected child to a newly located parent while preserving manual collapse intent',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim(),selected=choose(filters,'O101');
 const control=createRowExpansionController(page,table,sim.gateway,selected,new Map(),()=>{});
 const first={status:'selected' as const,identity:'office-O101',parentValue:'R01',childValue:'O101'},second={...first,parentValue:'R02'};
 const other={'row-id':2,'region-id':'R02',amount:900};
 try{
  control.sync([parent],{filters:selected,params:new Map()},first);expect(control.get(parent)).toBeDefined();
  control.sync([other],{filters:selected,params:new Map()},second);expect(control.get(parent)).toBeUndefined();expect(control.get(other)).toBeDefined();
  control.toggle(other);control.sync([parent],{filters:selected,params:new Map()},first);expect(control.get(parent)).toBeUndefined();
 }finally{control.dispose();await sim.close();}
});
it('keeps a 6.44 numeric-keyed query-paginated parent working without lookup requests',async()=>{
 const {parsePage}=await import('@metriccanvas/page');const {document}=hierarchyFixture(),sim=await hierarchySim();
 document.schemaVersion='6.44';delete document.iocHeader;delete document.dataSources['office-region-lookup'];document.filters=document.filters.filter((f:{id:string})=>f.id==='detail-region');
 const props=document.sections[0].components[0].props;delete props.rowExpansion.selection;delete props.toolbar.export;props.pagination={mode:'query'};
 props.rowExpansion.data.filters=['detail-region'];delete props.rowExpansion.data.bindings['detail-office'];
 const source=document.dataSources['region-summary'].source;delete source.resultScope;source.query.filterBindings={};source.query.body.dsl_list[0].order={offset:0,limit:2};
 delete document.dataSources['office-detail'].source.query.filterBindings.year;delete document.dataSources['office-detail'].source.query.filterBindings.product;delete document.dataSources['office-detail'].source.query.filterBindings['detail-office'];
 const parsed=parsePage(document);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));const page=parsed.page,table=page.sections[0]!.components[0] as import('@metriccanvas/page/internal').TableComponent;
 const calls:string[]=[];const gateway={...sim.gateway,fetchData:((q,c,s)=>{calls.push(c!.dataSourceIds![0]);return sim.gateway.fetchData(q,c,s);}) as typeof sim.gateway.fetchData};
 const stream=orchestrate(page,gateway),stop=stream.subscribe(()=>{}),control=createRowExpansionController(page,table,gateway,new Map(),new Map(),()=>{});
 try{
  await expect.poll(()=>stream.captureRawSnapshots().get('region-summary')?.status).toBe('ready');expect(calls).toEqual(['region-summary']);
  control.toggle(parent);await expect.poll(()=>control.get(parent)?.snapshots.get('office-detail')?.status).toBe('ready');expect(calls).toEqual(['region-summary','office-detail']);
  stream.setQueryPage('region-summary',1);await expect.poll(()=>stream.captureRawSnapshots().get('region-summary')?.status).toBe('ready');
  const snapshot=stream.captureRawSnapshots().get('region-summary');control.retain(snapshot?.status==='ready'?snapshot.rows:[]);expect(control.get(parent)).toBeUndefined();expect(calls).toEqual(['region-summary','office-detail','region-summary']);
 }finally{stop();control.dispose();await sim.close();}
});
it('gates a retained lookup receipt while candidates refresh without rerunning unchanged ownership',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();let calls=0;
 const gateway={...sim.gateway,async fetchData(...args:Parameters<typeof sim.gateway.fetchData>){calls++;return sim.gateway.fetchData(...args);}};
 const session=createHierarchySelectionSession(page,table,gateway,()=>{}),context={filters:choose(filters,'O101'),params:new Map()};
 try{
  session.sync(context);await expect.poll(()=>session.snapshot().status).toBe('selected');expect(calls).toBe(1);
  session.sync({...context,blocked:['region']});expect(session.snapshot().status).toBe('pending');
  session.sync({...context,blocked:[]});expect(session.snapshot()).toMatchObject({status:'selected',parentValue:'R01'});expect(calls).toBe(1);
  session.sync({filters:choose(filters),params:new Map()});expect(session.snapshot().status).toBe('unrestricted');session.sync(context);await expect.poll(()=>calls).toBe(2);await expect.poll(()=>session.snapshot().status).toBe('selected');
 }finally{session.dispose();await sim.close();}
});
