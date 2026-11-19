import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const runSim = `
  const {executeLoadingStructure} = require('./tools/dqe-sim/src/loading-structure.ts');
  const items = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
  process.stdout.write(JSON.stringify({retCode:'CBC.0000', results:items.map(executeLoadingStructure)}));
`;

async function captureDetailRequests(page: Page) {
  const regions: string[][] = [];
  await page.route('**/dsl/execute', async route => {
    const { dsl_list: items } = route.request().postDataJSON();
    for (const item of items) {
      const region = item.filter.dims.find((dim: { dim_name: string }) => dim.dim_name === 'chart_demo_region');
      regions.push(region.dim_value_list);
    }
    const data = execFileSync(process.execPath, ['--import', 'tsx', '-e', runSim], {
      cwd: new URL('../../../', import.meta.url), input: JSON.stringify(items), encoding: 'utf8'
    });
    await route.fulfill({ json: JSON.parse(data) });
  });
  return regions;
}

test('metric value activates the same page’s Tab with the currently applied filter', async ({ page }) => {
  const regions = await captureDetailRequests(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/pages/metric-card-select-tab?demo-context=订单监控');
  const summary = page.getByRole('tab', { name: '订单概览' });
  const details = page.getByRole('tab', { name: '超期明细' });
  const overview = page.locator('[data-tab-panel="overview"]');
  const overdue = page.locator('[data-tab-panel="overdue"]');
  await expect(summary).toHaveAttribute('aria-selected', 'true');
  await expect(overdue).toHaveCount(0);
  const initialPanel = await overview.elementHandle();
  const initialHistoryLength = await page.evaluate(() => history.length);
  const filter = page.getByRole('button', { name: '海外', exact: true });
  await filter.click();
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/orders-region=OVERSEAS/);
  expect(regions).toEqual([]);

  await page.getByText('超期单数', { exact: true }).click();
  await expect(summary).toHaveAttribute('aria-selected', 'true');
  const metric = page.getByRole('button', { name: '超期单数 12' });
  await expect(metric).not.toHaveAttribute('href');
  await metric.click();
  await expect(details).toHaveAttribute('aria-selected', 'true');
  await expect(overdue.getByRole('row').nth(1)).toContainText('20');
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: '订单监控' })).toBeVisible();
  const search = new URL(page.url()).searchParams;
  expect(search.get('tab.order-detail-tabs')).toBe('overdue');
  expect(search.get('orders-region')).toBe('OVERSEAS');
  expect(search.get('demo-context')).toBe('订单监控');

  await metric.click();
  await expect(details).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: '历史详情入口 12' }).click();
  await expect(page.getByRole('dialog', { name: '历史详情' })).toBeVisible();
  await expect(details).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: '零值指标 0' }).press('Enter');
  await expect(summary).toHaveAttribute('aria-selected', 'true');
  expect(await initialPanel!.evaluate(node => node.isConnected)).toBe(true);
  await metric.click();
  await expect(details).toHaveAttribute('aria-selected', 'true');
  await expect(overdue.getByRole('row').nth(1)).toContainText('20');
  await expect(page.getByRole('button', { name: /缺失指标/ })).toHaveCount(0);
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength);
  expect(regions).toEqual([['OVERSEAS']]);
  expect(errors).toEqual([]);
});

test('metric value switches Tab in the JSON preview without an address adapter', async ({ page }) => {
  const regions = await captureDetailRequests(page);
  const document = readFileSync(new URL('../../../pages/capabilities/layout/metric-card-select-tab.json', import.meta.url), 'utf8');
  await page.goto('/preview');
  await page.getByRole('textbox', { name: 'Page JSON 编辑器' }).fill(document);
  await expect(page.getByRole('tab', { name: '订单概览' })).toHaveAttribute('aria-selected', 'true');
  const before = page.url();
  await page.getByRole('button', { name: '超期单数 12' }).press('Space');
  await expect(page.getByRole('tab', { name: '超期明细' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-tab-panel="overdue"]').getByRole('row').nth(1)).toContainText('10');
  await page.getByRole('button', { name: '零值指标 0' }).press('Space');
  await expect(page.getByRole('tab', { name: '订单概览' })).toHaveAttribute('aria-selected', 'true');
  expect(page.url()).toBe(before);
  expect(regions).toEqual([['CN']]);
});

test('the IOC page routes the configured metric values and keeps the applied header filters', async ({ page }) => {
  const url = new URLSearchParams({ period: 'month:2026-11', 'customer-category': '卓越NA' });
  await page.goto(`/pages/rep-office-execution-efficiency-tab-demo?${url}`);
  const people = page.getByRole('button', { name: /商务代表处SDT平均决策人数/ });
  await expect(people.locator('.row-value')).toHaveCSS('text-decoration-line', 'underline');
  await expect(people.locator('.unit')).toHaveText('人');
  await expect(people.locator('.unit')).toHaveCSS('text-decoration-line', 'none', { timeout: 2000 });
  const closureRate = page.getByRole('button', { name: /合同决策代表处闭环率/ }).locator('.row-value');
  await expect(closureRate).toHaveText(/\d%$/);
  await expect(closureRate).toHaveCSS('text-decoration-line', 'underline');
  const routes = [
    [/合同决策代表处闭环率/, '合同决策闭环率明细'],
    [/商务代表处SDT平均决策时长/, '商务审批明细'],
    [/商务决策代表处闭环率/, '商务决策闭环率明细'],
    [/商务代表处SDT平均决策人数/, '商务审批明细']
  ] as const;
  for (const [name, label] of routes) {
    await page.getByRole('button', { name }).click();
    await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel').getByText(/合成项目/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '移除客户分类：卓越NA' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '统计期间' })).toHaveValue('2026-11');
  }
});
