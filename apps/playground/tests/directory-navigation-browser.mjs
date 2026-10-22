import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-directory-navigation';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 600 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const facts = {};

async function expectFilters(query, layout = 'Dashboard') {
  await expect(page).toHaveURL(`${base}/`);
  await expect(page.getByRole('searchbox', { name: '搜索页面', exact: true })).toHaveValue(query);
  await expect(page.getByRole('navigation', { name: '布局形态' }).getByRole('button', { name: new RegExp(`^${layout}`) })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('组件类型', { exact: true })).toHaveValue('table');
  await expect(page.getByLabel('数据来源', { exact: true })).toHaveValue('inline');
  await expect(page.locator('.page-card')).toHaveCount(1);
}

async function openCard(id) {
  const card = page.locator(`.page-card[href="/pages/${id}"]`);
  await card.scrollIntoViewIfNeeded();
  const scrollY = await page.evaluate(() => window.scrollY);
  await card.click();
  await expect(page).toHaveURL(`${base}/pages/${id}`);
  await expect(page.getByRole('complementary', { name: '页面 JSON' })).toBeVisible();
  return scrollY;
}

try {
  await page.goto(base);
  await page.getByLabel('组件类型', { exact: true }).selectOption('table');
  await page.getByRole('button', { name: /^Dashboard/ }).click();
  await page.getByLabel('数据来源', { exact: true }).selectOption('inline');
  await page.getByRole('searchbox', { name: '搜索页面', exact: true }).fill('详情弹窗');
  await expectFilters('详情弹窗');
  const firstY = await openCard('table-detail-overlay');
  expect(firstY).toBeGreaterThan(0);
  await page.reload();
  await page.getByRole('link', { name: '← 页面目录' }).click();
  await expectFilters('详情弹窗');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(firstY, 0);
  facts.directoryLinkAfterDetailReload = true;
  facts.scrollRestored = true;
  await page.screenshot({ path: path.join(output, 'restored-catalog.png') });

  await page.getByRole('searchbox', { name: '搜索页面', exact: true }).fill('');
  await page.getByRole('button', { name: /^Report/ }).click();
  await page.getByRole('searchbox', { name: '搜索页面', exact: true }).fill('table-toolbar-demo');
  await expectFilters('table-toolbar-demo', 'Report');
  const secondY = await openCard('table-toolbar-demo');
  await page.goBack();
  await expectFilters('table-toolbar-demo', 'Report');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(secondY, 0);
  await page.goBack();
  await expect(page).toHaveURL(`${base}/pages/table-detail-overlay`);
  await page.goBack();
  await expectFilters('详情弹窗');
  await page.goForward();
  await expect(page).toHaveURL(`${base}/pages/table-detail-overlay`);
  await page.goForward();
  await expectFilters('table-toolbar-demo', 'Report');
  facts.historyEntriesIndependent = true;

  await page.reload();
  await expectFilters('table-toolbar-demo', 'Report');
  await page.getByRole('searchbox', { name: '搜索页面', exact: true }).fill('不存在的目录结果');
  await expect(page.getByRole('heading', { name: '没有找到匹配页面' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('searchbox', { name: '搜索页面', exact: true })).toHaveValue('不存在的目录结果');
  await expect(page.getByRole('heading', { name: '没有找到匹配页面' })).toBeVisible();
  facts.reloadAndEmptyResults = true;

  await expect(page.getByRole('navigation', { name: '布局形态' }).getByRole('button', { name: /^Report/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('组件类型', { exact: true })).toHaveValue('table');
  await expect(page.getByLabel('数据来源', { exact: true })).toHaveValue('inline');
  await page.getByRole('searchbox', { name: '搜索页面', exact: true }).fill('table-toolbar-demo');
  await expectFilters('table-toolbar-demo', 'Report');
  await page.getByRole('searchbox', { name: '搜索页面', exact: true }).fill('不存在的目录结果');
  facts.emptyResultsRetainSelections = true;

  await page.locator('.empty').getByRole('button', { name: '重置筛选' }).click();
  const total = await page.locator('.page-card').count();
  expect(total).toBeGreaterThan(1);
  await openCard('table-detail-overlay');
  // 直接访问另一页面后也能返回最近的目录，不依赖上一历史记录为目录。
  await page.goto(`${base}/pages/table-toolbar-demo`);
  await page.getByRole('link', { name: '← 页面目录' }).click();
  await expect(page.getByRole('searchbox', { name: '搜索页面', exact: true })).toHaveValue('');
  await expect(page.locator('.page-card')).toHaveCount(total);
  await expect(page.getByLabel('数据来源', { exact: true })).toHaveValue('all');
  await expect(page.getByRole('navigation', { name: '布局形态' }).getByRole('button')).toHaveCount(3);
  expect(await page.getByLabel('组件类型', { exact: true }).locator('option').count()).toBeGreaterThan(1);
  facts.resetAndDirectNavigation = true;

  await page.getByRole('searchbox', { name: '搜索页面', exact: true }).fill('table-detail-overlay');
  await openCard('table-detail-overlay');
  const fresh = await page.context().newPage();
  await fresh.goto(`${base}/pages/table-detail-overlay`);
  await fresh.getByRole('link', { name: '← 页面目录' }).click();
  await expect(fresh.getByRole('searchbox', { name: '搜索页面', exact: true })).toHaveValue('');
  await expect(fresh.locator('.page-card')).toHaveCount(total);
  await fresh.close();
  facts.freshTab = true;

  const blocked = await browser.newPage();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('storage blocked'); } });
  });
  blocked.on('pageerror', (error) => errors.push(error.message));
  await blocked.goto(base);
  await blocked.getByRole('searchbox', { name: '搜索页面', exact: true }).fill('table-detail-overlay');
  await blocked.locator('.page-card[href="/pages/table-detail-overlay"]').click();
  await blocked.getByRole('link', { name: '← 页面目录' }).click();
  await expect(blocked.getByRole('searchbox', { name: '搜索页面', exact: true })).toHaveValue('table-detail-overlay');
  await expect(blocked.locator('.page-card')).toHaveCount(1);
  await blocked.close();
  facts.storageUnavailable = true;

  expect(errors).toEqual([]);
  const result = { status: 'pass', ...facts, errors };
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
