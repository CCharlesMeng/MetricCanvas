import {describe,expect,it,vi} from 'vitest';
import {parsePage,type Page} from '@metriccanvas/page';
import type {DataSnapshot,EffectiveQuery} from '@metriccanvas/page/internal';
import fixture from '../../../pages/capabilities/table/paged-join-diagnostics.json';
import {createSourceProgram,defaultSourceView,initialFilterValues} from '../src/runtime';
import {createDqeGateway} from '../src/dqe/dqe';
import {executeDqeItem} from '../../../tools/dqe-sim/src/execute';

const root='office-overview';
function parsed():Page {
  const result=parsePage(fixture);
  if(!result.ok)throw Error(JSON.stringify(result.errors));
  return result.page;
}
async function read(mode:string,records=false){
  const page=parsed(),calls:EffectiveQuery[]=[],gateway=createDqeGateway({fetchImpl:async(_url,init)=>Response.json({retCode:'CBC.0000',results:JSON.parse(String(init?.body)).dsl_list.map(executeDqeItem)})});
  const source=page.dataSources[root].source;
  if(records && source.type==='pagedJoin')source.records={batchSize:100,maxRows:100,maxBytes:1048576,timeoutMs:5000};
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  const program=createSourceProgram(page,{gateway:{async fetchData(query){
    calls.push(query);const result=await gateway.fetchData(query);
    if('region-dept-name' in query.fieldMappings){
      if(mode==='null')result.rows[0]['rep-office-code']=null;
      if(mode==='empty-key')result.rows[0]['rep-office-code']='  ';
      if(mode==='duplicate')result.rows[1]['rep-office-code']=result.rows[0]['rep-office-code'];
      if(mode==='truncated')result.totalCount=result.rows.length+1;
      if(mode==='budget')result.totalCount=1001;
    }
    if(mode==='supplement-duplicate' && 'support-rate' in query.fieldMappings){result.rows.push({...result.rows[0]});result.totalCount=result.rows.length;}
    return result;
  }}});
  let snapshot:DataSnapshot|undefined;
  try{
    for await(const update of program.read({roots:[root],conditions:initialFilterValues(page.filters??[]),views:new Map([[root,defaultSourceView(page,root)]])}))snapshot=update.snapshot;
    return {snapshot,calls,logs:structuredClone(log.mock.calls)};
  }finally{program.dispose();log.mockRestore();}
}

describe('pagedJoin member recovery provenance',()=>{
  it.each(['null','empty-key','duplicate','truncated'])('reports recovered %s by source without business values',async mode=>{
    const {snapshot,logs}=await read(mode);
    expect(snapshot).toMatchObject({status:'ready',warnings:expect.arrayContaining([expect.objectContaining({sourceId:'office-directory'})])});
    const diagnostics=JSON.stringify(snapshot && 'warnings' in snapshot?snapshot.warnings:[]);
    expect(diagnostics).not.toContain('上海');
    expect(logs).toEqual([]);
  });
  it('retains resource rejection and its source locator',async()=>{
    const {snapshot}=await read('budget');
    expect(snapshot).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED',message:expect.stringContaining('office-directory')}});
  });
  it.each([false,true])('reports a supplement duplicate in records=%s',async records=>{
    const {snapshot}=await read('supplement-duplicate',records);
    expect(snapshot).toMatchObject({status:'ready',warnings:expect.arrayContaining([expect.objectContaining({sourceId:'office-support',message:expect.stringContaining('重复')})])});
  });
  it('skips missing association keys in record mode too',async()=>{
    const {snapshot}=await read('null',true);
    expect(snapshot).toMatchObject({status:'ready',totalCount:7,warnings:expect.arrayContaining([expect.objectContaining({sourceId:'office-directory'})])});
  });
  it('keeps successful joins unchanged',async()=>{
    const {snapshot}=await read('ready');
    expect(snapshot).toMatchObject({status:'ready',totalCount:8});
  });
});
