import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const base=process.env.RECORD_BUDGET_BASE_URL??'http://127.0.0.1:5202';
const output=process.argv[2]??'/tmp/metriccanvas-record-row-budget/browser';
const fixture=JSON.parse(await readFile(new URL('../../../pages/capabilities/table/record-join-no-row-limit.json',import.meta.url),'utf8'));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.route('**/favicon.ico',route=>route.fulfill({status:204}));
const errors=[],consoleErrors=[];
page.on('response',response=>{if(response.status()===404)console.log('404',response.url());});
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
const table=page.locator('.table-widget');
async function search(value){
  await table.getByRole('searchbox',{name:'表格搜索'}).fill(value);
  await table.getByRole('searchbox',{name:'表格搜索'}).press('Enter');
}
try{
  const started=Date.now();
  await page.goto(`${base}/pages/${fixture.id}`);
  await expect(table.locator('.total')).toContainText('100001',{timeout:90000});
  const elapsedMs=Date.now()-started;
  await search('BIZ-50000');
  await expect(table.getByRole('cell',{name:'BIZ-50000',exact:true})).toBeVisible();
  await expect(table.getByRole('cell',{name:'测试责任人0',exact:true})).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await page.screenshot({path:path.join(output,'final-record.png'),fullPage:true});
  await search('');
  await expect(table.locator('.total')).toContainText('100001');
  await table.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(table.locator('button[aria-current="page"]')).toHaveText('2');
  await table.getByRole('columnheader',{name:'商务编码',exact:true}).click();
  await expect(table.locator('.total')).toContainText('100001');
  await page.screenshot({path:path.join(output,'population.png'),fullPage:true});
  expect(errors).toEqual([]);expect(consoleErrors).toEqual([]);
  await page.goto(`${base}/pages/${fixture.id}?sourceFailure=true`);
  await expect.poll(()=>consoleErrors.some(text=>text.includes('DQE_TRANSPORT_ERROR')),{timeout:30000}).toBe(true);
  await expect(table.getByRole('cell',{name:/^BIZ-/})).toHaveCount(0);
  await expect(table.locator('.empty-state')).toBeVisible();
  expect(errors).toEqual([]);
  await writeFile(path.join(output,'result.json'),JSON.stringify({page:fixture.id,elapsedMs,errors,consoleErrors,passed:['100001 records','final record join','global search','page 2','sorting','upstream failure without partial success']},null,2));
  console.log('Record row budget browser acceptance passed');
}finally{await browser.close();}
