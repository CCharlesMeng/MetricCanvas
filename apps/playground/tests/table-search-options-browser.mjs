import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ExcelJS = createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');
const base = process.env.TABLE_SEARCH_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-table-search-options';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.url().includes('/dsl/execute') && request.method() === 'POST') requests.push(request.postDataJSON());
});
const sample = JSON.parse(await readFile(new URL('../../../pages/table-search-options-demo.json', import.meta.url), 'utf8'));
const table = id => page.locator(`[data-component="main/${id}"]`);
async function select(target, label) {
  await target.getByRole('button', { name: '表格搜索字段', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}
async function submit(target, query) {
  await target.getByRole('searchbox').fill(query);
  await target.getByRole('searchbox').press('Enter');
}
try {
  await page.goto(`${base}/pages/table-search-options-demo`);
  const local = table('local-table'), remote = table('query-table'), legacy = table('legacy-table');
  await expect(remote.getByRole('cell', { name: '00123', exact: true })).toBeVisible();
  await expect(local.getByRole('button', { name: '表格搜索字段' })).toHaveText('项目名称');
  await expect(local.getByRole('searchbox')).toHaveAttribute('placeholder', '请输入完整项目名称');
  await submit(local, '星河项目');
  await expect(local.locator('tbody tr')).toHaveCount(2);
  await expect(local.getByRole('cell', { name: '星河项目二期', exact: true })).toHaveCount(0);
  await select(local, '责任人');
  await expect(local.getByRole('searchbox')).toHaveValue('星河项目');
  await expect(local.getByRole('searchbox')).toHaveAttribute('placeholder', '请输入完整责任人姓名');
  await expect(local.getByRole('cell', { name: '其他项目', exact: true })).toBeVisible();
  await local.getByRole('searchbox').fill('00123');
  await select(local, '项目编码');
  await expect(local.getByRole('cell', { name: '00123', exact: true })).toBeVisible();
  await expect(remote.getByRole('button', { name: '表格搜索字段' })).toHaveText('项目名称');
  await expect(legacy.getByRole('button', { name: '表格搜索字段' })).toHaveCount(0);
  await submit(legacy, '星河');
  await expect(legacy.locator('tbody tr')).toHaveCount(2);
  await expect(legacy.getByRole('cell', { name: '星河项目二期', exact: true })).toBeVisible();

  await select(remote, '项目编码');
  await submit(remote, '00123');
  await expect(remote.locator('tbody tr')).toHaveCount(1);
  await expect(remote.getByRole('cell', { name: '00123', exact: true })).toBeVisible();
  const item = requests.at(-1).dsl_list[0];
  expect(item.filter.dims).toContainEqual({ dim_name: 'search_demo_code', dim_value_list: ['00123'] });
  expect(item.filter.dims).toContainEqual({ dim_name: 'search_demo_owner', dim_value_list: ['张三', '李四', '星河项目'] });
  expect(item.order.offset).toBe(0);
  await remote.getByRole('searchbox').fill('unsubmitted');
  const downloadEvent = page.waitForEvent('download');
  await remote.getByRole('button', { name: '导出', exact: true }).click();
  const download = await downloadEvent;
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(await download.path());
  expect(workbook.worksheets[0].rowCount).toBe(2);
  expect(workbook.worksheets[0].getCell('A2').value).toBe('00123');
  await download.saveAs(path.join(output, 'submitted-search.xlsx'));
  await submit(remote, '123');
  await expect(remote.getByRole('cell', { name: '暂无数据', exact: true })).toBeVisible();
  await submit(remote, 'A%_');
  await expect(remote.getByRole('cell', { name: 'A%_', exact: true })).toBeVisible();
  const beforeClear = requests.length;
  await remote.getByRole('button', { name: '清空表格搜索' }).click();
  await expect(remote.getByRole('button', { name: '表格搜索字段' })).toHaveText('项目编码');
  await expect(remote.locator('tbody tr')).toHaveCount(2);
  await expect(remote.getByRole('cell', { name: '00124', exact: true })).toBeVisible();
  // Restoring the initial scope may reuse its validated cache instead of issuing HTTP.
  if (requests.length > beforeClear) expect(requests.at(-1).dsl_list[0].filter.dims).toHaveLength(1);
  await remote.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(remote.getByRole('cell', { name: '00003', exact: true })).toBeVisible();
  await remote.getByRole('searchbox').fill('星河项目');
  await select(remote, '项目名称');
  await expect(remote.locator('tbody tr')).toHaveCount(2);
  expect(requests.at(-1).dsl_list[0].order.offset).toBe(0);
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(local.getByRole('button', { name: '表格搜索字段' })).toBeVisible();
    await expect(local.getByRole('searchbox')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await select(local, '项目名称');
    const bounds = await local.locator('[data-table-toolbar]').evaluate(toolbar => {
      const outer = toolbar.getBoundingClientRect();
      return [...toolbar.querySelectorAll('.search, .search-option')].map(node => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, left: rect.left - outer.left, right: outer.right - rect.right };
      });
    });
    for (const boundsOfControl of bounds) {
      expect(boundsOfControl.width).toBeGreaterThanOrEqual(120);
      expect(boundsOfControl.left).toBeGreaterThanOrEqual(-1);
      expect(boundsOfControl.right).toBeGreaterThanOrEqual(-1);
    }
    await expect(local.getByRole('button', { name: '搜索', exact: true })).toBeInViewport();
    await page.screenshot({ path: path.join(output, `narrow-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  sample.sections[0].components[0].props.toolbar.search.defaultValue = 'missing';
  await page.evaluate(async input => {
    const { mountTableSearchFixture } = await import('/tests/table-search-options-fixture.ts');
    const target = document.createElement('div'); target.id = 'invalid-search-options'; document.body.append(target);
    window.disposeSearchFixture = mountTableSearchFixture(target, input);
  }, sample);
  await expect(page.locator('#invalid-search-options')).toContainText('默认搜索选项必须存在');
  expect(errors).toEqual([]);
  const result = { status: 'pass', page: '/pages/table-search-options-demo', requests: requests.length,
    evidence: 'local browser and HTTP DQE Sim; production DQE collation and conjunction not verified',
    checks: ['default option', 'placeholder', 'exact match', 'legacy contains', 'immediate switch', 'independent tables',
      'leading zeros', 'literal percent and underscore', 'submitted export', 'clear retains option', 'pagination reset',
      'same query preserves base filter', '390 and 320 layouts', 'invalid default diagnostic'] };
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), pageErrors: errors, requests }, null, 2));
  throw error;
} finally { await browser.close(); }
