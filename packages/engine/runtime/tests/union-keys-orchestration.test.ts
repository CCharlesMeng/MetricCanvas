import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {QueryDataSource} from '@metriccanvas/page/internal';
import {orchestrate,type PageDataSnapshots} from '../src/orchestrator';
import {createFilterState} from '../src/filter-state';
import type {DataGateway,DataGatewayResult} from '../src/ports';

const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

it('并集等待同轮全部来源；筛选取消旧请求，迟到回执不混入组织或得分',async()=>{
  const input=JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/union-keys-demo.json',import.meta.url),'utf8'));
  const parsed=parsePage(input);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page;
  page.filters=[{id:'scope',type:'dimension',dimension:'scope'}];
  for(const id of ['a','b']) {
    const query:QueryDataSource={fields:{org:{type:'string',role:'dimension',queryField:'组织'},value:{type:'number',role:'measure',queryField:`${id}得分`}},
      source:{type:'query',resultScope:'complete',query:{language:'dqe',body:{dsl_list:[{output_dims:['组织'],output_metrics:[`${id}得分`],filter:{dims:[],metrics:[]}}]},filterBindings:{scope:{target:'dimension',queryField:'范围'}}}}};
    page.dataSources[id]=query;
  }
  const calls:Array<{id:string;signal?:AbortSignal;resolve:(value:DataGatewayResult)=>void}>=[];
  const gateway:DataGateway={fetchData(_query,context,signal){return new Promise(resolve=>calls.push({id:context!.dataSourceIds![0],signal,resolve}));}};
  const filters=createFilterState(new Map());
  let state:PageDataSnapshots=new Map();
  const stop=orchestrate(page,gateway,filters).subscribe(next=>state=next);
  try {
    expect(calls).toHaveLength(2);
    calls[0].resolve({rows:[{org:'旧组织',value:999}],totalCount:1});
    await flush();
    expect(state.get('combined')?.status).toBe('loading');
    filters.write('scope',{type:'dimension',dimension:'scope',values:['新范围']});
    expect(calls[1].signal?.aborted).toBe(true);
    await flush();
    expect(calls).toHaveLength(4);
    calls[1].resolve({rows:[{org:'迟到旧组织',value:999}],totalCount:1});
    calls[2].resolve({rows:[{org:'新甲',value:0}],totalCount:1});
    await flush();
    expect(state.get('combined')?.status).toBe('loading');
    calls[3].resolve({rows:[{org:'新乙',value:null}],totalCount:1});
    await flush();
    expect(state.get('combined')).toMatchObject({status:'ready',totalCount:2,rows:[{org:'新甲',a:0,b:null,total:0},{org:'新乙',a:null,b:null,total:0}]});
  } finally {stop();}
});
