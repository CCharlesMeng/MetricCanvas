import {expect,test,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {MountOptions,RuntimeEvent,RuntimeDataGateway} from '../../src';

const document=JSON.parse(readFileSync(new URL('../../../../pages/capabilities/query/dqe-request-timeout.json',import.meta.url),'utf8'));
declare global {
  interface Window {
    authState:{requests:number;handled:number;status:number;events:RuntimeEvent[];throwHandler:boolean;throwEvent:boolean};
    authInput:MountOptions;
    authGateway:RuntimeDataGateway;
    authApi:typeof import('../../src');
  }
}

async function mountPage(page:Page,status:number,mode='esm'){
  await page.goto('/examples/inline.html');
  await page.evaluate(async({document,status,mode})=>{
    window.runtime.destroy();
    const url='/dist/metriccanvas-runtime.es.js';
    const api=mode==='global'?await MetricCanvas.ready:await import(url);
    window.authApi=api;
    const state=window.authState={requests:0,handled:0,status,events:[] as RuntimeEvent[],throwHandler:false,throwEvent:false};
    window.authGateway=api.createDqeGateway({maxConcurrentBatches:1,fetchImpl:async()=>{
      state.requests++;
      if(state.status!==200)return new Response(null,{status:state.status});
      return Response.json({retCode:'CBC.0000',results:[{code:'SUCCESS',total_count:1,data:[{'审批记录ID':`row-${state.requests}`,'商务编号':'demo','特价审批通过时间':'2025-01-01','区域':'demo','审批金额':100,'预算金额':200}]}]});
    }});
    window.authInput={document,dataGateway:window.authGateway,onEvent:event=>{
      state.events.push(event);
      if(event.type==='auth-required'&&state.throwEvent)throw Error('observer failed');
    },onAuthRequired:()=>{state.handled++;if(state.throwHandler)return Promise.reject(Error('application failed'));}};
    window.runtime=api.mount('#dashboard',window.authInput);
  },{document,status,mode});
}

for(const mode of ['esm','global'])for(const status of [401,403,419]){
  test(`${mode}: HTTP ${status} terminates once without retry and cannot be revived by update`,async({page})=>{
    await mountPage(page,status,mode);
    await expect.poll(()=>page.evaluate(()=>window.authState.handled)).toBe(1);
    expect(await page.evaluate(()=>window.authState.requests)).toBe(1);
    expect(await page.evaluate(()=>window.authState.events.filter(event=>event.type==='auth-required'))).toEqual([{type:'auth-required',status}]);
    await expect(page.getByRole('table')).toHaveCount(0);
    await page.evaluate(()=>{window.authState.status=200;window.runtime.update({...window.authInput,initialSearch:'changed=1'});});
    await page.waitForTimeout(50);
    expect(await page.evaluate(()=>window.authState.requests)).toBe(1);
    await page.evaluate(()=>{window.runtime.destroy();window.runtime=window.authApi.mount('#dashboard',window.authInput);});
    await expect(page.getByRole('cell',{name:'row-2',exact:true})).toBeVisible();
  });
}

test('removing the handler uses existing errors; callback replacement does not refetch',async({page})=>{
  await mountPage(page,200);
  await expect(page.getByRole('cell',{name:'row-1',exact:true})).toBeVisible();
  await page.evaluate(()=>window.runtime.update({...window.authInput,onAuthRequired:()=>{window.authState.handled+=10;}}));
  await page.waitForTimeout(50);
  expect(await page.evaluate(()=>window.authState.requests)).toBe(1);
  await page.evaluate(()=>{
    window.authState.status=403;
    const {onAuthRequired:_removed,...input}=window.authInput;
    window.runtime.update({...input,initialSearch:'changed=1'});
  });
  await expect.poll(()=>page.evaluate(()=>window.authState.events.some(event=>event.type==='data-error'&&event.code==='DQE_FORBIDDEN'))).toBe(true);
  expect(await page.evaluate(()=>window.authState.handled)).toBe(0);
  await expect(page.getByRole('table')).toHaveCount(1);
  await page.evaluate(()=>window.runtime.update({...window.authInput,initialSearch:'changed=2',onAuthRequired:()=>{window.authState.handled+=10;}}));
  await expect.poll(()=>page.evaluate(()=>window.authState.handled)).toBe(10);
});

test('queued queries stop and application exceptions do not interrupt termination',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await mountPage(page,200);
  await expect(page.getByRole('table')).toBeVisible();
  await page.evaluate(()=>{
    const source=structuredClone(window.authInput.document) as typeof document;
    for(let index=0;index<6;index++){
      const id=`extra${index}`;
      source.dataSources[id]=structuredClone(source.dataSources.records);
      source.dataSources[id].source.query.body.dsl_list[0].object_type+=id;
      const table=structuredClone(source.sections[0].components[0]);table.id=id;table.data.main=id;
      source.sections[0].components.push(table);
    }
    window.authState.status=419;window.authState.throwHandler=true;window.authState.throwEvent=true;
    window.runtime.update({...window.authInput,document:source});
  });
  await expect.poll(()=>page.evaluate(()=>window.authState.handled)).toBe(1);
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>window.authState.requests)).toBe(2);
  await expect(page.getByRole('table')).toHaveCount(0);
  expect(errors).toEqual([]);
});
