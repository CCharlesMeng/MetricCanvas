import { expect, test, type Page } from '@playwright/test';
import { chooseTree, closeSelection, openSelection } from '../../../packages/embed/tests/browser/selection-actions';

type QueryReceipt = { filterValues: Array<{ queryField: string; values: string[] }> };
const target = '/pages/ioc-region-url-demo';
const tableRows = (page: Page) => page.locator('.runtime-view tbody tr');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const calls: QueryReceipt[] = [];
    Object.assign(window, { regionURLCalls: calls });
    window.addEventListener('metriccanvas:synthetic-region-url', event => calls.push((event as CustomEvent<QueryReceipt>).detail));
  });
});

for (const scenario of [
  { search: 'region-dept=中国地区部', field: 'demo_region', value: '中国地区部', rows: 2 },
  { search: 'rep-office=上海代表处', field: 'demo_office', value: '上海代表处', rows: 1 },
  { search: 'region-dept=中国地区部&rep-office=上海代表处', field: 'demo_office', value: '上海代表处', rows: 1 },
  { search: 'rep-office=上海代表处&region-dept=中国地区部', field: 'demo_region', value: '中国地区部', rows: 2 },
  { search: 'rep-office=北京代表处&rep-office=上海代表处', field: 'demo_office', value: '上海代表处', rows: 1 },
  { search: 'region=上海代表处&region.level=office', field: 'demo_office', value: '上海代表处', rows: 1 },
  { search: '', field: 'demo_region', value: '中国地区部', rows: 2 }
]) {
  test(`URL 恢复与查询绑定：${scenario.search || '页面默认值'}`, async ({ page }) => {
    await page.goto(`${target}?${scenario.search}`);
    await expect(tableRows(page)).toHaveCount(scenario.rows);
    await expect(page.locator('[data-filter-id="region"]')).toContainText(scenario.value);
    const calls = await page.evaluate(() => (window as typeof window & { regionURLCalls: QueryReceipt[] }).regionURLCalls);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(query => query.filterValues.some(value => value.queryField === scenario.field && value.values[0] === scenario.value))).toBe(true);
  });
}

test('同树改选清理旧键与未声明参数，刷新恢复同一查询', async ({ page }, info) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(`${target}?keep=保留&region=中国地区部&region.level=region-dept&rep-office=上海代表处`);
  await expect(tableRows(page)).toHaveCount(1);
  const region = page.locator('[data-filter-id="region"]');
  await chooseTree(region, '欧洲地区部');
  await closeSelection(region);
  await expect(tableRows(page)).toHaveCount(1);
  await expect(tableRows(page)).toContainText('法国代表处');
  expect([...new URL(page.url()).searchParams]).toEqual([['region-dept', '欧洲地区部']]);
  await chooseTree(region, '上海代表处');
  await closeSelection(region);
  await expect(tableRows(page)).toContainText('上海代表处');
  expect([...new URL(page.url()).searchParams]).toEqual([['rep-office', '上海代表处']]);
  await page.reload();
  await expect(tableRows(page)).toContainText('上海代表处');
  await page.screenshot({ path: info.outputPath('region-url-chinese.png'), fullPage: true });
  await openSelection(region);
  await region.getByRole('button', { name: '清空Region', exact: true }).click();
  await closeSelection(region);
  await expect(tableRows(page)).toHaveCount(3);
  expect([...new URL(page.url()).searchParams]).toEqual([['region.level', 'office']]);
  await page.reload();
  await expect(tableRows(page)).toHaveCount(3);
  expect(failures).toEqual([]);
});

test('最后空值被拒绝，未知候选阻断业务查询及导出', async ({ page }) => {
  const warnings:string[]=[];page.on('console',message=>{if(message.type()==='warning')warnings.push(message.text());});
  await page.goto(`${target}?region-dept=中国地区部&rep-office=`);
  await expect(page.getByText('目标筛选输入为空：region', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { regionURLCalls: QueryReceipt[] }).regionURLCalls)).toEqual([]);
  await page.goto(`${target}?rep-office=未授权代表处`);
  await expect(page.locator('[data-ioc-header]')).not.toContainText('等待筛选确认');
  await expect.poll(()=>warnings.join('\n')).toContain('等待筛选确认');
  await expect(page.getByRole('button', { name: '导出', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => (window as typeof window & { regionURLCalls: QueryReceipt[] }).regionURLCalls)).toEqual([]);
});
