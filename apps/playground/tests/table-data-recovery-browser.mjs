import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import ExcelJS from '../../../packages/engine/node_modules/exceljs/excel.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5198';
const output = process.argv[2] ?? path.resolve('docs/evidence/table-data-recovery/browser');
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,channel:'chrome'});
const page = await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
const errors = [];
page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(`${base}/pages/table-data-recovery`);
  const union = page.locator('.table-widget[data-table-title="多来源合并"]');
  const records = page.locator('.table-widget[data-table-title="记录关联"]');
  await expect(union.locator('.total')).toContainText('6',{timeout:45000});
  await expect(records.locator('.total')).toContainText('8');
  await expect(page.getByText('部分数据异常，当前展示可用结果',{exact:true})).toHaveCount(2);
  await expect(union.locator('tbody tr')).toHaveCount(3);
  await union.getByText('部分数据异常，当前展示可用结果',{exact:true}).click();
  await expect(union.getByText('commercial：重复行标识仅保留第一条（1）',{exact:true})).toBeVisible();
  await union.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(union.locator('button[aria-current="page"]')).toHaveText('2');
  await expect(union.locator('tbody tr')).toHaveCount(3);
  await page.screenshot({path:path.join(output,'mixed.png'),fullPage:true});
  for (const [table,name,count] of [[union,'union',6],[records,'records',8]]) {
    const pending = page.waitForEvent('download');
    await table.getByRole('button',{name:'导出',exact:true}).click();
    const download = await pending, filename = path.join(output,`${name}.xlsx`);
    await download.saveAs(filename);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await readFile(filename));
    expect(workbook.worksheets.map(sheet=>sheet.name)).toEqual(['表格数据','数据异常说明']);
    expect(workbook.worksheets[0].rowCount).toBe(count+1);
    expect(workbook.worksheets[1].getCell('A1').text).toContain('缺项');
  }
  await page.goto(`${base}/pages/table-data-recovery?recoveryState=ready`);
  await expect(union.locator('.total')).toContainText('8');
  await expect(records.locator('.total')).toContainText('8');
  await expect(page.getByText('部分数据异常，当前展示可用结果',{exact:true})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await expect(union.getByRole('table')).toBeVisible();
  await page.screenshot({path:path.join(output,'ready-narrow.png'),fullPage:true});
  expect(errors).toEqual([]);
  await writeFile(path.join(output,'result.json'),JSON.stringify({synthetic:true,errors,passed:['union recovery and paging','record join recovery','source warnings','both complete Excel downloads include warnings','healthy refresh clears warnings','narrow screen']},null,2));
} finally {await browser.close();}
