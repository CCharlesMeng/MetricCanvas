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

describe('pagedJoin member failure provenance',()=>{
  it('prints the failing member, query field and one-based row without business values',async()=>{
    const {snapshot,calls,logs}=await read('null');
    expect(snapshot).toMatchObject({status:'error',error:{code:'DQE_ROW_CONTRACT_ERROR'}});
    const message=snapshot?.status==='error'?snapshot.error.message:'';
    for(const locator of ['office-overview','directory','office-directory','rep-office-code','rep_office_code','第 1 行','实际 null','/dataSources/office-overview/source/members/directory/key'])expect(message).toContain(locator);
    expect(message.split('\n')[0]).toBe('无法合并表格数据：第 1 行的“代表处编码”为空，无法关联其他数据。请检查查询是否返回了有效的“代表处编码”。');
    expect(message.split('\n')[0]).not.toContain('directory');
    expect(calls).toHaveLength(1);
    expect(logs).toEqual([[expect.stringContaining(message),expect.objectContaining({pageId:fixture.id,dataSourceId:root,components:expect.any(Array)})]]);
    expect(JSON.stringify(logs)).not.toContain('上海');
  });
  it.each([
    ['duplicate','DQE_ROW_CONTRACT_ERROR','第 2 行','第 1 行'],
    ['truncated','DQE_ROW_CONTRACT_ERROR','返回 8 行','totalCount=9'],
    ['budget','DQE_QUERY_REJECTED','totalCount=1001','maxRows=1000']
  ])('%s retains the failure classification and source locator',async(mode,code,first,second)=>{
    const {snapshot}=await read(mode);
    expect(snapshot).toMatchObject({status:'error',error:{code,message:expect.stringContaining('office-directory')}});
    const message=snapshot?.status==='error'?snapshot.error.message:'';
    expect(message).toContain(first);expect(message).toContain(second);
  });
  it('distinguishes an empty string from null without printing its value',async()=>{
    const {snapshot}=await read('empty-key');
    expect(snapshot).toMatchObject({status:'error',error:{message:expect.stringContaining('实际 空字符串')}});
  });
  it.each([false,true])('locates a supplement duplicate in records=%s',async records=>{
    const {snapshot}=await read('supplement-duplicate',records);
    expect(snapshot).toMatchObject({status:'error',error:{code:'DQE_ROW_CONTRACT_ERROR',message:expect.stringContaining('office-support')}});
    const message=snapshot?.status==='error'?snapshot.error.message:'';
    expect(message).toContain('重复');expect(message).toContain('第 9 行');
  });
  it('locates missing association keys in record mode too',async()=>{
    const {snapshot}=await read('null',true);
    expect(snapshot).toMatchObject({status:'error',error:{code:'DQE_ROW_CONTRACT_ERROR',message:expect.stringContaining('第 1 行')}});
    const message=snapshot?.status==='error'?snapshot.error.message:'';
    expect(message).toContain('office-directory');expect(message).toContain('rep_office_code');
  });
  it('keeps successful joins unchanged',async()=>{
    const {snapshot}=await read('ready');
    expect(snapshot).toMatchObject({status:'ready',totalCount:8});
  });
});
