import {expect,test,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

const document = JSON.parse(readFileSync(new URL('../../../../pages/capabilities/navigation/embed-url-params.json',import.meta.url),'utf8'));

async function open(page:Page,mode:string,url:string,initialSearch?:string){
  await page.goto(`/examples/inline.html${url}`);
  await page.evaluate(async ({document,mode,initialSearch})=>{
    window.runtime.destroy();
    const moduleURL='/dist/metriccanvas-runtime.es.js';
    const api=mode==='esm'?await import(moduleURL):await MetricCanvas.ready;
    window.pageDocument=document;
    window.runtime=api.mount('#dashboard',{document,...(initialSearch===undefined?{}:{initialSearch})});
  },{document,mode,initialSearch});
}

for(const mode of ['esm','classic']){
  test(`${mode}: omitted initialSearch reads the browser query`,async({page})=>{
    await open(page,mode,'?account-name='+encodeURIComponent('合成+账号&=%20'));
    await expect(page.getByText('合成+账号&=%20',{exact:true})).toBeVisible();
  });
  test(`${mode}: hash route wins over the same outer query key`,async({page})=>{
    await open(page,mode,'?account-name=outer&tenant=x#/detail?account-name=hash');
    await expect(page.getByText('hash',{exact:true})).toBeVisible();
  });
  test(`${mode}: explicit search overrides browser and hash inputs`,async({page})=>{
    await open(page,mode,'?account-name=outer#/detail?account-name=hash','?account-name=explicit');
    await expect(page.getByText('explicit',{exact:true})).toBeVisible();
  });
  test(`${mode}: explicit empty search disables URL inheritance`,async({page})=>{
    await open(page,mode,'?account-name=outer','');
    await expect(page.getByText('华为云账号',{exact:false}).first()).toBeVisible();
    await expect(page.getByText('outer',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'URL 账号参数',exact:true})).toHaveCount(0);
  });
  test(`${mode}: URL changes wait for update; omitted update input rereads URL`,async({page})=>{
    await open(page,mode,'?account-name=first');
    await expect(page.getByText('first',{exact:true})).toBeVisible();
    await page.evaluate(()=>history.replaceState(null,'','?account-name=second'));
    await expect(page.getByText('first',{exact:true})).toBeVisible();
    await page.evaluate(()=>window.runtime.update({document:window.pageDocument}));
    await expect(page.getByText('second',{exact:true})).toBeVisible();
  });
  test(`${mode}: repeated single account values remain invalid`,async({page})=>{
    await open(page,mode,'#/detail?account-name=one&account-name=two');
    await expect(page.getByText('华为云账号',{exact:false}).first()).toBeVisible();
    await expect(page.getByRole('heading',{name:'URL 账号参数',exact:true})).toHaveCount(0);
  });
}

test('automatic input reaches native DQE conditions and missing input blocks requests',async({page})=>{
  const raw=JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/dimension-params-page.json',import.meta.url),'utf8'));
  delete raw.params[0].default;
  // Isolate the immutable parameter consumer from independent candidate-gated filters.
  raw.dataSources={shared:raw.dataSources.shared};raw.filters=[];
  raw.sections[0].components=raw.sections[0].components.filter((component:{id:string})=>['heading','shared-table'].includes(component.id));
  delete raw.sections[0].components[1].props.actions;
  const requests:Array<{output_metrics:string[];filter:{dims:unknown[]}}>=[];
  await page.route('**/url-params-dqe',async route=>{
    const items=route.request().postDataJSON().dsl_list;
    requests.push(...items);
    await route.fulfill({json:{retCode:'CBC.0000',results:items.map(()=>({code:'SUCCESS',data:[{region:'EU',gmv:1}],total_count:1}))}});
  });
  await page.goto('/examples/inline.html?regions=EU&regions=NA&heading=FromURL');
  await page.evaluate(raw=>{
    window.runtime.destroy();
    window.runtime=MetricCanvas.mount('#dashboard',{document:raw,dataGateway:MetricCanvas.createDqeGateway({endpoint:'/url-params-dqe'})});
  },raw);
  await expect.poll(()=>requests.filter(q=>q.output_metrics.length>0).length).toBe(1);
  const bound=requests.filter(q=>q.output_metrics.length>0&&q.filter.dims.length>0);
  expect(bound).toHaveLength(1);
  for(const query of bound)expect(query.filter.dims).toContainEqual({dim_name:'region',dim_value_list:['EU','NA']});
  requests.length=0;
  await page.evaluate(raw=>{
    history.replaceState(null,'','/examples/inline.html');
    window.runtime.update({document:raw,dataGateway:MetricCanvas.createDqeGateway({endpoint:'/url-params-dqe'})});
  },raw);
  await expect(page.getByText('regions',{exact:false}).first()).toBeVisible();
  expect(requests).toHaveLength(0);
});
