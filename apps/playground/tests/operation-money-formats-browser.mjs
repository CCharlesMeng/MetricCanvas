import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(new URL('../../../packages/engine/package.json', import.meta.url));
const ExcelJS = require('exceljs');
const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5267';
const output = process.argv[2] ?? '/tmp/mc-money-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true, channel: 'chrome'});
const page = await browser.newPage({viewport: {width: 1440, height: 1050}, acceptDownloads: true});
const errors = [], requests = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('request', request => { if (request.url().includes('/dsl/execute')) requests.push(request.url()); });
await page.route('**/favicon.ico', route => route.fulfill({status: 204}));
const component = id => page.locator(`[data-component="body/${id}"]`);

async function chartTooltip(expected) {
  const canvas = component('selected-chart').locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  await canvas.hover({position: {x: box.width / 2, y: box.height / 2}});
  await expect(component('selected-chart')).toContainText(expected);
  await page.mouse.move(0, 0);
}

async function checkExport(currency) {
  const downloaded = page.waitForEvent('download');
  await component('selected-table').getByRole('button', {name: '导出', exact: true}).click();
  const filename = path.join(output, `${currency}.xlsx`);
  await (await downloaded).saveAs(filename);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(filename);
  const sheet = book.worksheets[0];
  expect(sheet.getCell('B1').value).toBe(`金额（${currency}）`);
  expect(sheet.getCell('B2').value).toBe(250000000);
}

try {
  await page.goto(`${base}/pages/operation-money-formats`);
  await expect(component('selected-card')).toContainText('2.5亿');
  await expect(component('selected-table').locator('tbody')).toContainText('2.5亿');
  const cases = component('format-table').locator('tbody tr');
  await expect(cases).toHaveCount(19);
  await expect(cases.filter({has: page.getByRole('cell', {name: '999', exact: true})}).first()).toContainText('999元');
  const inputRow = input => cases.filter({has: page.getByRole('cell', {name: input, exact: true})});
  await expect(inputRow('12345').locator('td')).toHaveText(['12345', '1.2万', '1.2万', '12.3K', '1.23万', '12,345.00美元']);
  await expect(inputRow('99999999').locator('td')).toHaveText(['99999999', '10,000万', '10,000万', '100,000K', '10,000万', '99,999,999.00美元']);
  await expect(inputRow('-0.4').locator('td')).toHaveText(['-0.4', '0', '0元', '0$', '-0元', '-0.40美元']);
  await expect(inputRow('-105000').locator('td').nth(1)).toHaveText('-11万');
  await expect(inputRow('-1005500').locator('td').nth(3)).toHaveText('-1,006K');
  await expect(inputRow('缺失').locator('td').nth(1)).toHaveText('—');
  checks.push('CNY A/B, USD thresholds, symmetric negative halves, rounded zero, missing and legacy formats');
  await chartTooltip('2.5亿');
  await checkExport('元');
  await page.screenshot({path: path.join(output, 'cny-1440.png'), fullPage: true});
  await page.getByRole('button', {name: '币种', exact: true}).click();
  await page.getByRole('option', {name: '美元', exact: true}).click();
  await expect(component('selected-card')).toContainText('250M');
  await expect(component('selected-card')).not.toContainText('250M美元');
  await expect(component('selected-table').locator('tbody')).toContainText('250M');
  await chartTooltip('250M');
  await checkExport('美元');
  await page.screenshot({path: path.join(output, 'usd-1440.png'), fullPage: true});
  checks.push('CNY/USD card, table and chart tooltip switch; XLSX keeps original base-unit numeric amounts');
  await page.getByRole('button', {name: '币种', exact: true}).click();
  await page.getByRole('option', {name: '人民币', exact: true}).click();
  await expect(component('selected-card')).toContainText('2.5亿');
  await page.setViewportSize({width: 390, height: 844});
  await expect(component('selected-card')).toBeVisible();
  await expect(page.getByRole('button', {name: '币种', exact: true})).toBeVisible();
  await page.screenshot({path: path.join(output, 'cny-390.png'), fullPage: true});
  checks.push('switch back and 390px viewport');
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({url: `${base}/pages/operation-money-formats`, checks, errors, requests}, null, 2));
  console.log(JSON.stringify({passed: checks, output}));
} finally { await browser.close(); }
