import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '../../../packages/page/src';
import {createDqeGateway} from '../../../packages/data-execution/src/dqe';
import {createSourceProgram,initialFilterValues} from '../../../packages/data-execution/src/runtime';
import {createDqeSimServer,DQE_EXECUTE_PATH} from '../src/server';

it('ordinary demo metrics use native names, never unsupported name/alias objects',()=>{
  const page=JSON.parse(readFileSync('pages/capabilities/filters/query-mode-chart-demo.json','utf8'));
  for(const source of Object.values(page.dataSources) as any[]){
    const cases=source.source.query.queryModes.cases;
    expect(cases.contracts.body.dsl_list[0].output_metrics).toEqual(['签约金额']);
    expect(cases.opportunities.body.dsl_list[0].output_metrics).toEqual(['商机金额']);
  }
});

it('the actual demo normalizes native HTTP response keys and exports the selected synthetic branch',async()=>{
  const parsed=parsePage(JSON.parse(readFileSync('pages/capabilities/filters/query-mode-chart-demo.json','utf8')));if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const server=createDqeSimServer({logger:false});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw Error('server');
  const exchanges:Array<{request:any;response:any}>=[];
  const page=parsed.page,values=initialFilterValues(page.filters??[]),program=createSourceProgram(page,{gateway:createDqeGateway({endpoint:`http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`,fetchImpl:async(input,init)=>{
    const response=await fetch(input,init);exchanges.push({request:JSON.parse(String(init!.body)),response:await response.clone().json()});return response;
  }})});
  async function read(purpose:'screen'|'complete'='screen'){
    const snapshots=new Map();
    for await(const update of program.read({roots:['amount-trend','amount-total'],conditions:values,purpose}))snapshots.set(update.sourceId,update.snapshot);
    return snapshots;
  }
  try{
    let result=await read();expect(result.get('amount-total')).toMatchObject({rows:[{amount:810000}]});expect(result.get('amount-trend')).toMatchObject({rows:[{month:'2026-01',amount:110000},{amount:120000},{amount:130000},{amount:140000},{amount:150000},{amount:160000}]});
    values.set('business',{type:'dimension',dimension:'business_mode',values:['opportunities']});result=await read();expect(result.get('amount-total')).toMatchObject({rows:[{amount:2430000}]});
    values.set('region',{type:'dimension',dimension:'business_region',values:['south']});result=await read('complete');expect(result.get('amount-total')).toMatchObject({rows:[{amount:1890000}]});expect(result.get('amount-trend')).toMatchObject({rows:[{amount:240000},{amount:270000},{amount:300000},{amount:330000},{amount:360000},{amount:390000}]});
    values.set('business',{type:'dimension',dimension:'business_mode',values:['contracts']});result=await read();expect(result.get('amount-total')).toMatchObject({rows:[{amount:630000}]});
    for(const exchange of exchanges){
      for(const item of exchange.request.dsl_list){
        expect(item.output_metrics.every((metric:unknown)=>typeof metric==='string')).toBe(true);expect(item).not.toHaveProperty('fieldMappings');
      }
      for(const item of exchange.response.results){
        expect(item.total_count).toBe(0);
        for(const row of item.data){expect(row).not.toHaveProperty('金额');expect(Object.keys(row).some(key=>key==='签约金额'||key==='商机金额')).toBe(true);}
      }
    }
  }finally{program.dispose();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
