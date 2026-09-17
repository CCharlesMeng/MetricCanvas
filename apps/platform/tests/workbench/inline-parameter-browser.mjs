import {chromium,expect} from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:1100}});
page.setDefaultTimeout(10000);
const base=process.env.S1_BASE_URL||'https://127.0.0.1:5181';
const errors=[],writes=[],queries=[];let outcome='confirmed';
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/inline-publication-dqe',async route=>{
  const body=route.request().postDataJSON();queries.push(...body.dsl_list);
  await route.fulfill({json:{retCode:'CBC.0000',results:body.dsl_list.map(()=>({code:'SUCCESS',data:[],total_count:0}))}});
});
await page.route('**/inline-publication-save',async route=>{writes.push(route.request().postDataJSON());await route.fulfill({json:{status:outcome}});});
const prepare=async()=>{await page.goto(base+'/publication?inline');await page.getByRole('button',{name:'提取参数候选'}).click();};
const preview=async()=>{await page.getByRole('button',{name:'预览参数模板'}).click();await expect(page.getByRole('status')).toContainText('预览完成');};
const ack=()=>page.getByLabel('已核对本次参数、覆盖范围和预览，保存无值模板');
const save=()=>page.getByRole('button',{name:'确认保存模板'});
try{
  await prepare();await expect(save()).toBeDisabled();await preview();expect(queries.length).toBeGreaterThanOrEqual(5);
  await ack().check();await page.getByLabel('模板预览输入').fill('{');await expect(save()).toBeDisabled();
  await page.getByLabel('模板预览输入').fill(JSON.stringify({region:'欧洲区','report-period':{start:'2026-07',end:'2026-12',granularity:'month'}}));
  await preview();await ack().check();await page.screenshot({path:'/private/tmp/metriccanvas-inline-publication-review.png',fullPage:true});await save().click();
  await expect(page.getByRole('status')).toContainText('提供方已确认保存');expect(writes).toHaveLength(1);
  expect(writes[0].params.every(p=>!('value'in p)&&!('default'in p))).toBe(true);
  expect(Object.values(writes[0].dataSources).every(ds=>!('initial'in ds.source))).toBe(true);
  for(const q of queries)expect(JSON.stringify(q)).not.toContain('"param"');
  await prepare();await preview();await page.getByRole('button',{name:'改变参数来源'}).click();await expect(page.getByRole('status')).toContainText('来源修订或身份已改变');
  await prepare();await page.getByRole('button',{name:'取消模板评审'}).click();expect(writes).toHaveLength(1);
  outcome='unknown';await prepare();await preview();await ack().check();await save().click();await expect(page.getByRole('status')).toContainText('保存结果未确认');await expect(save()).toBeDisabled();expect(writes).toHaveLength(2);
  expect(errors).toEqual([]);console.log('PASS inline publication browser: HTTP preview, invalid JSON/stale/cancel, no-value single write, unknown never retried');
}catch(error){console.error({errors,body:await page.locator('body').innerText()});throw error;}finally{await browser.close();}
