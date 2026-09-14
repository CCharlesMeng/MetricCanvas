import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const template = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/dimension-params-page.json',import.meta.url),'utf8'));
for (const mode of ['classic','esm']) {
  test(`${mode} IOC执行初始快照、实际取值、部分错误与最后筛选记录`, async ({page}) => {
    const document = structuredClone(template); document.filters[0].display='tabs';
    await page.goto('/examples/inline.html');
    await page.evaluate(async ({document,mode}) => {
      window.runtime.destroy();
      const url='/dist/metriccanvas-runtime.es.js';
      const api = mode==='classic' ? MetricCanvas as unknown as typeof import('../../src') : await import(url);
      const state = {calls:[] as unknown[],records:[] as unknown[],statuses:[] as unknown[]};
      (window as any).executionState=state;
      const request={target:{kind:'draft' as const,ref:{pageId:document.id,revisionId:'r1',resourceId:'metadata'}},operationId:'execute',explicitInputs:{regions:['FORBIDDEN']}};
      const response={status:'partial',target:request.target,operationId:'execute',executionId:'execution',conditionKey:'allowed',document,appliedInputs:{regions:['NA'],heading:'Executed instance'},filterValues:{'region-filter':{type:'dimension',dimension:'region',values:['NA']}},dataSources:{sales:{status:'success',rows:[{region:'NA',gmv:100}],totalCount:1,conditionKey:'allowed'},shared:{status:'error',error:{code:'DQE_TIMEOUT',message:'private-provider-details'},conditionKey:'allowed'},unbound:{status:'success',rows:[],totalCount:0,conditionKey:'allowed'}}};
      const recorder=api.createLastFilterRecorder({actorId:'alice',workspaceId:'workspace',targetMetadata:'metadata',clientId:'instance'},{async recordLastFilters(r:any){state.records.push(r);throw new Error('history offline');}},(s:any)=>state.statuses.push(s));
      const execution=api.prepareExecution(request,response,recorder.record);
      window.runtime=api.mount('#dashboard',{document:execution.document,execution,initialSearch:'regions=FORBIDDEN&heading=Wrong',dataGateway:{async fetchData(q:any){state.calls.push(q);const selected=q.filterValues[0]?.values ?? [];return {rows:[{region:selected.join('|')||'ALL',gmv:1}],totalCount:1};},async fetchDimensionValues(){return {kind:'values',candidates:['NA','APAC'].map(value=>({value,label:value}))};}}});
    },{document,mode});
    await expect(page.getByRole('heading',{name:'Executed instance',exact:true})).toBeVisible();
    await expect(page.getByRole('table').first().getByText('NA',{exact:true})).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('DQE_TIMEOUT');
    await expect(page.getByText('private-provider-details',{exact:false})).toHaveCount(0);
    expect(await page.evaluate(()=>(window as any).executionState.calls.length)).toBe(0);
    await page.evaluate(()=>history.replaceState(null,'','?regions=FORBIDDEN'));
    await page.getByRole('tab',{name:'APAC',exact:true}).click();
    await expect(page.getByRole('table').first().getByText('APAC',{exact:true})).toBeVisible();
    await page.getByRole('tab',{name:'全部',exact:true}).click();
    await expect(page.getByRole('table').first().getByText('ALL',{exact:true})).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>(window as any).executionState.records.length)).toBe(2);
    expect(await page.evaluate(()=>(window as any).executionState.records.map((r:any)=>[r.actorId,r.workspaceId,r.targetMetadata,r.clientSequence]))).toEqual([['alice','workspace','metadata',1],['alice','workspace','metadata',2]]);
    await expect.poll(()=>page.evaluate(()=>(window as any).executionState.statuses.at(-1)?.status)).toBe('failed');
    await expect(page.getByRole('table').first().getByText('ALL',{exact:true})).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('DQE_TIMEOUT');
    expect(await page.evaluate(()=>(window as any).executionState.calls.length)).toBe(2);
  });
}
