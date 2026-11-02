import {beforeAll,afterAll,describe,expect,it,vi} from 'vitest';
import document from '../../../../pages/capabilities/table/record-join-query-params.json';
import businessDocument from '../../../../pages/business/dashboard/ioc/commercial/business-decision-all-details.json';
import {withIocRegionCandidates} from '../../../../apps/playground/src/lib/ioc-region-preview';
import {createDqeGateway} from '../../../data-execution/src/dqe/dqe';
import {createDqeSimServer,DQE_EXECUTE_PATH} from '../../../../tools/dqe-sim/src/server';
import type {JsonObject,EffectiveQuery} from '@metriccanvas/page/internal';
import {parsePage} from '@metriccanvas/page';
import {resolvePageParams,initializePageParams,createFilterState,orchestrate,type PageDataSnapshots} from '../src';

const server=createDqeSimServer({logger:false});
let endpoint='';
beforeAll(async()=>{
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();
  if(!address||typeof address==='string')throw new Error('Sim HTTP address');
  endpoint='http://127.0.0.1:'+address.port+DQE_EXECUTE_PATH;
});
afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});

function load(search:string,raw:unknown=document){
  const declared=parsePage(raw);
  if(!declared.ok)throw new Error(JSON.stringify(declared.errors));
  const inputs=resolvePageParams(search,declared.page.params??[]);
  expect(inputs.missing).toEqual([]);
  const parsed=parsePage(raw,{textValues:{values:inputs.values}});
  if(!parsed.ok)throw new Error(JSON.stringify(parsed.errors));
  return initializePageParams(parsed.page,inputs.values);
}
function start(search:string,state='ready',raw:unknown=document){
  const page=load(search,raw),calls:EffectiveQuery[]=[],items:JsonObject[]=[];
  const dataGateway=createDqeGateway({endpoint:state==='error'?endpoint+'/unavailable':endpoint,fetchImpl:async(url,init)=>{
    items.push(...JSON.parse(String(init?.body)).dsl_list);
    return fetch(url,init);
  }});
  const fetchData=dataGateway.fetchData.bind(dataGateway);
  vi.spyOn(dataGateway,'fetchData').mockImplementation((query,context,signal)=>{
    calls.push(structuredClone(query));return fetchData(query,context,signal);
  });
  const candidates=vi.spyOn(dataGateway,'fetchDimensionValues');
  const filters=createFilterState(undefined,page.filters??[],new Map(),{candidates:true});
  const stream=orchestrate(page,dataGateway,filters);
  let snapshots:PageDataSnapshots=new Map();
  const stop=stream.subscribe(next=>snapshots=next);
  return {page,preview:{calls},items,candidates,filters,stream,stop,snapshot:()=>snapshots.get('joined')};
}

describe('record join query parameters through runtime',()=>{
  it('sends approver-name only on the supplied business page main execute request',async()=>{
    const page=load('?approver-name=合成审批人甲',businessDocument),items:JsonObject[]=[];
    const gateway=withIocRegionCandidates(createDqeGateway({endpoint,fetchImpl:async(url,init)=>{
      items.push(...JSON.parse(String(init?.body)).dsl_list);
      return fetch(url,init);
    }}));
    const filters=createFilterState(new Map([['mtime',{type:'timeRange',from:'2026-11',to:'2026-11',selection:{mode:'month',value:'2026-11'}}]]),page.filters??[],new Map(),{candidates:false});
    const stream=orchestrate(page,gateway,filters);
    let snapshots:PageDataSnapshots=new Map();
    const stop=stream.subscribe(next=>snapshots=next);
    try{
      await vi.waitFor(()=>expect(snapshots.get('decision-overview')).toMatchObject({status:'ready',totalCount:24}));
      const main=items.filter(item=>item.query_type==='object');
      expect(main).toHaveLength(1);
      expect(main[0]).toMatchObject({filter:{fields:expect.arrayContaining([
        {field_name:'审批人姓名',value_list:['合成审批人甲'],operator:'='}
      ])}});
      const basics=items.filter(item=>item.query_type!=='object');
      expect(basics).toHaveLength(1);
      expect(JSON.stringify(basics)).not.toContain('审批人姓名');
      expect(JSON.stringify(basics)).toContain('商务ID');
      expect(items).toHaveLength(2);
    }finally{stop();}
  });
  it('filters only the domain source and preserves duplicate-business records, missing supplements and pagination',async()=>{
    const run=start('?approver-name=合成审批人甲');
    try{
      await vi.waitFor(()=>expect(run.snapshot()).toMatchObject({status:'ready',totalCount:3}));
      expect(run.snapshot()).toMatchObject({rows:[{'record-id':'A-1','owner-name':'合成责任人甲'},{'record-id':'A-2','owner-name':'合成责任人甲'}]});
      const items=run.items;
      expect(items.filter(item=>item.query_type==='object')).toEqual(expect.arrayContaining([
        expect.objectContaining({filter:{fields:[{field_name:'审批人姓名',value_list:['合成审批人甲'],operator:'='}]}})
      ]));
      const supplemental=JSON.stringify(items.filter(item=>item.query_type!=='object'));
      expect(supplemental).not.toContain('审批人姓名');
      expect(supplemental).toContain('商务ID');
      expect(run.page.sections[0].components[0].props.title).toBe('合成审批人甲 - 商务决策明细');
      run.stream.setQueryPage('joined',1);
      await vi.waitFor(()=>expect(run.snapshot()).toMatchObject({rows:[{'record-id':'A-4','owner-name':null}],totalCount:3}));
      expect(run.filters.blocked().size).toBe(0);
      expect(run.candidates).not.toHaveBeenCalled();
    }finally{run.stop();}
  });
  it('changes input at the next open, and optional missing input does not filter the main source',async()=>{
    for(const [search,totalCount] of [['?approver-name=合成审批人乙',1],['',4]] as const){
      const run=start(search);
      try{
        await vi.waitFor(()=>expect(run.snapshot()).toMatchObject({status:'ready',totalCount}));
        expect(run.candidates).not.toHaveBeenCalled();
        if(!search)expect(run.page.sections[0].components[0].props.title).toBeUndefined();
      }finally{run.stop();}
    }
  });
  it('keeps a supplemental-only parameter local and retains unmatched domain records as null',async()=>{
    const run=start('?owner-name=合成责任人甲');
    try{
      await vi.waitFor(()=>expect(run.snapshot()).toMatchObject({status:'ready',totalCount:4}));
      const main=JSON.stringify(run.items.filter(item=>item.query_type==='object'));
      expect(main).not.toContain('责任人名称');
      run.stream.setQueryPage('joined',1);
      await vi.waitFor(()=>expect(run.snapshot()).toMatchObject({rows:[{'record-id':'A-3','owner-name':null},{'record-id':'A-4','owner-name':null}]}));
      expect(run.candidates).not.toHaveBeenCalled();
    }finally{run.stop();}
  });
  it('keeps no-match input empty without querying supplements or candidates',async()=>{
    const run=start('?approver-name=没有匹配记录');
    try{
      await vi.waitFor(()=>expect(run.snapshot()).toMatchObject({status:'empty',totalCount:0}));
      expect(run.preview.calls.every(query=>'sequence' in query.fieldMappings)).toBe(true);
      expect(run.candidates).not.toHaveBeenCalled();
    }finally{run.stop();}
  });
  it('preserves transport failure instead of returning a partial join',async()=>{
    const run=start('?approver-name=合成审批人甲','error');
    try{
      await vi.waitFor(()=>expect(run.snapshot()).toMatchObject({status:'error',error:{code:'DQE_TRANSPORT_ERROR'}}));
      expect(run.candidates).not.toHaveBeenCalled();
    }finally{run.stop();}
  });
  it('also preserves member-local inputs under explicit records query pagination',async()=>{
    const source=document.dataSources.joined.source;
    const {fallback:_fallback,records:_records,...rest}=source;
    const raw={...document,schemaVersion:'6.76',dataSources:{...document.dataSources,joined:{...document.dataSources.joined,source:{
      ...rest,members:{
        decision:{...source.members.decision,canSelectPage:true},
        basic:{...source.members.basic,canSelectPage:true}
      },pagination:{mode:'query',pageSize:2,batchSize:2},records:{maxBytes:67108864,timeoutMs:60000}
    }}}};
    const run=start('?approver-name=合成审批人甲','ready',raw);
    try{
      await vi.waitFor(()=>expect(run.snapshot()).toMatchObject({status:'ready',totalCount:3}));
      run.stream.setQueryPage('joined',1);
      await vi.waitFor(()=>expect(run.snapshot()).toMatchObject({rows:[{'record-id':'A-4','owner-name':null}]}));
      expect(run.candidates).not.toHaveBeenCalled();
      expect(JSON.stringify(run.items.filter(item=>item.query_type!=='object'))).not.toContain('审批人姓名');
    }finally{run.stop();}
  });
});
