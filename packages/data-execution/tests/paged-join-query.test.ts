import {describe,it,expect} from 'vitest';
import pageDocument from '../../../pages/capabilities/table/paged-join-on-demand.json';
import recordDocument from '../../../pages/capabilities/table/record-join-on-demand.json';
import {parsePage} from '@metriccanvas/page';
import {dqeRecord,type JsonObject,type DataSnapshot,type Page,type TableQueryView,type EffectiveQuery} from '@metriccanvas/page/internal';
import {createDqeGateway} from '../src/dqe/dqe';
import {createSourceProgram,defaultSourceView,initialFilterValues,filterTableRows} from '../src/runtime';
import {createPagedJoinPreview} from '../../../apps/playground/fixtures/query-join-gateway';
import {createRejectionPreview} from '../../../apps/playground/fixtures/rejection-details/gateway';
import type {DataGateway} from '../src';

function parsed(document:unknown=pageDocument):Page{
  const result=parsePage(document);if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;
}
async function read(page:Page,gateway:DataGateway,patch:Partial<TableQueryView>={},root='projects',complete=false){
  const program=createSourceProgram(page,{gateway});let snapshot:DataSnapshot|undefined;
  try{
    for await(const update of program.read({roots:[root],conditions:initialFilterValues(page.filters??[]),views:new Map([[root,{...defaultSourceView(page,root),...patch}]]),purpose:complete?'complete':'screen'}))if(update.sourceId===root)snapshot=update.snapshot;
    return snapshot!;
  }finally{program.dispose();}
}
function rows(snapshot:DataSnapshot){if(snapshot.status!=='ready')throw Error(JSON.stringify(snapshot));return snapshot.rows;}
describe('query-paged join',()=>{
  it('preflights the selected source default sort when a filter has no explicit table sort',async()=>{
    const page=parsed(),member=page.dataSources['project-information'];
    if(member.source.type!=='query')throw Error('query');
    member.fields['contract-amount'].nullable=true;
    member.source.query.body!.dsl_list[0].order={order_by_field:'合同金额',type:'asc'};
    const preview=createPagedJoinPreview();
    expect(await read(page,preview.dataGateway,{sort:[],predicates:[{field:'project-status',op:'in',values:['已关闭']}]})).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}});
    expect(preview.calls).toHaveLength(0);
  });
  it('encodes limit, offset, sort and page keys at the native DQE request boundary',async()=>{
    const requests:JsonObject[]=[];
    const gateway=createDqeGateway({fetchImpl:async(_url,init)=>{
      const items:JsonObject[]=JSON.parse(String(init?.body)).dsl_list;requests.push(...items);
      return Response.json({retCode:'CBC.0000',results:items.map(nativeReceipt)});
    }});
    const snapshot=await read(parsed(),gateway,{pageIndex:1});
    expect(rows(snapshot)).toHaveLength(10);expect(requests).toHaveLength(2);
    expect(requests[0].order).toMatchObject({limit:10,offset:10,order_by_field:'审批次数',type:'desc'});
    expect(requests[1].order).toMatchObject({limit:10,offset:0});
    expect(dqeRecord(requests[1].filter).dims).toContainEqual({dim_name:'项目编号',dim_value_list:rows(snapshot).map(row=>row['project-id'])});
  });
  it('applies the record byte budget to a page without retrying a complete read',async()=>{
    const page=parsed(recordDocument),source=page.dataSources['rejection-overview'].source;
    if(source.type!=='pagedJoin'||!source.records)throw Error('records');
    source.records.maxBytes=1024;
    const preview=createRejectionPreview({rows:30});
    expect(await read(page,preview.dataGateway,{},'rejection-overview')).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}});
    expect(preview.calls).toHaveLength(2);
  });
  it('enforces a per-request timeout and never starts supplements after it',async()=>{
    const page=parsed(recordDocument),source=page.dataSources['rejection-overview'].source;
    if(source.type!=='pagedJoin'||!source.records)throw Error('records');source.records.timeoutMs=5;
    const calls:EffectiveQuery[]=[];
    const gateway:DataGateway={async fetchData(query,_context,signal){
      calls.push(query);
      return new Promise<never>((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(signal.reason),{once:true}));
    }};
    expect(await read(page,gateway,{},'rejection-overview')).toMatchObject({status:'error',error:{code:'DQE_TIMEOUT'}});
    expect(calls).toHaveLength(1);
  });
  it.each([80,100001])('only selects one page and its keys with %i source rows',async count=>{
    const preview=createPagedJoinPreview(count),snapshot=await read(parsed(),preview.dataGateway);
    expect(snapshot).toMatchObject({status:'ready',totalCount:count});expect(rows(snapshot)).toHaveLength(10);
    expect(preview.calls).toHaveLength(2);expect(preview.calls.every(query=>query.pagination?.limit===10)).toBe(true);
    expect(preview.calls[0].pagination).toEqual({offset:0,limit:10});
    expect(preview.calls[1].filterValues.find(value=>value.target==='dimension')).toMatchObject({values:rows(snapshot).map(row=>row['project-id'])});
  });
  it('keeps display page size separate from bounded supplement batches',async()=>{
    const page=parsed(),source=page.dataSources.projects.source;if(source.type!=='pagedJoin'||!('batchSize' in source.pagination))throw Error('query join');
    source.pagination.batchSize=3;
    const preview=createPagedJoinPreview(),snapshot=await read(page,preview.dataGateway,{pageIndex:2});
    expect(rows(snapshot)).toHaveLength(10);expect(preview.calls[0].pagination).toEqual({offset:20,limit:10});
    expect(preview.calls.slice(1)).toHaveLength(4);expect(preview.calls.slice(1).every(query=>query.pagination?.limit===3)).toBe(true);
  });
  it('selects a filtered B page then looks A up without using the old A sort',async()=>{
    const preview=createPagedJoinPreview(),snapshot=await read(parsed(),preview.dataGateway,{sort:[],predicates:[{field:'project-status',op:'in',values:['已关闭']}]});
    expect(snapshot).toMatchObject({totalCount:40});expect(rows(snapshot).every(row=>row['project-status']==='已关闭')).toBe(true);
    expect(preview.calls[0].fieldMappings).toHaveProperty('project-status');expect(preview.calls[0].sort).toEqual([{queryField:'项目编号',direction:'asc'}]);
  });
  it('exports the captured view through pages rather than returning only the screen window',async()=>{
    const preview=createPagedJoinPreview(25),snapshot=await read(parsed(),preview.dataGateway,{},'projects',true);
    expect(rows(snapshot)).toHaveLength(25);expect(preview.calls.filter(query=>'approval-count' in query.fieldMappings).map(query=>query.pagination?.offset)).toEqual([0,10,20]);
  });
  it('preserves record identities and repeated association keys without collecting all records',async()=>{
    const preview=createRejectionPreview({rows:1205}),snapshot=await read(parsed(recordDocument),preview.dataGateway,{},'rejection-overview');
    expect(snapshot).toMatchObject({status:'ready',totalCount:1205});expect(rows(snapshot)).toHaveLength(10);
    expect(new Set(rows(snapshot).map(row=>row['record-id'])).size).toBe(10);
    const main=preview.calls.filter(query=>'approval-stage' in query.fieldMappings);
    expect(main).toHaveLength(1);expect(main[0].pagination).toEqual({offset:0,limit:10});
    expect(preview.calls.every(query=>query.pagination?.limit===10)).toBe(true);
  });
  it('rejects record-mode B operations before making requests',async()=>{
    const preview=createRejectionPreview({rows:12});
    const snapshot=await read(parsed(recordDocument),preview.dataGateway,{sort:[],predicates:[{field:'life-status',op:'in',values:['已关闭']}]},'rejection-overview');
    expect(snapshot).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}});expect(preview.calls).toHaveLength(0);
  });
  it.each(['duplicate','truncated','extra'] as const)('fails %s supplement responses without complete recovery',async fault=>{
    const preview=createPagedJoinPreview();const gateway:DataGateway={async fetchData(query){
      const result=await preview.dataGateway.fetchData(query);
      if('project-status' in query.fieldMappings){
        if(fault==='duplicate')result.rows[1]={...result.rows[0]};
        if(fault==='truncated')result.rows.pop();
        if(fault==='extra')result.rows[0]={...result.rows[0],'project-id':'outside'};
      }
      return result;
    }};
    expect(await read(parsed(),gateway)).toMatchObject({status:'error',error:{code:'DQE_ROW_CONTRACT_ERROR'}});
    expect(preview.calls).toHaveLength(2);
  });
  it('previews B candidates with no A condition and never preloads the full join',async()=>{
    const page=parsed(),preview=createPagedJoinPreview(),program=createSourceProgram(page,{gateway:preview.dataGateway});
    try{
      const view={...defaultSourceView(page,'projects'),predicates:[{field:'approval-count',op:'gte' as const,value:70}]};
      expect(await program.readColumnCandidates({sourceId:'projects',field:'project-status',conditions:new Map(),view,preload:true})).toEqual({kind:'unavailable'});
      expect(await program.readColumnCandidates({sourceId:'projects',field:'project-status',conditions:new Map(),view})).toMatchObject({kind:'values',totalCount:2});
      expect(preview.calls).toHaveLength(0);
    }finally{program.dispose();}
  });
  it('preserves null locally and rejects unverified backend null instead of filtering one page',async()=>{
    expect(filterTableRows([{value:null},{value:''},{value:0}],[{field:'value',op:'isNull'}])).toEqual([{value:null}]);
    const preview=createPagedJoinPreview();expect(await read(parsed(),preview.dataGateway,{sort:[],predicates:[{field:'project-status',op:'isNull'}]})).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}});
    expect(preview.calls).toHaveLength(0);
  });
});

function nativeReceipt(item:JsonObject):JsonObject{
  const order=dqeRecord(item.order),filter=dqeRecord(item.filter);
  let source=Array.from({length:80},(_,index)=>({'项目编号':`P${String(index+1).padStart(6,'0')}`,'项目名称':`测试项目${index+1}`,'审批次数':80-index,'项目状态':index%2?'已关闭':'进行中','合同金额':(index+1)*1000}));
  for(const value of Array.isArray(filter.dims)?filter.dims:[]){
    const predicate=dqeRecord(value);source=source.filter(row=>Array.isArray(predicate.dim_value_list)&&predicate.dim_value_list.includes(row['项目编号']));
  }
  const all=source.map(row=>row as JsonObject),field=String(order.order_by_field);
  all.sort((a,b)=>(Number(a[field])-Number(b[field]))*(order.type==='desc'?-1:1));
  return {code:'SUCCESS',total_count:all.length,data:all.slice(Number(order.offset),Number(order.offset)+Number(order.limit))};
}
