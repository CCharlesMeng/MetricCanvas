import {iocHeaderDeclaration} from '@metriccanvas/page/internal';
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {queryLeaves,type QueryDataSource,type DataSnapshot} from '@metriccanvas/page/internal';
import {pageFilesById} from '../../../tools/scripts/page-files.mjs';
import {prepareIocHeaderFilters} from '../../embed/examples/ioc-header-candidate-bridge';
import {createKeyOfficePriorityGateway} from '../../../apps/playground/fixtures/key-office-filter/gateway';
import {composeEffectiveQuery,executeQuery} from '../src/effective-query';
import type {RuntimeDataGateway} from '../src/ports';
import type {FilterValue} from '../src/filter-values';
import {createDqeGateway} from '../src/dqe/dqe';
import {createQueryRunner} from '../src/query-runner';
import {createSourceProgram} from '../src/source-program/session';

const document=readFileSync('pages/capabilities/filters/key-office-priority-demo.json','utf8');
const options=()=>({signal:new AbortController().signal});
describe.each(['key-office','key-national-only','key-rep-only'])('IOC upstream-format-independent candidate bridge: %s',filterId=>{
  const raw=JSON.parse(document.replaceAll('key-office',filterId));
  it('never reuses old Region initial rows or seeded export snapshots when membership is active',async()=>{
    const input=structuredClone(raw);input.filters[1].default=true;
    input.dataSources.offices.source.initial={capturedAt:'2026-11-04T00:00:00Z',rows:[{'代表处':'南京代表处','金额':999,'客户级别':'卓越'}],totalCount:1};
    const gateway=createKeyOfficePriorityGateway(),prepared=await prepareIocHeaderFilters(input,gateway,options());
    const parsed=parsePage(prepared);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
    const page=parsed.page,conditions=new Map<string,FilterValue>([[filterId,{type:'boolean',value:true}]]);
    const program=createSourceProgram(page,{gateway});
    expect(program.initialSnapshots({roots:['offices'],conditions}).get('offices')).toEqual({status:'loading'});
    const seeds=new Map<string,DataSnapshot>([['offices',{status:'ready',rows:[{office:'南京代表处',amount:999,customer:'卓越'}],totalCount:1}]]);
    for(const purpose of ['screen','complete'] as const)for await(const update of program.read({roots:['offices'],conditions,seeds,purpose,useInitial:true}))expect(update.snapshot).toMatchObject({status:'ready',rows:[{office:'上海代表处'},{office:'深圳代表处'}]});
    program.dispose();
  });
  it('requests the complete authorized office membership without Region and binds Chinese names',async()=>{
    const original=structuredClone(raw),requests:unknown[]=[];
    const gateway=createKeyOfficePriorityGateway((kind,request)=>{if(kind==='candidates')requests.push(request);});
    const page=await prepareIocHeaderFilters(raw,gateway,options());
    expect(requests).toEqual([{filterId,dimension:'rep-office-name',constraints:{dimensions:{},times:{},booleans:{[filterId]:true}}}]);
    const source=page.dataSources.offices as QueryDataSource;
    expect(source.source.query.filterBindings![filterId]).toEqual({target:'boolean',queryField:'代表处',whenTrue:['上海代表处','深圳代表处']});
    expect(raw).toEqual(original);expect(parsePage(page).ok).toBe(true);
  });
  it('accepts the current first-section IOC header envelope',async()=>{
    const document=structuredClone(raw);
    expect(document.sections[0].components[0].type).toBe('iocHeader');
    const page=await prepareIocHeaderFilters(document,createKeyOfficePriorityGateway(),options());
    expect(parsePage(page).ok).toBe(true);
    expect((page.dataSources.offices as QueryDataSource).source.query.filterBindings![filterId]).toMatchObject({queryField:'代表处',whenTrue:['上海代表处','深圳代表处']});
  });
  it('keeps the legacy root header readable while intersecting its explicit Region override',async()=>{
    const document=structuredClone(raw);document.iocHeader=document.sections[0].components.shift().props;
    document.schemaVersion='6.84';document.filters[1].overridesFilters=['region'];
    const gateway=createKeyOfficePriorityGateway(),prepared=await prepareIocHeaderFilters(document,gateway,options());
    const parsed=parsePage(prepared);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
    const page=parsed.page,conditions=new Map<string,FilterValue>([
      [filterId,{type:'boolean',value:true}],
      ['region',{type:'dimension',dimension:'demo_office',level:'office',values:['南京代表处']}]
    ]);
    const query=composeEffectiveQuery({page,filters:page.filters,dataSource:page.dataSources.offices as QueryDataSource},conditions,0,[],{});
    expect(await executeQuery(query,gateway,{})).toEqual({status:'empty',totalCount:0});
  });
  it.each(['denied','unavailable','unconfigured'] as const)('blocks %s membership before page initialization',async kind=>{
    const gateway:RuntimeDataGateway={async fetchData(){return {rows:[]};},async fetchFilterCandidates(){return {kind};}};
    await expect(prepareIocHeaderFilters(raw,gateway,options())).rejects.toMatchObject({code:'DQE_CONFIG_ERROR'});
  });
  it('does not query a broad result when an authorized complete membership is empty',async()=>{
    let executions=0;
    const gateway:RuntimeDataGateway={async fetchData(){executions++;return {rows:[]};},async fetchFilterCandidates(){return {kind:'values',candidates:[]};}};
    const page=await prepareIocHeaderFilters(raw,gateway,options());
    expect(parsePage(page).ok).toBe(true);
    const input=new Map<string,FilterValue>([[filterId,{type:'boolean',value:true}]]);
    const query=composeEffectiveQuery({filters:page.filters,dataSource:page.dataSources.offices as QueryDataSource},input,0,[],{});
    expect(await executeQuery(query,gateway,{})).toEqual({status:'empty',totalCount:0});expect(executions).toBe(0);
    const dqe=createDqeGateway({fetchImpl:async()=>{executions++;throw Error('Empty membership must not call HTTP');}});
    expect(await dqe.fetchData(query)).toEqual({rows:[],totalCount:0});
    const runner=createQueryRunner({gateway});
    expect(await runner.runCandidates({query,field:'office',queryField:'代表处',search:'',offset:0,limit:20},{},'empty')).toEqual({kind:'values',candidates:[],totalCount:0});
    runner.dispose();expect(executions).toBe(0);
    const older=structuredClone(page);older.schemaVersion='6.80';
    const olderKey=older.filters?.find(filter=>filter.id===filterId);
    if(olderKey?.type==='boolean')delete olderKey.overridesFilters;
    expect(parsePage(older).ok).toBe(false);
  });
  it('rejects malformed or partial structural membership and never accepts a late cancelled receipt',async()=>{
    const controller=new AbortController();
    const gateway:RuntimeDataGateway={async fetchData(){return {rows:[]};},async fetchFilterCandidates(){controller.abort();return {kind:'values',candidates:[{value:'上海代表处',label:'上海代表处'}]};}};
    await expect(prepareIocHeaderFilters(raw,gateway,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
    gateway.fetchFilterCandidates=async()=>({kind:'values',candidates:[{value:'上海代表处',label:'上海代表处',parent:{level:'region-dept',value:'不存在的父节点'}}]});
    await expect(prepareIocHeaderFilters(raw,gateway,options())).rejects.toMatchObject({code:'DQE_CONFIG_ERROR'});
  });
  it('wires every IOC header query while preserving the four approval documents and their other conditions',async()=>{
    let count=0,customerQueries=0;
    for(const [id,file]of pageFilesById('pages')){
      if(!file.includes('/business/dashboard/ioc/'))continue;
      const document=JSON.parse(readFileSync(file,'utf8'));if(!iocHeaderDeclaration(document))continue;
      const page=await prepareIocHeaderFilters(document,createKeyOfficePriorityGateway(),options());
      expect(parsePage(page).ok,id).toBe(true);count++;
      for(const [sourceId,source] of Object.entries(page.dataSources)){
        if(source.source.type!=='query')continue;
        const originalLeaves=queryLeaves(document.dataSources[sourceId].source.query);
        for(const [index,leaf] of queryLeaves(source.source.query).entries()){
          expect(Object.keys(leaf.filterBindings??{})).toEqual(expect.arrayContaining(Object.keys(originalLeaves[index].filterBindings??{})));
          if(leaf.filterBindings?.region)expect(leaf.filterBindings.region).toMatchObject({target:'dimension',levelQueryFields:{'region-dept':'地区部',office:'代表处'}});
          for(const id of ['customer-category','na-type'])if(leaf.filterBindings?.[id]){expect(leaf.filterBindings[id]).toEqual(originalLeaves[index].filterBindings?.[id]);customerQueries++;}
          const filter=page.filters?.find(f=>['key-office','key-national-only','key-rep-only'].includes(f.id));
          if(filter&&leaf.filterBindings?.[filter.id])expect(leaf.filterBindings[filter.id]).toEqual({target:'boolean',queryField:'代表处',whenTrue:['上海代表处','深圳代表处']});
        }
      }
    }
    expect(count).toBeGreaterThanOrEqual(8);expect(customerQueries).toBeGreaterThanOrEqual(20);
  });
});
