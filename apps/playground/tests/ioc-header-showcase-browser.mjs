import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-ioc-header-showcase';
const entries = (await readdir(new URL('../../../pages/capabilities/ioc-header/scenarios/', import.meta.url))).filter(file => file.endsWith('.json')).map(file => ({ id: file.slice(0, -5), scenario: file.slice('ioc-header-'.length, -'-demo.json'.length) }));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel:'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], externalDataRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST') externalDataRequests.push(request.url()); });
const facts = { scenarios: [], capabilityItems: 0, filtering: false, catalogReturn: false, navigation: false, currency: false, hierarchy: false, mobile: false, history: false };
async function fits(target = page) { expect(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }

try {
  await page.goto(`${base}/`);
  await page.getByLabel('文件夹路径').selectOption('capabilities/ioc-header/scenarios');
  await expect(page.locator('.page-card')).toHaveCount(15);
  await page.goto(`${base}/ioc-header?scene=time-modes`);
  await expect(page.getByLabel('选择场景')).toHaveValue('time-modes');
  await page.reload();
  await expect(page.getByLabel('选择场景')).toHaveValue('time-modes');
  await page.getByRole('button', { name: '业务筛选', exact: true }).click();
  await expect(page.getByLabel('选择场景')).toHaveValue('business-options');
  await page.goBack();
  await expect(page.getByLabel('选择场景')).toHaveValue('time-modes');
  facts.history = true;
  await page.getByRole('link', { name: /页面目录/ }).click();
  await expect(page.getByLabel('文件夹路径')).toHaveValue('capabilities/ioc-header/scenarios');
  await expect(page.locator('.page-card')).toHaveCount(15);
  facts.catalogReturn = true;
  facts.filtering = true;
  await page.goto(`${base}/ioc-header?scene=time-modes`);

  await page.getByRole('button', { name: '能力一览', exact: true }).click();
  const inventory = page.getByRole('region', { name: '页头能力一览' });
  facts.capabilityItems = await inventory.locator('.capability-item').count();
  expect(facts.capabilityItems).toBeGreaterThan(25);
  await inventory.getByRole('searchbox').fill('T08');
  await expect(inventory.locator('.capability-item')).toHaveCount(1);
  await inventory.locator('.capability-item summary').click();
  await expect(inventory.locator('.capability-item')).toContainText('年月维度绑定');
  await inventory.getByRole('link', { name: '查看演示 →' }).click();
  await expect(page.getByLabel('选择场景')).toHaveValue('calendar-window');

  // Each scenario uses the saved Page declaration and the real product runtime, without service mocks.
  for (const entry of entries) {
    await page.goto(`${base}/ioc-header?scene=${entry.scenario}`);
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('[data-ioc-header]')).toBeVisible();
    if (!['navigation-source', 'navigation-list'].includes(entry.scenario)) {
      await expect(frame.locator('.page-frame')).toContainText('合成 ·');
      await expect(frame.locator('.page-frame')).not.toContainText('数据查询失败');
    }
    facts.scenarios.push(entry.scenario);
  }

  await page.goto(`${base}/ioc-header?topic=time&scene=time-modes`);
  let frame = page.frameLocator('iframe');
  const period = frame.locator('[data-filter-id="period"]');
  await period.getByRole('button', { name: 'ISO周', exact: true }).click();
  await expect(frame.locator('[data-component="body/bound-table"]')).toContainText('2026-10-05 至 2026-10-11');
  await page.screenshot({ path: path.join(output, 'time-desktop.png'), fullPage: true });

  await page.goto(`${base}/ioc-header?topic=currency&scene=currency`);
  frame = page.frameLocator('iframe');
  const currency = frame.locator('[data-filter-id="currency"]'), amount = frame.locator('[data-filter-id="amount"]');
  const amountTable = frame.locator('[data-component="body/amount-table"]');
  await expect(amountTable).toContainText('2,200,000');
  await currency.getByRole('button', { name: '币种', exact: true }).click();
  await currency.getByRole('option', { name: '美元', exact: true }).click();
  await amount.locator('summary').click();
  await amount.getByRole('button', { name: '全部', exact: true }).click();
  await amount.getByRole('button', { name: '确定', exact: true }).click();
  await expect(amountTable).toContainText('310,000');
  await amount.locator('summary').click();
  await amount.getByRole('textbox', { name: '预签金额下限', exact: true }).fill('50');
  await amount.getByRole('button', { name: '确定', exact: true }).click();
  await expect(amountTable.getByRole('cell', { name: '甲项目', exact: true })).toHaveCount(0);
  await expect(amountTable.getByRole('cell', { name: '乙项目', exact: true })).toBeVisible();
  facts.currency = true;

  await page.goto(`${base}/ioc-header?topic=navigation&scene=navigation-source`);
  frame = page.frameLocator('iframe');
  await frame.getByRole('link', { name: '携带已应用条件进入清单', exact: false }).click();
  await expect(frame.getByRole('link', { name: '示例项目甲', exact: true })).toBeVisible();
  await frame.getByRole('link', { name: '示例项目甲', exact: true }).click();
  await expect(frame.locator('[data-component="detail/bound-table"]')).toContainText('project_code=P&中文/001');
  const month = frame.getByRole('combobox', { name: '详情单月', exact: true });
  await month.fill('2026-08'); await month.press('Enter');
  await expect(frame.locator('[data-component="detail/bound-table"]')).toContainText('sales_month=2026-08');
  facts.navigation = true;

  await page.goto(`${base}/ioc-header?topic=business&scene=business-tree`);
  frame = page.frameLocator('iframe');
  await expect(frame.locator('.page-frame')).toContainText('department_code=same');
  const expand = frame.getByRole('button', { name: '展开筛选', exact: true });
  if (await expand.isVisible()) await expand.click();
  const region = frame.locator('[data-filter-id="region"]');
  await region.getByRole('tab', { name: '代表处', exact: true }).click();
  await region.locator('button[aria-haspopup=tree]').click();
  await region.getByRole('textbox').fill('北京代表处');
  await region.getByRole('button', { name: '北京代表处', exact: true }).click();
  await expect(frame.locator('.page-frame')).toContainText('office_code=same');
  facts.hierarchy = true;

  await page.goto(`${base}/ioc-header?view=capabilities`);
  await page.screenshot({ path: path.join(output, 'capabilities-desktop.png'), fullPage: true });
  await fits();
  await page.setViewportSize({ width: 390, height: 844 });
  await fits();
  await page.screenshot({ path: path.join(output, 'capabilities-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '交互演示', exact: true }).click();
  await page.getByRole('button', { name: '业务筛选', exact: true }).click();
  await page.getByLabel('选择场景').selectOption('business-tree');
  frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-ioc-header]')).toBeVisible();
  await expect(frame.locator('.page-frame')).toContainText('department_code=same');
  await fits();
  await fits(page.frames().find(item => item.url().includes('/pages/')));
  await page.screenshot({ path: path.join(output, 'interactive-mobile.png'), fullPage: true });
  await page.goto(`${base}/ioc-header?topic=invalid&scene=invalid`);
  await expect(page.getByRole('button', { name: '完整演示', exact: true })).toHaveAttribute('aria-pressed', 'true');
  facts.mobile = true;
  expect(externalDataRequests).toEqual([]);
  expect(errors).toEqual([]);
  const result = { status: 'pass', ...facts, errors, externalDataRequests };
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
