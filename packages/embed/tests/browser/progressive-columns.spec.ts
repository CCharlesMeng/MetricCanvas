import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const document=JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/paged-join-progressive.json',import.meta.url),'utf8'));
type Item={output_dims:string[];output_metrics:string[];filter:{dims:{dim_name:string;dim_value_list:string[]}[]};order:{offset?:number;limit?:number;order_by_field?:string;type?:string}};
function receipt(item:Item){
  let rows:Record<string,string|number>[]=Array.from({length:80},(_,index)=>({'项目编号':`P${String(index+1).padStart(6,'0')}`,'项目名称':`测试项目${index+1}`,'审批次数':80-index,'项目状态':index%2?'已关闭':'进行中','合同金额':(index+1)*1000}));
  for(const filter of item.filter.dims)rows=rows.filter(row=>filter.dim_value_list.includes(String(row[filter.dim_name])));
  const field=item.order.order_by_field;
  if(field)rows.sort((a,b)=>(Number(a[field])-Number(b[field]))*(item.order.type?.toLowerCase()==='desc'?-1:1));
  const offset=item.order.offset??0,limit=item.order.limit??rows.length;
  return {code:'SUCCESS',total_count:rows.length,data:rows.slice(offset,offset+limit)};
}

for(const entry of ['global','es'] as const)test(`${entry}: partial columns stay separate from completion and retain valid cells after a failed batch`,async({page})=>{
  const pending:{success():Promise<void>;fail():Promise<void>}[]=[];
  await page.route('**/progressive-fixture-dqe',async route=>{
    const items:Item[]=route.request().postDataJSON().dsl_list;expect(items).toHaveLength(1);
    if(items[0].output_metrics.includes('合同金额')){
      await new Promise<void>(resolve=>pending.push({
        async success(){await route.fulfill({json:{retCode:'CBC.0000',results:items.map(receipt)}});resolve();},
        async fail(){await route.fulfill({status:403,body:'synthetic member failure'});resolve();}
      }));
    }else await route.fulfill({json:{retCode:'CBC.0000',results:items.map(receipt)}});
  });
  await page.goto('/examples/inline.html');await page.waitForFunction(()=>Boolean(window.runtime));
  await page.evaluate(async({document,entry})=>{
    window.runtime.destroy();
    const modulePath = '/dist/metriccanvas-runtime.es.js';
    const api=entry==='global'?MetricCanvas:await import(modulePath);
    window.runtime=api.mount('#dashboard',{document,dataGateway:api.createDqeGateway({endpoint:'/progressive-fixture-dqe'})});
  },{document,entry});
  const table=page.locator('.table-widget');
  await expect(table.getByRole('cell',{name:'测试项目1',exact:true})).toBeVisible();
  await expect(table).toHaveAttribute('aria-busy','true');
  await expect(table.getByRole('button',{name:'导出',exact:true})).toBeDisabled();
  await expect.poll(()=>pending.length).toBe(1);await pending.shift()!.success();
  await expect(table.getByRole('cell',{name:'进行中',exact:true}).first()).toBeVisible();
  await expect(table).toHaveAttribute('aria-busy','true');
  await expect.poll(()=>pending.length).toBe(1);await pending.shift()!.fail();
  await expect(table).toHaveAttribute('aria-busy','false');
  await expect(table.getByRole('cell',{name:'测试项目1',exact:true})).toBeVisible();
  // A failed member is cleared as a unit, including its earlier successful batch.
  await expect(table.getByRole('cell',{name:'进行中',exact:true})).toHaveCount(0);
  await expect(table.getByRole('button',{name:'导出',exact:true})).toBeDisabled();
});
