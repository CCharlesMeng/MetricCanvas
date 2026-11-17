import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const base=process.env.RECORD_TIMEOUT_BASE_URL??'http://127.0.0.1:5203';
const output=process.argv[2]??'/tmp/metriccanvas-record-batch-timeout/browser';
const fixture=JSON.parse(await readFile(new URL('../../../pages/capabilities/table/record-join-batch-timeout.json',import.meta.url),'utf8'));
const declaredTimeoutMs=fixture.dataSources['rejection-overview'].source.records.timeoutMs;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.clock.install();
await page.addInitScript(() => {
  AbortSignal.timeout = milliseconds => {
    window.__recordTimeoutDeadline = Math.min(window.__recordTimeoutDeadline ?? Infinity, performance.now() + milliseconds);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), milliseconds);
    return controller.signal;
  };
});
await page.route('**/favicon.ico',route=>route.fulfill({status:204}));
const errors=[],consoleErrors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
const table=page.locator('.table-widget');
async function openScenario(query = '') {
  await page.clock.resume();
  await page.goto(`${base}/pages/${fixture.id}${query}`);
  await expect(table).toHaveAttribute('aria-busy','true',{timeout:15000});
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));
}
try{
  await openScenario();
  const started=await page.evaluate(() => Date.now());
  for(let batch=0;batch<9;batch++)await page.clock.runFor(60_000);
  await expect(table.locator('.total')).toContainText('12');
  const elapsedMs=(await page.evaluate(() => Date.now()))-started;
  expect(elapsedMs).toBeGreaterThan(180_000);
  const search=table.getByRole('searchbox',{name:'表格搜索'});
  await search.fill('BIZ-00005');await search.press('Enter');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.getByRole('cell',{name:'测试责任人1',exact:true})).toHaveCount(2);
  await page.screenshot({path:path.join(output,'complete.png'),fullPage:true});
  expect(consoleErrors).toEqual([]);
  await openScenario('?sourceTimeout=true');
  const remaining = await page.evaluate(() => window.__recordTimeoutDeadline - performance.now());
  expect(remaining).toBeGreaterThan(170_000);
  await page.clock.runFor(remaining - 1);
  expect(consoleErrors).toEqual([]);
  await expect(table).toHaveAttribute('aria-busy','true');
  await page.clock.runFor(1);
  await expect.poll(()=>consoleErrors.some(text=>text.includes('DQE_TIMEOUT'))).toBe(true);
  await expect(table.getByRole('cell',{name:/^BIZ-/})).toHaveCount(0);
  await expect(table.locator('.empty-state')).toBeVisible();
  await page.screenshot({path:path.join(output,'timeout.png'),fullPage:true});
  await openScenario();
  for(let batch=0;batch<9;batch++)await page.clock.runFor(60_000);
  await expect(table.locator('.total')).toContainText('12');
  expect(errors).toEqual([]);
  await writeFile(path.join(output,'result.json'),JSON.stringify({page:fixture.id,declaredTimeoutMs,effectiveTimeoutMs:180_000,elapsedMs,errors,consoleErrors,passed:['cumulative wait exceeds per-batch timeout','complete supplement join','global search','single batch timeout without partial rows','recovery']},null,2));
  console.log('Record batch timeout browser acceptance passed');
}finally{await browser.close();}
