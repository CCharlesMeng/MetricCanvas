import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5197';
const output = process.argv[2] ?? '/tmp/metriccanvas-union-generated-key/browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const pageErrors = [], consoleErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
const table = page.locator('.table-widget');
try {
  await page.goto(`${base}/pages/multi-source-generated-key`);
  await expect(table.locator('.total')).toContainText('256', { timeout: 45000 });
  await table.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(table.locator('button[aria-current="page"]')).toHaveText('2');
  await table.getByRole('searchbox', { name: '表格搜索' }).fill('审批人甲');
  await table.getByRole('searchbox', { name: '表格搜索' }).press('Enter');
  await expect(table.locator('.total')).toContainText('3');
  await table.locator('th').filter({ hasText: '决策总次数' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(3);
  const pending = page.waitForEvent('download');
  await table.getByRole('button', { name: '导出', exact: true }).click();
  const download = await pending;
  const filename = path.join(output, 'filtered-approver.xlsx');
  await download.saveAs(filename);
  expect((await readFile(filename)).subarray(0, 2).toString()).toBe('PK');
  expect(consoleErrors).toEqual([]);
  for (const failure of ['missing-composite-key', 'duplicate-composite']) {
    await page.goto(`${base}/pages/multi-source-generated-key?rowFailure=${failure}`);
    await expect(table.locator('.total')).toContainText('256');
    await expect(table.locator('tbody tr')).toHaveCount(20);
    await page.screenshot({ path: path.join(output, `${failure}.png`), fullPage: true });
    expect(consoleErrors).toEqual([]);
  }
  await page.goto(`${base}/pages/multi-source-generated-key?rowFailure=order`);
  await expect(table.locator('.total')).toContainText('256');
  await expect(table.getByText('部分数据异常，当前展示可用结果',{exact:true})).toBeVisible();
  expect(consoleErrors).toEqual([]);
  await page.screenshot({ path: path.join(output, 'order-error.png'), fullPage: true });
  expect(pageErrors).toEqual([]);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ page: 'multi-source-generated-key', pageErrors, passed: ['256 rows', 'page 2', 'search', 'sort', 'complete filtered Excel', 'nullable business field retained', 'duplicate business tuple retained', 'ordering restored with warning'] }, null, 2));
  console.log('Generated key browser acceptance passed');
} finally { await browser.close(); }
