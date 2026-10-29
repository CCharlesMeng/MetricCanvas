import fs from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {Page,DataSnapshot,TableQueryView} from '@metriccanvas/page/internal';
import {createSourceProgram,defaultSourceView,initialFilterValues} from '../src/runtime';
import {createRejectionPreview} from '../../../apps/playground/fixtures/rejection-details/gateway';
const document=JSON.parse(fs.readFileSync(new URL('../../../pages/business-rejection-details.json',import.meta.url),'utf8'));
const root='rejection-overview';
function parsed():Page{const result=parsePage(document);if(!result.ok)throw Error(JSON.stringify(result.errors));return result.page;}
function setup(options:Parameters<typeof createRejectionPreview>[0]={},page=parsed()){
  const preview=createRejectionPreview(options),program=createSourceProgram(page,{gateway:preview.dataGateway});
  const conditions=initialFilterValues(page.filters??[]);
  async function read(patch:Partial<TableQueryView>={},extra:Partial<Parameters<typeof program.read>[0]>={}){
    let snapshot:DataSnapshot|undefined;
    for await(const result of program.read({roots:[root],conditions,views:new Map([[root,{...defaultSourceView(page,root),...patch}]]),...extra}))if(result.sourceId===root)snapshot=result.snapshot;
    return snapshot!;
  }
  return {...preview,program,conditions,read,page};
}
function total(snapshot:DataSnapshot){return 'totalCount' in snapshot?snapshot.totalCount:undefined;}
function rows(snapshot:DataSnapshot){if(snapshot.status!=='ready')throw Error(JSON.stringify(snapshot));return snapshot.rows;}
describe('record-preserving pagedJoin',()=>{
  it('keeps both approvals per business and distinct record identities above 1000 rows',async()=>{
    const test=setup();try{
      const result=await test.read({pageSize:1000});expect(total(result)).toBe(1205);
      const first=rows(result);expect(first).toHaveLength(1000);expect(new Set(first.map(row=>row['record-id'])).size).toBe(1000);
      expect(new Set(first.map(row=>row['biz-id'])).size).toBeLessThan(1000);
      const next=rows(await test.read({pageIndex:1,pageSize:1000}));expect(next).toHaveLength(205);
      expect(next.every(row=>!first.some(previous=>previous['record-id']===row['record-id']))).toBe(true);
    }finally{test.program.dispose();}
  });
  it('searches the whole population and reuses the complete snapshot for pages and headers',async()=>{
    const test=setup();try{
      await test.read();const requests=test.calls.length;
      const search=await test.read({search:{fields:['biz-code'],query:'BIZ-00001'}});
      expect(total(search)).toBe(2);expect(rows(search).map(row=>row['approval-stage']).sort()).toEqual(['初审','复审']);
      const candidates=await test.program.readColumnCandidates({sourceId:root,field:'life-status',conditions:test.conditions,view:{...defaultSourceView(test.page,root),predicates:[{field:'life-status',op:'in',values:['已关闭']}]}});
      expect(candidates).toMatchObject({kind:'values',totalCount:2});expect(test.calls).toHaveLength(requests);
    }finally{test.program.dispose();}
  });
  it('filters basic status globally and retains null for missing basic matches',async()=>{
    const test=setup({rows:8});try{
      const missing=rows(await test.read({search:{fields:['biz-code'],query:'BIZ-00000'}}));
      expect(missing).toHaveLength(2);expect(missing.every(row=>row['life-status']===null)).toBe(true);
      const closed=await test.read({predicates:[{field:'life-status',op:'in',values:['已关闭']}]});expect(total(closed)).toBe(4);
    }finally{test.program.dispose();}
  });
  it('applies local month boundaries and changes the snapshot when mtime changes',async()=>{
    const test=setup({rows:8});try{
      expect(total(await test.read())).toBe(8);
      const august=new Map(test.conditions);august.set('mtime',{type:'timeRange',from:'2026-08',to:'2026-08'});
      expect(await test.read({}, {conditions:august})).toMatchObject({status:'empty',totalCount:0});
      expect(total(await test.read())).toBe(8);
      const basicCalls=test.calls.filter(query=>!('approval-stage' in query.fieldMappings));
      expect(basicCalls.every(query=>query.filterValues.every(value=>value.target!=='time'))).toBe(true);
    }finally{test.program.dispose();}
  });
  it('exports approval records without treating repeated business IDs as duplicate rows',async()=>{
    const test=setup();try{const result=await test.read({}, {purpose:'complete'});expect(rows(result)).toHaveLength(1205);expect(new Set(rows(result).map(row=>row['record-id'])).size).toBe(1205);}finally{test.program.dispose();}
  });
  it('keeps first conflicting basic row with a warning',async()=>{
    const test=setup({rows:6,duplicateBasic:true});try{expect(await test.read()).toMatchObject({status:'ready',totalCount:6,warnings:expect.any(Array)});}finally{test.program.dispose();}
  });
  it.each(['maxRows','maxBytes'] as const)('rejects %s limits without partial results',async key=>{
    const page=parsed(),source=page.dataSources[root].source;if(source.type!=='pagedJoin')throw Error('join');source.records![key]=key==='maxRows'?10:1024;
    const test=setup({},page);try{expect(await test.read()).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}});}finally{test.program.dispose();}
  });
  it('refreshes data instead of returning the cached complete result',async()=>{
    const test=setup({rows:8});try{await test.read();const count=test.calls.length;await test.read({}, {freshness:'refresh'});expect(test.calls.length).toBeGreaterThan(count);}finally{test.program.dispose();}
  });
  it('cancels in-flight reads and permits a later successful read',async()=>{
    const test=setup({rows:8,delayMs:15}),controller=new AbortController();
    try{const pending=test.read({}, {signal:controller.signal});controller.abort();await expect(pending).rejects.toBeDefined();expect(total(await test.read())).toBe(8);}finally{test.program.dispose();}
  });
  it('propagates upstream failure without presenting a partial join',async()=>{
    const test=setup({rows:8,failure:true});try{expect(await test.read()).toMatchObject({status:'error',error:{code:'DQE_TRANSPORT_ERROR'}});}finally{test.program.dispose();}
  });
  it('allows candidates beyond export limits while rejecting an oversized full export',async()=>{
    const test=setup({rows:10001});try{
      const candidates=await test.program.readColumnCandidates({sourceId:root,field:'life-status',conditions:test.conditions,view:defaultSourceView(test.page,root)});
      expect(candidates).toMatchObject({kind:'values',totalCount:2});
      await expect(test.read({}, {purpose:'complete'})).rejects.toMatchObject({code:'EXPORT_ROW_LIMIT'});
    }finally{test.program.dispose();}
  });
  it.each(['truncated','changed-total'] as const)('warns about %s during the main scan',async fault=>{
    const page=parsed(),preview=createRejectionPreview({rows:1205});
    const gateway={async fetchData(query:Parameters<typeof preview.dataGateway.fetchData>[0]){
      const result=await preview.dataGateway.fetchData(query);
      if('approval-stage' in query.fieldMappings&&(query.pagination?.offset??0)>0){
        if(fault==='truncated')result.rows=result.rows.slice(1);
        else result.totalCount=(result.totalCount??0)+1;
      }
      return result;
    }};
    const program=createSourceProgram(page,{gateway});
    try{
      let snapshot:DataSnapshot|undefined;
      for await(const update of program.read({roots:[root],conditions:initialFilterValues(page.filters??[])}))snapshot=update.snapshot;
      expect(snapshot).toMatchObject({status:'ready',warnings:expect.any(Array)});
    }finally{program.dispose();}
  });
  it('fails timed-out reads without caching partial results',async()=>{
    const page=parsed(),source=page.dataSources[root].source;if(source.type!=='pagedJoin')throw Error('join');source.records!.timeoutMs=1;
    const test=setup({rows:8,delayMs:15},page);
    try{expect(await test.read()).toMatchObject({status:'error',error:{code:'DQE_TIMEOUT'}});}finally{test.program.dispose();}
  });

  it.each(['iso','compact','invalid'] as const)('handles declared %s local date values',async format=>{
    const page=parsed(),source=page.dataSources[root].source;if(source.type!=='pagedJoin')throw Error('join');
    source.records!.timeFilters={mtime:{field:'biz-approve-time',valueFormat:format==='compact'?'compact':'iso'}};
    const main=page.dataSources['rejection-details'].source;if(main.type!=='query')throw Error('query');delete main.query.filterBindings!.mtime;
    const preview=createRejectionPreview({rows:6});
    const gateway={async fetchData(query:Parameters<typeof preview.dataGateway.fetchData>[0]){
      const result=await preview.dataGateway.fetchData(query);
      if('approval-stage' in query.fieldMappings)result.rows=result.rows.map(row=>({...row,'biz-approve-time':dateValue(String(row['biz-approve-time']),format)}));
      return result;
    }};
    const program=createSourceProgram(page,{gateway});
    try{
      let snapshot:DataSnapshot|undefined;
      for await(const update of program.read({roots:[root],conditions:initialFilterValues(page.filters??[])}))snapshot=update.snapshot;
      if(format==='invalid')expect(snapshot).toMatchObject({status:'empty',totalCount:0,warnings:expect.any(Array)});
      else expect(snapshot).toMatchObject({status:'ready',totalCount:6});
    }finally{program.dispose();}
  });

});

function dateValue(value:string,format:'iso'|'compact'|'invalid'):string{
  if(format==='invalid')return '2026-09-99';
  return format==='compact'?value.slice(0,10).replaceAll('-',''):value.slice(0,10);
}


it('fully joins more than 100000 records without maxRows and searches the final record',async()=>{
  const document=JSON.parse(fs.readFileSync(new URL('../../../pages/capabilities/table/record-join-no-row-limit.json',import.meta.url),'utf8'));
  const result=parsePage(document);if(!result.ok)throw Error(JSON.stringify(result.errors));
  const source=result.page.dataSources[root].source;
  if(source.type!=='pagedJoin')throw Error('join');
  expect(source.records!.maxRows).toBeUndefined();
  const test=setup({rows:100001},result.page);
  try{
    const snapshot=await test.read({pageSize:10});
    expect(snapshot).toMatchObject({status:'ready',totalCount:100001});
    expect(rows(snapshot)).toHaveLength(10);
    const count=test.calls.length;
    const last=await test.read({search:{fields:['biz-code'],query:'BIZ-50000'}});
    expect(last).toMatchObject({status:'ready',totalCount:1});
    expect(rows(last)[0]).toMatchObject({'biz-code':'BIZ-50000','biz-owner-name':'测试责任人0'});
    expect(test.calls).toHaveLength(count);
  }finally{test.program.dispose();}
},60000);

it('continues past an upstream total of 1299225 when no row budget is declared',async()=>{
  const page=parsed(),preview=createRejectionPreview({rows:500});
  let mainBatches=0;
  const gateway={async fetchData(query:Parameters<typeof preview.dataGateway.fetchData>[0]){
    if('approval-stage' in query.fieldMappings){
      mainBatches++;
      if(mainBatches===2)throw Object.assign(new Error('合成上游在第二批失败'),{code:'DQE_TRANSPORT_ERROR'});
      return {...await preview.dataGateway.fetchData(query),totalCount:1299225};
    }
    return preview.dataGateway.fetchData(query);
  }};
  const program=createSourceProgram(page,{gateway});
  try{
    let snapshot:DataSnapshot|undefined;
    for await(const update of program.read({roots:[root],conditions:initialFilterValues(page.filters??[])}))snapshot=update.snapshot;
    expect(mainBatches).toBe(2);
    expect(snapshot).toMatchObject({status:'error',error:{code:'DQE_TRANSPORT_ERROR'}});
  }finally{program.dispose();}
});
