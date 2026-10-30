import ExcelJS from '../../../packages/engine/node_modules/exceljs/excel.js';
import {chromium, expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const base=process.env.PLAYGROUND_URL??'http://127.0.0.1:5197';
const output=process.env.COMPARISON_EVIDENCE??'/tmp/period-comparison-browser';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1000},timezoneId:'Asia/Shanghai'});
await page.clock.install({time:new Date('2026-10-29T12:00:00+08:00')});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function open(state='') {
 await page.goto(`${base}/pages/period-comparison-demo${state}`);
 await expect(page.getByRole('table')).toBeVisible();
}
async function firstCustomer(){return page.locator('tbody tr').first().locator('td').first().innerText();}
await open();
await expect(page.locator('tbody tr').filter({hasText:'甲'})).toContainText('+10.0P');
await expect(page.locator('tbody tr')).toHaveCount(5);
const sort=page.locator('th[data-column-field="previous-growth"] .sort-toggle');
await sort.click();await sort.click();
await expect.poll(firstCustomer).toBe('末行');
// Export all eight matching objects while only five are visible.
const downloadPromise=page.waitForEvent('download');
await page.getByRole('button',{name:'导出',exact:true}).click();
const download=await downloadPromise;await download.saveAs(`${output}/comparison.xlsx`);
const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(`${output}/comparison.xlsx`);
const sheet=workbook.worksheets[0];expect(sheet.rowCount).toBe(9);
expect(sheet.getCell('A2').text).toBe('末行');
expect(sheet.getCell('H2').value).toBe(60);
expect(sheet.getCell('H2').numFmt).toBe('"+60.0P"');
await page.screenshot({path:`${output}/month-sorted.png`,fullPage:true});
const header=page.locator('th[data-column-field="previous-growth"]');
await header.locator('summary').click();
await header.getByRole('textbox',{name:'数值下限'}).fill('100');
await header.getByRole('textbox',{name:'数值下限'}).press('Enter');
await expect(page.locator('tbody tr')).toHaveCount(2);
await expect(page.locator('tbody')).toContainText('末行');
await expect(page.locator('tbody')).toContainText('丙');
await page.screenshot({path:`${output}/filtered.png`,fullPage:true});
// Reload to clear table state before verifying each period mode.
await open();
for(const mode of ['年','季','近一年','月']) {
 await page.getByRole('button',{name:mode,exact:true}).click();
 await expect(page.locator('tbody tr').filter({hasText:'甲'})).toBeVisible();
 if(mode==='年'||mode==='近一年') {
  const cells=await page.locator('tbody tr').filter({hasText:'甲'}).getByRole('cell').allTextContents();
  expect(cells[4]).toBe(cells[5]);
 }
 await page.screenshot({path:`${output}/mode-${['年','季','近一年','月'].indexOf(mode)}.png`,fullPage:true});
}
await page.goto(`${base}/pages/period-comparison-demo?state=error`);
await expect(page.locator('body')).toContainText('失败');
await expect(page.getByRole('alert')).toContainText('关联数据加载或计算失败');
await expect(page.getByRole('table')).toHaveCount(0);
await page.screenshot({path:`${output}/query-error.png`,fullPage:true});
await page.goto(`${base}/pages/period-comparison-demo?state=retry`);
await expect(page.getByRole('alert')).toContainText('失败');
await page.getByRole('button',{name:'重试',exact:true}).click();
await expect(page.locator('tbody tr').filter({hasText:'甲'})).toContainText('+20.00%');
expect(errors).toEqual([]);
await browser.close();
console.log(JSON.stringify({ok:true,output,checks:['global-sort','numeric-filter','all-period-modes','complete-export','failed-comparison','retry']}));
