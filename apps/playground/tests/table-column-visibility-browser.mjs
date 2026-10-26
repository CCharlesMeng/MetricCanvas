import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ExcelJS = createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');
const base = process.env.COLUMN_VISIBILITY_BASE_URL ?? 'http://127.0.0.1:5197';
const output = process.argv[2] ?? '/tmp/mc-column-visibility-browser';
await mkdir(output, { recursive: true });
const sample = JSON.parse(await readFile(new URL('../../../pages/capabilities/table/table-column-visibility.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const table = title => page.locator('.table-widget').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
async function mode(label) {
  await page.getByRole('button', { name: '列范围', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}
async function submit(target, query) {
  await target.getByRole('searchbox').fill(query);
  await target.getByRole('searchbox').press('Enter');
}
async function searchAndExport() {
  await page.goto(`${base}/pages/${sample.id}`);
  const first = table(sample.sections[0].components[0].props.title);
  const options = table(sample.sections[1].components[0].props.title);
  await expect(first.getByRole('columnheader', { name: '项目资料' })).toBeVisible();
  await submit(first, '华南');
  await submit(options, '华南项目');
  await mode('仅客户');
  await expect(page.getByRole('columnheader', { name: '项目资料' })).toHaveCount(0);
  await expect(first.getByRole('cell', { name: /华南二部/ })).toBeVisible();
  await expect(first.getByRole('cell', { name: /北方客户/ })).toHaveCount(0);
  await expect(options.getByRole('searchbox')).toHaveValue('');
  await expect(options.getByRole('button', { name: '表格搜索字段' })).toHaveText('客户');
  const pending = page.waitForEvent('download');
  await first.getByRole('button', { name: '导出', exact: true }).click();
  const download = await pending, filename = path.join(output, 'visible-columns.xlsx');
  await download.saveAs(filename);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(filename);
  const values = JSON.stringify(workbook.worksheets[0].getSheetValues());
  expect(values).toContain('负责人'); expect(values).not.toContain('项目资料'); expect(values).not.toContain('华南项目');
  await page.screenshot({ path: path.join(output, 'summary-1440.png'), fullPage: true });
  await mode('完整列');
  await expect(first.getByRole('searchbox')).toHaveValue('华南');
  await expect(first.getByRole('cell', { name: /北方客户/ })).toBeVisible();
  await mode('全部隐藏');
  await expect(page.getByText('当前条件下无可见列', { exact: true })).toHaveCount(sample.sections.length);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '导出', exact: true })).toHaveCount(0);
  await mode('完整列');
  await expect(first.getByRole('searchbox')).toHaveValue('');
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(first.getByRole('columnheader', { name: '项目资料' })).toBeVisible();
  await page.screenshot({ path: path.join(output, 'full-390.png'), fullPage: true });
}
async function scopes() {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${base}/pages/table-column-visibility-scopes`);
  const parent = table('展开与详情入口');
  await expect(parent).toBeVisible();
  await parent.getByRole('button', { name: /展开/ }).first().click();
  await expect(page.getByRole('heading', { name: '订单子表' })).toBeVisible();
  await mode('全部隐藏');
  await expect(page.getByRole('heading', { name: '订单子表' })).toHaveCount(0);
  await mode('仅客户');
  await expect(parent.getByRole('button', { name: /展开/ }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '订单子表' })).toHaveCount(0);
  await parent.getByRole('button', { name: /展开/ }).first().click();
  const child = table('订单子表');
  await expect(child.getByRole('columnheader', { name: '产品', exact: true })).toBeVisible();
  await expect(child.getByRole('columnheader', { name: '子表金额' })).toHaveCount(0);
  await parent.getByRole('button', { name: /华南客户/ }).click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByRole('heading', { name: '详情表的可见列' })).toBeVisible();
  await expect(detail.getByRole('columnheader', { name: '项目资料' })).toHaveCount(0);
  await page.screenshot({ path: path.join(output, 'detail-scoped.png'), fullPage: true });
}
try {
  await searchAndExport();
  await scopes();
  expect(errors).toEqual([]);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ page: sample.id, browser: 'Chrome', errors, passed: ['four variants', 'search scope shrink/expand', 'option fallback', 'XLSX projected compound fields', 'zero columns', '390px', 'expanded instances released', 'scoped child', 'snapshot detail', 'Tab'] }, null, 2));
  console.log(`Browser acceptance passed: ${output}`);
} finally { await browser.close(); }
