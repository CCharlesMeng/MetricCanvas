import {describe,it,expect} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {setRowCellFallbacks,type DataSnapshot,type Page,type Row,type TableQueryView} from '@metriccanvas/page/internal';
import document from '../../../pages/capabilities/table/paged-join-on-demand.json';
import recordDocument from '../../../pages/capabilities/table/record-join-on-demand.json';
import {createRejectionPreview} from '../../../apps/playground/fixtures/rejection-details/gateway';
import {createPagedJoinPreview} from '../../../apps/playground/fixtures/query-join-gateway';
import {createSourceProgram,defaultSourceView,initialFilterValues} from '../src/runtime';
import type {DataGateway} from '../src';

function page(input:unknown=document):Page {
  const parsed=parsePage(input);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  return parsed.page;
}
async function read(gateway:DataGateway,complete=false,patch:Partial<TableQueryView>={},input=page(),root='projects'){
  const program=createSourceProgram(input,{gateway});
  let result:DataSnapshot|undefined;
  try{
    for await(const update of program.read({roots:[root],conditions:initialFilterValues(input.filters??[]),views:new Map([[root,{...defaultSourceView(input,root),...patch}]]),purpose:complete?'complete':'screen'}))if(update.sourceId===root)result=update.snapshot;
    return result!;
  }finally{program.dispose();}
}
function ready(snapshot:DataSnapshot):Row[]{
  expect(snapshot.status).toBe('ready');
  if(snapshot.status!=='ready')throw Error(JSON.stringify(snapshot));
  return snapshot.rows;
}
describe('query-paged supplement empty association keys',()=>{
  it('keeps ten selected rows when supplement row eleven has a null key',async()=>{
    const preview=createPagedJoinPreview();
    const gateway:DataGateway={async fetchData(query){
      const result=await preview.dataGateway.fetchData(query);
      if('project-status' in query.fieldMappings){result.rows.push({...result.rows[0],'project-id':null});result.totalCount=result.rows.length;}
      return result;
    }};
    const snapshot=await read(gateway);
    expect(ready(snapshot)).toHaveLength(10);
    expect(snapshot).toMatchObject({totalCount:80,warnings:[{code:'TABLE_RESULT_RECOVERED',sourceId:'project-information',count:1}]});
    expect(preview.calls).toHaveLength(2);
    expect(preview.calls.every(query=>query.pagination?.limit===10)).toBe(true);
  });
  it.each([null,'','   ',undefined])('keeps the selected row and leaves unmatched columns empty for key %s',async key=>{
    const preview=createPagedJoinPreview();
    const snapshot=await read({async fetchData(query){
      const result=await preview.dataGateway.fetchData(query);
      if('project-status' in query.fieldMappings){
        if(key===undefined)delete result.rows[0]['project-id'];
        else result.rows[0]['project-id']=key;
      }
      return result;
    }});
    expect(ready(snapshot)).toHaveLength(10);
    expect(ready(snapshot)[0]).toMatchObject({'project-id':'P000001','approval-count':80,'project-status':null,'contract-amount':null});
    expect(snapshot).toMatchObject({totalCount:80,warnings:[{count:1}]});
    expect(preview.calls).toHaveLength(2);
  });
  it('preserves every selected row when all supplement keys are empty',async()=>{
    const preview=createPagedJoinPreview();
    const snapshot=await read({async fetchData(query){
      const result=await preview.dataGateway.fetchData(query);
      if('project-status' in query.fieldMappings)result.rows=result.rows.map(row=>({...row,'project-id':null}));
      return result;
    }});
    expect(ready(snapshot)).toHaveLength(10);
    expect(ready(snapshot).every(row=>row['project-status']===null)).toBe(true);
    expect(snapshot).toMatchObject({totalCount:80,warnings:[{count:10}]});
  });
  it('merges warning counts across export pages without expanding supplemental reads',async()=>{
    const preview=createPagedJoinPreview(25);
    const snapshot=await read({async fetchData(query){
      const result=await preview.dataGateway.fetchData(query);
      if('project-status' in query.fieldMappings){result.rows.push({...result.rows[0],'project-id':null});result.totalCount=result.rows.length;}
      return result;
    }},true);
    expect(ready(snapshot)).toHaveLength(25);
    expect(snapshot).toMatchObject({totalCount:25,warnings:[{sourceId:'project-information',count:3}]});
    expect(preview.calls).toHaveLength(6);
    expect(preview.calls.every(query=>query.pagination?.limit===10)).toBe(true);
  });
  it.each(['wrong-type','duplicate','foreign','truncated','invalid-total','raw-limit'] as const)('still rejects %s supplement results',async fault=>{
    const preview=createPagedJoinPreview();
    const snapshot=await read({async fetchData(query){
      const result=await preview.dataGateway.fetchData(query);
      if('project-status' in query.fieldMappings){
        switch(fault){
          case 'wrong-type':result.rows[0]['project-id']=42;break;
          case 'duplicate':result.rows[1]={...result.rows[0]};break;
          case 'foreign':result.rows[0]['project-id']='outside';break;
          case 'truncated':result.rows.pop();break;
          case 'invalid-total':result.totalCount=NaN;break;
          case 'raw-limit':result.rows=Array.from({length:1001},()=>({...result.rows[0],'project-id':null}));result.totalCount=1001;break;
        }
      }
      return result;
    }});
    expect(snapshot.status).toBe('error');expect(preview.calls).toHaveLength(2);
  });
  it.each(['DQE_FORBIDDEN','DQE_TRANSPORT_ERROR','DQE_TIMEOUT','DQE_CANCELLED','DQE_FIELD_MAPPING_ERROR'])('propagates %s instead of retrying a full query',async code=>{
    const preview=createPagedJoinPreview();
    const snapshot=await read({async fetchData(query){
      const result=await preview.dataGateway.fetchData(query);
      if('project-status' in query.fieldMappings)throw Object.assign(new Error('unavailable'),{code});
      return result;
    }});
    expect(snapshot).toMatchObject({status:'error',error:{code}});
    expect(preview.calls).toHaveLength(2);
  });
  it.each([false,true])('retains strict domain keys when the domain is a supplement: %s',async selectedB=>{
    const preview=createPagedJoinPreview();
    const snapshot=await read({async fetchData(query){
      const result=await preview.dataGateway.fetchData(query);
      if('approval-count' in query.fieldMappings)result.rows[0]['project-id']=null;
      return result;
    }},false,selectedB?{sort:[{field:'contract-amount',direction:'desc'}]}:{});
    expect(snapshot).toMatchObject({status:'error',error:{code:'DQE_ROW_CONTRACT_ERROR'}});
    expect(preview.calls).toHaveLength(selectedB?2:1);
  });

  it('preserves record identities while ignoring an empty supplemental association',async()=>{
    const input=page(recordDocument),source=input.dataSources['rejection-overview'].source;
    if(source.type!=='pagedJoin')throw Error('join');
    const member=Object.entries(source.members).find(([id])=>id!==source.domainMember)![1];
    const preview=createRejectionPreview({rows:1205});
    const snapshot=await read({async fetchData(query){
      const result=await preview.dataGateway.fetchData(query);
      if('life-status' in query.fieldMappings)result.rows[0][member.key.field]=null;
      return result;
    }},false,{},input,'rejection-overview');
    expect(ready(snapshot)).toHaveLength(10);
    expect(new Set(ready(snapshot).map(row=>row['record-id'])).size).toBe(10);
    expect(snapshot).toMatchObject({totalCount:1205,warnings:[{count:1}]});
    expect(preview.calls).toHaveLength(2);
  });
  it('does not capture a recovered page as reusable initial data',async()=>{
    const input=page(),preview=createPagedJoinPreview();
    const program=createSourceProgram(input,{gateway:{async fetchData(query){
      const result=await preview.dataGateway.fetchData(query);
      if('project-status' in query.fieldMappings)result.rows[0]['project-id']=null;
      return result;
    }}});
    try{
      for await(const update of program.read({roots:['projects'],conditions:initialFilterValues(input.filters??[])})){
        if(update.sourceId==='projects'&&update.snapshot.status==='ready'){
          expect(update.snapshot.warnings).toHaveLength(1);expect(update.initial).toBeUndefined();
        }
      }
    }finally{program.dispose();}
  });

  it('does not reinterpret a typed display fallback as a genuinely empty key',async()=>{
    const preview=createPagedJoinPreview();
    const snapshot=await read({async fetchData(query){
      const result=await preview.dataGateway.fetchData(query);
      if('project-status' in query.fieldMappings){
        result.rows[0]['project-id']=null;
        setRowCellFallbacks(result.rows[0],{'project-id':{raw:42,reason:'TYPE_MISMATCH'}});
      }
      return result;
    }});
    expect(snapshot).toMatchObject({status:'error',error:{code:'DQE_ROW_CONTRACT_ERROR'}});
    expect(preview.calls).toHaveLength(2);
  });

});
