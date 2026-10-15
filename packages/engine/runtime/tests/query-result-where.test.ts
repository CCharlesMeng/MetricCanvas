import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, type Page } from '@metriccanvas/page';
import type { DataRow, DataSnapshot, EffectiveQuery } from '@metriccanvas/page/internal';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import { createFilterState } from '../src/filter-state';
import { prepareExportSnapshots } from '../src/export-snapshots';
import { resolveQueryResultInputs } from '../src/query-result-inputs';
import type { DataGateway, DataGatewayResult } from '../src/ports';
function fixture(): Page {
  const result = parsePage(JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/query-result-where-page.json',import.meta.url),'utf8')));
  if (!result.ok) throw new Error(JSON.stringify(result.errors)); return result.page;
}
const project = (id: string, amount: number | null, status='进行中'): DataRow => ({'project-id':id,status,amount,enabled:false,duration:0,day:'2026-10-01',at:'2026-10-01T00:00:00Z'});
const rows = () => [project('HIGH',2000000),project('LOW',0),project('CLOSED',3000000,'结束')];
const flush = () => new Promise(resolve=>setTimeout(resolve,0));
function harness(page=fixture()) {
  const calls: Array<{id:string;query:EffectiveQuery;signal?:AbortSignal;resolve(value:DataGatewayResult):void;reject(error:Error):void}> = [];
  const gateway:DataGateway={fetchData(query,context,signal){return new Promise((resolve,reject)=>calls.push({id:context!.dataSourceIds![0],query,signal,resolve,reject}));}};
  const filters=createFilterState(); let snapshots:PageDataSnapshots=new Map();
  const stream=orchestrate(page,gateway,filters); const stop=stream.subscribe(next=>snapshots=next);
  return {calls,filters,stream,stop,snapshots:()=>snapshots};
}
function binding(page:Page,id='details-high') {
  const source=page.dataSources[id].source;
  if(source.type!=='query')throw Error('query'); return source.query.resultBindings![0];
}
function resolve(page:Page, input:DataRow[], totalCount=input.length) {
  const raw=new Map<string,DataSnapshot>([['projects',{status:'ready',rows:input,totalCount}]]);
  return resolveQueryResultInputs(page.dataSources['details-high'],raw,new Map(Object.entries(page.dataSources)));
}

describe('filtered query inputs across consumers and export',()=>{
  it('fetches A once, keeps all its rows and feeds B/C independent sets',async()=>{
    const h=harness(), input=rows(), before=structuredClone(input);
    expect(h.calls.map(c=>c.id)).toEqual(['projects']);
    h.calls[0].resolve({rows:input,totalCount:3}); await flush();
    expect(h.calls.map(c=>c.id)).toEqual(['projects','details-high','details-low']);
    expect(h.calls[1].query.filterValues).toEqual([{target:'dimension',queryField:'项目编号',values:['HIGH']}]);
    expect(h.calls[2].query.filterValues).toEqual([{target:'dimension',queryField:'项目编号',values:['LOW']}]);
    expect(h.snapshots().get('projects')).toEqual({status:'ready',rows:before,totalCount:3}); expect(input).toEqual(before);
    h.calls[1].resolve({rows:[{'project-id':'HIGH',score:10}],totalCount:1});
    h.calls[2].resolve({rows:[{'project-id':'LOW',score:20}],totalCount:1}); await flush();
    expect(h.snapshots().get('details-high')?.status).toBe('ready'); expect(h.snapshots().get('details-low')?.status).toBe('ready'); h.stop();
  });
  it('skips a filtered-empty B while A remains visible and C executes',async()=>{
    const h=harness();h.calls[0].resolve({rows:[project('LOW',0)],totalCount:1});await flush();
    expect(h.calls.map(c=>c.id)).toEqual(['projects','details-low']);
    expect(h.snapshots().get('projects')?.status).toBe('ready');expect(h.snapshots().get('details-high')).toEqual({status:'empty',totalCount:0});h.stop();
  });
  it('checks maxValues after filtering and deduplication, and preserves A on B overflow',async()=>{
    const p=fixture();binding(p).maxValues=1;
    expect(resolve(p,[project('X',2e6),project('X',2e6),...Array.from({length:5},(_,i)=>project(String(i),0))])).toEqual({status:'ready',values:[{target:'dimension',queryField:'项目编号',values:['X']}]});
    const h=harness(p),input=[project('X',2e6),project('Y',2e6),project('LOW',0)];
    h.calls[0].resolve({rows:input,totalCount:3});await flush();
    expect(h.calls.map(c=>c.id)).toEqual(['projects','details-low']);expect(h.snapshots().get('details-high')?.status).toBe('error');expect(h.snapshots().get('projects')).toMatchObject({status:'ready',rows:input});h.stop();
  });
  it('only extracts selected keys, keeps invalid fields rejected and tolerates a mismatched total',()=>{
    const p=fixture();expect(resolve(p,[{...project('X',0),'project-id':null},project('HIGH',2e6)])).toMatchObject({status:'ready',values:[{values:['HIGH']}]});
    expect(resolve(p,[{...project('X',2e6),'project-id':null}])).toMatchObject({status:'terminal',snapshot:{status:'error'}});
    expect(resolve(p,[project('LOW',0)],2)).toMatchObject({status:'terminal',snapshot:{status:'empty'}});
    expect(resolve(p,[{...project('CLOSED',0,'结束'),amount:'SECRET'}])).toMatchObject({status:'terminal',snapshot:{status:'error',error:{message:'查询输入过滤字段缺失或类型不合法'}}});
  });
  it('invalidates consumers on A refresh and ignores old downstream success',async()=>{
    const p=fixture();p.filters=[{id:'period',type:'dimension',dimension:'period'}];
    const a=p.dataSources.projects.source;if(a.type!=='query')throw Error('query');a.query.filterBindings={period:{target:'dimension',queryField:'期间'}};
    const h=harness(p);h.calls[0].resolve({rows:rows(),totalCount:3});await flush();
    h.filters.write('period',{type:'dimension',dimension:'period',values:['new']});
    expect(h.calls[1].signal?.aborted).toBe(true); expect(h.snapshots().get('details-high')?.status).toBe('loading');
    h.calls[1].resolve({rows:[{'project-id':'OLD',score:999}],totalCount:1});
    h.calls[3].resolve({rows:[project('NEW',2e6)],totalCount:1});await flush();
    expect(h.calls[4].query.filterValues).toEqual([{target:'dimension',queryField:'项目编号',values:['NEW']}]);
    expect(h.snapshots().get('details-low')?.status).toBe('empty');
    h.calls[4].resolve({rows:[{'project-id':'NEW',score:1}],totalCount:1});await flush();
    expect(h.snapshots().get('details-high')).toMatchObject({status:'ready',rows:[{'project-id':'NEW',score:1}]});h.stop();
  });
  it('exports fresh A, applies the same per-consumer selection and keeps A complete',async()=>{
    const p=fixture(),h=harness(p);h.calls[0].resolve({rows:rows(),totalCount:3});await flush();
    const queries=h.stream.captureQueries();h.stop();const received:Array<{id:string;query:EffectiveQuery}>=[];
    const fresh=[project('FRESH-H',2e6),project('FRESH-L',0),project('CLOSED',5e6,'结束')];
    const gateway:DataGateway={async fetchData(query,context){const id=context!.dataSourceIds![0];received.push({id,query});return id==='projects'?{rows:fresh,totalCount:3}:{rows:[{'project-id':id==='details-high'?'FRESH-H':'FRESH-L',score:1}],totalCount:1};}};
    const exported=await prepareExportSnapshots(p,gateway,queries,new Map(),new AbortController().signal);
    expect(received.find(c=>c.id==='details-high')?.query.filterValues).toEqual([{target:'dimension',queryField:'项目编号',values:['FRESH-H']}]);
    expect(received.find(c=>c.id==='details-low')?.query.filterValues).toEqual([{target:'dimension',queryField:'项目编号',values:['FRESH-L']}]);
    expect(exported.get('projects')).toMatchObject({status:'ready',rows:fresh,totalCount:3});
  });
});

function pagedFixture(): Page {
  const p=fixture();p.schemaVersion='6.20';
  const source=p.dataSources.projects.source;if(source.type!=='query')throw Error('query');
  delete source.resultScope;source.query.body.dsl_list[0].order={offset:0,limit:2};
  const table=p.sections.flatMap(section=>section.components).find(component=>component.type==='table'&&component.data.main==='projects');
  if(table?.type!=='table')throw Error('table');table.props.pagination={mode:'query'};return p;
}

it('sort invalidation follows branches, waits for joined inputs, propagates further and preserves unrelated queries',async()=>{
  const p=pagedFixture(), prototype=p.dataSources['details-high'];
  const joined=structuredClone(prototype), next=structuredClone(prototype), unrelated=structuredClone(prototype);
  if(joined.source.type!=='query'||next.source.type!=='query'||unrelated.source.type!=='query')throw Error('query');
  joined.source.query.resultBindings=[
    {source:'details-high',field:'project-id',target:'dimension',queryField:'高额编号',maxValues:500},
    {source:'details-low',field:'project-id',target:'dimension',queryField:'小额编号',maxValues:500}
  ];
  next.source.query.resultBindings=[{source:'joined',field:'project-id',target:'dimension',queryField:'汇总编号',maxValues:500}];
  delete unrelated.source.query.resultBindings;unrelated.source.query.body.dsl_list[0].order={order_by_field:'独立',type:'asc'};
  p.dataSources.joined=joined;p.dataSources.next=next;p.dataSources.unrelated=unrelated;
  const table=p.sections.flatMap(section=>section.components).find(component=>component.type==='table');if(!table)throw Error('table');
  p.sections[0].components.push({...structuredClone(table),id:'next-table',data:{main:'next'}},{...structuredClone(table),id:'unrelated-table',data:{main:'unrelated'}});
  const h=harness(p);const call=(id:string)=>h.calls.filter(c=>c.id===id).at(-1)!;
  call('unrelated').resolve({rows:[{'project-id':'STABLE',score:1}],totalCount:1});
  call('projects').resolve({rows:[project('HIGH',2e6),project('LOW',0)],totalCount:80});await flush();
  call('details-high').resolve({rows:[{'project-id':'HIGH',score:1}],totalCount:1});await flush();
  expect(h.calls.some(c=>c.id==='joined')).toBe(false);
  call('details-low').resolve({rows:[{'project-id':'LOW',score:1}],totalCount:1});await flush();
  expect(call('joined').query.filterValues).toEqual([
    {target:'dimension',queryField:'高额编号',values:['HIGH']},{target:'dimension',queryField:'小额编号',values:['LOW']}
  ]);
  call('joined').resolve({rows:[{'project-id':'JOIN',score:1}],totalCount:1});await flush();
  const oldNext=call('next');
  h.stream.setQuerySort('projects',[{field:'duration',direction:'desc'}]);
  expect(call('projects').query).toMatchObject({pagination:{offset:0,limit:2},sort:[{queryField:'时长',direction:'desc'}]});
  expect(oldNext.signal?.aborted).toBe(true);
  for(const id of ['details-high','details-low','joined','next'])expect(h.snapshots().get(id)?.status).toBe('loading');
  expect(h.snapshots().get('unrelated')?.status).toBe('ready');expect(h.calls.filter(c=>c.id==='unrelated')).toHaveLength(1);
  oldNext.resolve({rows:[{'project-id':'STALE',score:999}],totalCount:1});await flush();
  expect(h.snapshots().get('next')?.status).toBe('loading');
  call('projects').resolve({rows:[project('NEW-H',2e6),project('NEW-L',0)],totalCount:80});await flush();
  call('details-low').resolve({rows:[{'project-id':'NEW-L',score:1}],totalCount:1});await flush();
  expect(h.calls.filter(c=>c.id==='joined')).toHaveLength(1);
  call('details-high').resolve({rows:[{'project-id':'NEW-H',score:1}],totalCount:1});await flush();
  call('joined').resolve({rows:[{'project-id':'NEW-JOIN',score:1}],totalCount:1});await flush();
  expect(call('next').query.filterValues).toEqual([{target:'dimension',queryField:'汇总编号',values:['NEW-JOIN']}]);
  call('next').resolve({rows:[{'project-id':'NEW-JOIN',score:1}],totalCount:1});await flush();
  expect(h.snapshots().get('next')).toMatchObject({status:'ready',rows:[{'project-id':'NEW-JOIN'}]});h.stop();
});

it('upstream sorting resets a paged downstream query and permits actual page sizes above the original declaration',async()=>{
  const p=pagedFixture(), source=p.dataSources['details-high'].source;
  if(source.type!=='query')throw Error('query');delete source.resultScope;source.query.body.dsl_list[0].order={offset:0,limit:1};
  const table=p.sections.flatMap(section=>section.components).find(component=>component.type==='table'&&component.data.main==='details-high');
  if(table?.type!=='table')throw Error('table');table.props.pagination={mode:'query'};
  const h=harness(p);h.calls[0].resolve({rows:[project('HIGH',2e6)],totalCount:80});await flush();
  h.calls[1].resolve({rows:[{'project-id':'HIGH',score:1}],totalCount:9});await flush();
  h.stream.setQueryPage('details-high',2);expect(h.calls[2].query.pagination).toEqual({offset:2,limit:1});
  h.calls[2].resolve({rows:[{'project-id':'HIGH',score:2}],totalCount:9});await flush();
  h.stream.setQueryPageSize('projects',4);
  h.calls[3].resolve({rows:[project('A',2e6),project('B',2e6),project('C',2e6),project('D',2e6)],totalCount:80});await flush();
  expect(h.calls[4].query.pagination).toEqual({offset:0,limit:1});
  expect(h.calls[4].query.filterValues[0]).toMatchObject({values:['A','B','C','D']});h.stop();
});
it('reuses downstream queries when a new upstream ordering produces the same selected field sets',async()=>{
  const h=harness(pagedFixture()),input=[project('HIGH',2e6),project('LOW',0)];
  h.calls[0].resolve({rows:input,totalCount:80});await flush();
  h.calls[1].resolve({rows:[{'project-id':'HIGH',score:1}],totalCount:1});
  h.calls[2].resolve({rows:[{'project-id':'LOW',score:1}],totalCount:1});await flush();
  h.stream.setQuerySort('projects',[{field:'amount',direction:'asc'}]);
  h.calls[3].resolve({rows:[...input].reverse(),totalCount:80});await flush();
  expect(h.calls).toHaveLength(4);expect(h.snapshots().get('details-high')?.status).toBe('ready');expect(h.snapshots().get('details-low')?.status).toBe('ready');h.stop();
});
