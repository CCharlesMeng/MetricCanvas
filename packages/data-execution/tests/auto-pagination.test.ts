import {expect,it} from 'vitest';
import {parsePage,type Page} from '@metriccanvas/page';
import type {DataSnapshot,TableQueryView} from '@metriccanvas/page/internal';
import document from '../../page/fixtures/contract-valid/record-join-auto-page.json';
import {createSourceProgram,defaultSourceView,initialFilterValues} from '../src/runtime';
import {compilePagedJoin} from '../src/paged-join/plan';
import {createRejectionPreview} from '../../../apps/playground/fixtures/rejection-details/gateway';
import type {DataGateway} from '../src/ports';
const root='rejection-overview';
function load():Page{const result=parsePage(document);if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;}
function setup(count=1205,page=load(),wrap?:(gateway:DataGateway)=>DataGateway){
  const preview=createRejectionPreview({rows:count});
  const gateway:DataGateway={fetchData(query,context,signal){
    if(query.search?.match==='equals')query={...query,filterValues:[...query.filterValues,{target:'dimension',queryField:query.search.queryFields[0],values:[query.search.query]}]};
    return preview.dataGateway.fetchData(query,context,signal);
  }};
  const program=createSourceProgram(page,{gateway:wrap?wrap(gateway):gateway});
  const conditions=initialFilterValues(page.filters??[]);
  async function read(patch:Partial<TableQueryView>={},extra:Partial<Parameters<typeof program.read>[0]>={}){
    let snapshot:DataSnapshot|undefined;
    for await(const update of program.read({roots:[root],conditions,views:new Map([[root,{...defaultSourceView(page,root),...patch}]]),...extra}))snapshot=update.snapshot;
    return snapshot!;
  }
  return {...preview,page,program,conditions,read};
}
function rows(snapshot:DataSnapshot){if(snapshot.status!=='ready')throw Error(JSON.stringify(snapshot));return snapshot.rows;}

it('reads only the current domain page out of 100001 records, deduplicates supplement keys and keeps repeated business rows',async()=>{
  const test=setup(100001);
  try{
    const first=await test.read();expect(first).toMatchObject({status:'ready',totalCount:100001});
    expect(rows(first)).toHaveLength(10);expect(test.calls).toHaveLength(2);
    expect(test.calls[0].pagination).toEqual({offset:0,limit:10});
    expect(test.calls[1].filterValues.find(value=>value.target==='dimension'&&value.queryField==='商务ID')).toMatchObject({values:expect.any(Array)});
    const last=rows(await test.read({pageIndex:10000}));expect(last).toHaveLength(1);
    expect(test.calls.filter(query=>'approval-stage' in query.fieldMappings).map(query=>query.pagination?.offset)).toEqual([0,100000]);
  }finally{test.program.dispose();}
},30000);

it('publishes distinct generated row identities while a supplement is still pending',async()=>{
  const page=load(),source=page.dataSources[root].source;if(source.type!=='pagedJoin')throw Error('join');delete source.projection[source.rowKey];
  let release!:()=>void,entered!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),waiting=new Promise<void>(resolve=>{entered=resolve;});
  const test=setup(20,page,gateway=>({async fetchData(query,context,signal){
    if(!('approval-stage' in query.fieldMappings)){entered();await gate;}
    return gateway.fetchData(query,context,signal);
  }}));
  const progress:Parameters<NonNullable<Parameters<typeof test.program.read>[0]['onProgress']>>[1][]=[];
  try{
    const pending=test.read({pageIndex:1},{onProgress:(_id,value)=>progress.push(value)});
    await waiting;
    expect(progress[0].snapshot.rows).toHaveLength(10);
    expect(progress[0].pendingFields).toContain('biz-owner-name');
    expect(new Set(progress[0].snapshot.rows.map(row=>row['record-id'])).size).toBe(10);
    expect(progress[0].snapshot.rows[0]['record-id']).toBe('000000000010');
    release();const result=rows(await pending);
    expect(result.map(row=>row['record-id'])).toEqual(progress[0].snapshot.rows.map(row=>row['record-id']));
    expect(new Set(result.map(row=>row['biz-id'])).size).toBe(5);
  }finally{release();test.program.dispose();}
});

it('pushes domain predicates to a page query and preserves non-domain predicates when sorting changes',async()=>{
  const test=setup(20);
  try{
    const patch={predicates:[{field:'approval-stage',op:'in' as const,values:['复审']}]};
    const plan=compilePagedJoin(test.page,root,test.conditions,{...defaultSourceView(test.page,root),...patch});
    expect(plan.strategy).toBe('autoPage');
    const filtered=await test.read(patch);expect(filtered).toMatchObject({totalCount:10});
    expect(rows(filtered).every(row=>row['approval-stage']==='复审')).toBe(true);
    expect(test.calls[0].tableFilters).toContainEqual({target:'dimension',queryField:'阶段名称',values:['复审']});
    const view={...defaultSourceView(test.page,root),predicates:[...patch.predicates,{field:'life-status',op:'in' as const,values:['已关闭']}]};
    expect(test.program.prepareView(root,test.conditions,view,'biz-approve-time',view).predicates).toEqual(view.predicates);
    expect(compilePagedJoin(test.page,root,test.conditions,view).strategy).toBe('recordJoin');
    expect(await test.read(view)).toMatchObject({totalCount:5});
  }finally{test.program.dispose();}
});

it('keeps exact domain search on demand and uses full records for supplemental search, sorting and export',async()=>{
  const test=setup(24);
  try{
    const searched=await test.read({search:{fields:['biz-code'],query:'BIZ-00001',match:'equals'}});
    expect(searched).toMatchObject({totalCount:2});
    const base=defaultSourceView(test.page,root);
    const supplemental={...base,search:{fields:['biz-owner-name'],query:'测试责任人1',match:'equals' as const}};
    expect(compilePagedJoin(test.page,root,test.conditions,supplemental).strategy).toBe('recordJoin');
    const source=test.page.dataSources[root].source;if(source.type!=='pagedJoin')throw Error('join');source.ordering.sortableFields.push('life-status');
    const sorted=await test.read({sort:[{field:'life-status',direction:'asc'}]});expect(sorted).toMatchObject({totalCount:24});
    expect(rows(await test.read({}, {purpose:'complete'}))).toHaveLength(24);
  }finally{test.program.dispose();}
});

it('falls back for nullable ordering, local time filters, row budgets and unsupported null predicates',()=>{
  const page=load(),conditions=initialFilterValues(page.filters??[]),view=defaultSourceView(page,root);
  const source=page.dataSources[root].source;if(source.type!=='pagedJoin')throw Error('join');
  const plan=()=>compilePagedJoin(page,root,conditions,view).strategy;
  const raw=page.dataSources['rejection-details'].fields['biz-approve-time'];raw.nullable=true;
  expect(plan()).toBe('recordJoin');raw.nullable=false;
  source.records!.maxRows=100;expect(plan()).toBe('recordJoin');delete source.records!.maxRows;
  source.records!.timeFilters={mtime:{field:'biz-approve-time',valueFormat:'datetime'}};expect(plan()).toBe('recordJoin');delete source.records!.timeFilters;
  view.predicates=[{field:'approval-stage',op:'isNull'}];expect(plan()).toBe('recordJoin');
});

it('does not silently read all records after a failed fast page and retries after refresh',async()=>{
  let fail=true;
  const test=setup(20,load(),gateway=>({async fetchData(query,context,signal){
    if(fail)throw Object.assign(new Error('Synthetic unavailable'),{code:'DQE_TRANSPORT_ERROR'});
    return gateway.fetchData(query,context,signal);
  }}));
  try{
    expect(await test.read()).toMatchObject({status:'error',error:{code:'DQE_TRANSPORT_ERROR'}});
    expect(test.calls).toHaveLength(0);fail=false;
    expect(await test.read({}, {freshness:'refresh'})).toMatchObject({totalCount:20});
  }finally{test.program.dispose();}
});

it('rejects a truncated fast window instead of retrying it as a complete scan',async()=>{
  const test=setup(20,load(),gateway=>({async fetchData(query,context,signal){
    const result=await gateway.fetchData(query,context,signal);
    return 'approval-stage' in query.fieldMappings?{...result,rows:result.rows.slice(1)}:result;
  }}));
  try{
    expect(await test.read()).toMatchObject({status:'error',error:{code:'DQE_ROW_CONTRACT_ERROR'}});
    expect(test.calls).toHaveLength(1);expect(test.calls[0].pagination?.limit).toBe(10);
  }finally{test.program.dispose();}
});

it('cancels pending supplements, suppresses late progress and permits a fresh successful read',async()=>{
  let release!:()=>void,entered!:()=>void,hold=true;
  const gate=new Promise<void>(resolve=>{release=resolve;}),waiting=new Promise<void>(resolve=>{entered=resolve;});
  const controller=new AbortController(),progress:unknown[]=[];
  const test=setup(20,load(),gateway=>({async fetchData(query,context,signal){
    if(hold&&!('approval-stage' in query.fieldMappings)){entered();await gate;}
    return gateway.fetchData(query,context,signal);
  }}));
  try{
    const pending=test.read({}, {signal:controller.signal,onProgress:(_id,value)=>progress.push(value)});
    await waiting;controller.abort();await expect(pending).rejects.toBeDefined();
    const count=progress.length;release();await new Promise(resolve=>setTimeout(resolve,0));
    expect(progress).toHaveLength(count);hold=false;
    expect(await test.read({}, {freshness:'refresh'})).toMatchObject({status:'ready',totalCount:20});
  }finally{release();test.program.dispose();}
});

it('enforces projected page bytes before publishing progressive rows',async()=>{
  const page=load(),source=page.dataSources[root].source;if(source.type!=='pagedJoin')throw Error('join');
  source.records!.maxBytes=1024;
  for(let index=0;index<50;index++){
    const field=`date-${index}`;page.dataSources[root].fields[field]={...page.dataSources[root].fields['biz-approve-time']};
    source.projection[field]={member:source.domainMember,field:'biz-approve-time'};
  }
  const test=setup(20,page),progress:unknown[]=[];
  try{
    expect(await test.read({pageSize:1},{onProgress:(_id,value)=>progress.push(value)})).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}});
    expect(progress).toEqual([]);expect(test.calls).toHaveLength(1);
  }finally{test.program.dispose();}
});
