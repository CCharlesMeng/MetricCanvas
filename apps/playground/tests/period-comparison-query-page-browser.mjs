import ExcelJS from '../../../packages/engine/node_modules/exceljs/excel.js';
import {chromium,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const base=process.env.PLAYGROUND_URL??'http://127.0.0.1:5197';
const output=process.env.COMPARISON_EVIDENCE??'/tmp/period-comparison-query-page-browser';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:950},timezoneId:'Asia/Shanghai'});
await page.clock.install({time:new Date('2026-10-30T12:00:00+08:00')});
await page.addInitScript(()=>{
  window.__comparisonCalls=[];
  window.addEventListener('metriccanvas:synthetic-comparison-page',event=>window.__comparisonCalls.push(event.detail));
});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const calls=()=>page.evaluate(()=>window.__comparisonCalls);
const first=()=>page.locator('tbody tr').first().locator('td').first().innerText();
async function open(state=''){
  await page.goto(`${base}/pages/period-comparison-query-page${state}`);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(10);
}
await open();
await expect.poll(first).toBe('C000023');
await expect(page.locator('tbody tr').first()).toContainText('+75.00%');
await expect(page.locator('tbody tr').first()).toContainText('+10.0P');
expect((await calls()).map(call=>call.query.pagination)).toEqual([{offset:0,limit:10},{offset:0,limit:10},{offset:0,limit:10}]);
expect(await page.locator('th[data-column-field="previous-growth"] .sort-toggle').count()).toBe(0);
await page.screenshot({path:`${output}/first-page.png`,fullPage:true});
await page.getByRole('button',{name:'下一页',exact:true}).click();
await expect.poll(first).toBe('C000013');
const second=(await calls()).slice(3);
expect(second[0].query.pagination).toEqual({offset:10,limit:10});
for(const call of second.slice(1)){
  expect(call.query.pagination).toEqual({offset:0,limit:10});
  const keys=call.query.filterValues.find(value=>value.target==='dimension'&&value.queryField==='customer').values;
  expect(keys).toHaveLength(10);expect(keys[0]).toBe('C000013');expect(keys[9]).toBe('C000004');
}
await page.screenshot({path:`${output}/second-page.png`,fullPage:true});
await page.getByRole('button',{name:'下一页',exact:true}).click();
await expect(page.locator('tbody tr')).toHaveCount(3);await expect.poll(first).toBe('C000003');
const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出',exact:true}).click();
const download=await downloadPromise;await download.saveAs(`${output}/comparison.xlsx`);
const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(`${output}/comparison.xlsx`);
const sheet=workbook.worksheets[0];expect(sheet.rowCount).toBe(24);expect(sheet.getCell('A2').text).toBe('C000023');
expect(sheet.getCell('E2').value).toBe(75);expect(sheet.getCell('G2').value).toBe(10);expect(sheet.getCell('G2').numFmt).toBe('"+10.0P"');
await open();
const header=page.locator('th[data-column-field="current-sales"]');await header.locator('summary').click();
await header.getByRole('textbox',{name:'数值下限'}).fill('300');await header.getByRole('textbox',{name:'数值下限'}).press('Enter');
await expect.poll(async()=>{const records=await calls();return records.filter(call=>call.sourceIds?.includes('current')).at(-1)?.query.tableFilters;}).toContainEqual({target:'metricRange',metric:'sales',from:300});
expect((await calls()).filter(call=>!call.sourceIds?.includes('current')).every(call=>!call.query.tableFilters?.length)).toBe(true);
await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(4);
await open();
for(const mode of ['年','季','近一年','月']){
  await page.getByRole('button',{name:mode,exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(10);
  if(mode==='年'||mode==='近一年')await expect.poll(async()=>{
    const cells=await page.locator('tbody tr').first().getByRole('cell').allTextContents();return cells[4]===cells[5];
  }).toBe(true);
}
await open('?state=large');await expect.poll(first).toBe('C100000');expect((await calls()).length).toBe(3);
await page.screenshot({path:`${output}/large-domain.png`,fullPage:true});
await page.goto(`${base}/pages/period-comparison-query-page?state=error`);
await expect(page.getByRole('alert')).toContainText('比较期数据加载或计算失败');expect(await page.getByRole('table').count()).toBe(0);
await page.screenshot({path:`${output}/error.png`,fullPage:true});
await page.goto(`${base}/pages/period-comparison-query-page?state=retry`);await expect(page.getByRole('alert')).toBeVisible();
await page.getByRole('button',{name:'重试',exact:true}).click();await expect.poll(first).toBe('C000023');
expect(errors).toEqual([]);await browser.close();
console.log(JSON.stringify({ok:true,output,checks:['bounded-page','page-key-supplements','all-periods','metric-filter-scope','complete-export','large-domain','failure-retry']}));
