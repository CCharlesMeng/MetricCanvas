import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-page-catalog';
const catalog = JSON.parse(await readFile(new URL('../page-catalog.json', import.meta.url), 'utf8'));
const cardCount = catalog.groups.reduce((sum, group) => sum + (group.collection ? 1 : catalog.pages.filter(entry => entry.group === group.id).length), 0);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const facts = { pages: 0, configSelectors: 0, desktop: false, mobile: false, download: false, related: false };

async function fitsViewport() {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

try {
  await page.goto(base);
  await expect(page.locator('.page-card')).toHaveCount(cardCount);
  await page.screenshot({ path: path.join(output, 'catalog-desktop.png') });
  await fitsViewport();
  facts.desktop = true;

  await page.getByRole('button', { name: /^筛选与状态联动/ }).click();
  await page.getByRole('button', { name: /^Dashboard/ }).click();
  await page.getByLabel('运行条件', { exact: true }).selectOption('sim');
  await page.getByRole('searchbox').fill('只刷新');
  await expect(page.locator('.page-card')).toHaveCount(1);
  await expect(page.locator('.page-card[href="/pages/chart-local-filter-page"]')).toBeVisible();
  await page.getByRole('button', { name: /^验收样例/ }).click();
  await expect(page.locator('.page-card')).toHaveCount(1);
  await page.getByRole('searchbox').fill('不存在的配置组合');
  await expect(page.getByRole('heading', { name: '没有找到匹配页面' })).toBeVisible();
  await page.locator('.empty').getByRole('button', { name: '重置筛选' }).click();
  await expect(page.locator('.page-card')).toHaveCount(cardCount);
  await page.getByRole('searchbox').fill('收入构成看板');
  await expect(page.locator('.page-card')).toHaveCount(1);
  await expect(page.locator('.page-card h3')).toHaveText('指标卡与文字混排｜收入构成');

  // 直接读取所有注册页面，确保说明确实能展示当前声明；业务取数不在本测试范围内。
  for (const entry of catalog.pages) {
    await page.goto(`${base}/pages/${entry.id}`);
    const guide = page.getByRole('complementary', { name: '示例使用说明' });
    await guide.locator(':scope > details > summary').click();
    await expect(guide.getByRole('heading', { name: '如何体验' })).toBeVisible();
    await expect(guide.locator('.environment')).toContainText(entry.environment.scope);
    const selectors = guide.locator('.config');
    await expect(selectors).toHaveCount(entry.guide.configPaths.length);
    for (let index = 0; index < entry.guide.configPaths.length; index++) {
      const config = selectors.nth(index);
      await config.locator('summary').click();
      expect(await config.locator('pre').count(), `${entry.id}: ${entry.guide.configPaths[index]}`).toBeGreaterThan(0);
      facts.configSelectors++;
    }
    expect(await guide.getByText('当前文档中未找到此配置', { exact: false }).count()).toBe(0);
    facts.pages++;
  }

  await page.goto(`${base}/pages/table-detail-overlay`);
  const guide = page.getByRole('complementary', { name: '示例使用说明' });
  await guide.locator(':scope > details > summary').click();
  await page.screenshot({ path: path.join(output, 'guide-desktop.png') });
  const downloadEvent = page.waitForEvent('download');
  await guide.getByRole('link', { name: '下载完整 JSON' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('table-detail-overlay.json');
  const downloaded = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(downloaded.id).toBe('table-detail-overlay');
  expect(downloaded.detailViews).toBeDefined();
  expect(JSON.stringify(downloaded)).not.toContain('configPaths');
  facts.download = true;
  await guide.getByRole('link', { name: '筛选、页内下钻与跨页导航', exact: true }).click();
  await expect(page).toHaveURL(`${base}/pages/demo`);
  await expect(page.getByRole('complementary', { name: '示例使用说明' }).locator(':scope > details')).not.toHaveAttribute('open');
  facts.related = true;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await expect(page.getByRole('searchbox')).toBeVisible();
  const reset = page.getByRole('button', { name: '重置筛选', exact: true });
  if (await reset.isVisible()) await reset.click();
  await expect(page.locator('.page-card')).toHaveCount(cardCount);
  await fitsViewport();
  await page.screenshot({ path: path.join(output, 'catalog-mobile.png'), fullPage: true });
  await page.getByRole('searchbox').fill('详情弹窗');
  await page.locator('.page-card[href="/pages/table-detail-overlay"]').click();
  await page.getByRole('complementary', { name: '示例使用说明' }).locator(':scope > details > summary').click();
  await page.locator('.page-guide .config').first().locator('summary').click();
  await fitsViewport();
  await page.screenshot({ path: path.join(output, 'guide-mobile.png'), fullPage: true });
  facts.mobile = true;

  expect(errors).toEqual([]);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'pass', ...facts, errors }, null, 2));
  console.log(JSON.stringify({ status: 'pass', ...facts, errors }));
} finally {
  await browser.close();
}
