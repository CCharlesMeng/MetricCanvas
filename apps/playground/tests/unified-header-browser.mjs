import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {executeFixtureItem} from '../../../packages/embed/tests/dqe-fixture-endpoint.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const base=process.env.HEADER_BASE_URL??'http://127.0.0.1:5196';
const output=process.argv[2]??'/tmp/metriccanvas-unified-header';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai'});
const requests=[],errors=[],checks=[];let failCandidate=true,candidateAttempts=0;
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{window.__METRICCANVAS__={dqeEndpoint:'/rest/cdi/cdinl2databuilderservice/v1/dsl/execute',pageMetadataBaseUrl:'/pages',authToken:'synthetic',operatorId:'synthetic',workspaceId:'synthetic'};});
await page.clock.install({time:new Date('2026-10-20T12:00:00+08:00')});
await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute',async route=>{
 const items=route.request().postDataJSON().dsl_list;
 if(items.some(query=>!query.output_metrics.length&&query.output_dims[0]==='sub-industry-level1')){
  candidateAttempts++;
  if(failCandidate){failCandidate=false;await route.fulfill({status:503,body:'synthetic candidate failure'});return;}
 }
 requests.push(...items);
 await route.fulfill({json:{retCode:'CBC.0000',results:items.map(executeFixtureItem)}});
});
const header=page.locator('header[data-ioc-header]');
try{
 await page.goto(`${base}/pages/ioc-opportunity-list`);
 await expect(header).toHaveCount(1);await expect(header.getByRole('heading',{name:'机会点清单'})).toBeVisible();
 await expect(header.locator('[data-dashboard-primary-filters] [data-filter-control]')).toHaveCount(4);
 const more=header.locator('[data-dashboard-filter-overflow]');await expect(more.locator('[data-dashboard-filter-count]')).toHaveText('6');await more.locator('summary').first().click();
 const industry=header.locator('[data-filter-id="industry-l1"]');await industry.locator('summary').click();await expect(industry.getByRole('button',{name:'重试'})).toBeVisible();await industry.getByRole('button',{name:'重试'}).click();
 await expect.poll(()=>candidateAttempts).toBeGreaterThan(1);await expect(industry.getByRole('button',{name:'重试'})).toHaveCount(0);await industry.locator('summary').click();
 for(const width of [1440,1024,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:path.join(output,`list-${width}.png`),fullPage:false});}
 checks.push('single canonical header; 4 primary + 6 overflow; failed candidate retries; 1440/1024/390 layout');
 await page.goto(`${base}/pages/ioc-opportunity-analysis`);await expect(header).toHaveClass(/compact/);await expect(header.locator('[data-filter-control]')).toHaveCount(7);await expect(header).toContainText('七个筛选位均已下推');
 for(const width of [1440,1024,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:path.join(output,`compact-${width}.png`),fullPage:false});}checks.push('same header renders compact 7-filter page and note at wide and narrow widths');
 requests.length=0;await page.goto(`${base}/pages/dashboard-period-filter`);
 const input=header.getByRole('combobox');await expect(header).toHaveCount(1);await expect(input).toHaveValue('2026 年');await expect(header.getByRole('group',{name:'时间粒度'})).toHaveCount(0);
 await expect.poll(()=>requests.length).toBe(2);await input.click();await expect(page.getByRole('button',{name:'2027',exact:true})).toBeDisabled();await page.getByRole('button',{name:'2024',exact:true}).click();
 await expect(input).toHaveValue('2024 年');await expect.poll(()=>requests.length).toBe(3);expect(requests.at(-1).filter.time).toMatchObject({start:'2024-01-01',end:'2024-12-31'});
 expect(requests.filter(query=>query.output_metrics[0]==='unbound_amount')).toHaveLength(1);
 await expect(page.getByText('2024-01-01~2024-12-31',{exact:true})).toBeVisible();
 await page.screenshot({path:path.join(output,'year-1440.png'),fullPage:false});
 await input.fill('2025');await input.press('Enter');await expect(input).toHaveValue('2025 年');
 await page.goto(`${base}/pages/dashboard-period-filter?period-filter=year%3A2023`);await expect(input).toHaveValue('2023 年');
 for(const raw of ['month:2025-01','quarter:2025-Q1','last12Months','year:2027','year:bad']){await page.goto(`${base}/pages/dashboard-period-filter?period-filter=${encodeURIComponent(raw)}`);await expect(input).toHaveValue('2026 年');}
 await page.setViewportSize({width:390,height:850});await input.click();await expect(page.getByRole('button',{name:'2026',exact:true})).toBeEnabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:path.join(output,'year-390.png'),fullPage:false});
 checks.push('single year input in unified header; full natural-year query; unbound query unchanged; typed year and URL restoration; disallowed/future URLs preserve default; narrow picker');
 expect(errors).toEqual([]);await writeFile(path.join(output,'results.json'),JSON.stringify({status:'pass',base,checks,errors,data:'synthetic DQE responses and IOC fixture data'},null,2)+'\n');console.log(JSON.stringify({status:'pass',checks,output}));
}finally{await browser.close();}
