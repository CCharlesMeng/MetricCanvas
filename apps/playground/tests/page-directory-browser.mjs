import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pageFiles } from '../../../tools/scripts/page-files.mjs';

const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-page-directory';
const files = pageFiles(fileURLToPath(new URL('../../../pages/', import.meta.url)));
const ids = files.map(file => path.basename(file, '.json'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const facts = {};

async function reset() {
  const button = page.getByRole('button', { name: '重置筛选', exact: true }).first();
  if (await button.count()) await button.click();
}

try {
  await page.goto(base);
  await expect(page.locator('.page-card')).toHaveCount(ids.length);
  await page.screenshot({ path: path.join(output, 'directory-desktop.png'), fullPage: true });
  await page.getByLabel('组件类型', { exact: true }).selectOption('table');
  await page.getByLabel('数据来源', { exact: true }).selectOption('inline');
  await page.getByRole('searchbox').fill('table-detail-overlay');
  await expect(page.locator('.page-card')).toHaveCount(1);
  const card = page.locator('.page-card').first();
  await card.scrollIntoViewIfNeeded();
  const scrollY = await page.evaluate(() => window.scrollY);
  await card.click();
  await expect(page).toHaveURL(`${base}/pages/table-detail-overlay`);
  await page.reload();
  await page.getByRole('link', { name: '← 页面目录' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('table-detail-overlay');
  await expect(page.getByLabel('组件类型', { exact: true })).toHaveValue('table');
  await expect(page.getByLabel('数据来源', { exact: true })).toHaveValue('inline');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scrollY, 0);
  await page.getByRole('searchbox').fill('multi-query-table');
  await expect(page.getByRole('heading', { name: '没有找到匹配页面' })).toBeVisible();
  await page.getByLabel('数据来源', { exact: true }).selectOption('query');
  await expect(page.locator('.page-card')).toHaveCount(1);
  facts.documentFiltersAndReturnState = true;
  await reset();
  await expect(page.locator('.page-card')).toHaveCount(ids.length);

  for (const id of ids) {
    console.log(`Checking page ${id}`);
    await page.goto(`${base}/pages/${id}`);
    await expect(page.getByRole('complementary', { name: '页面 JSON' })).toBeVisible();
    await expect(page.locator('.page-frame > .error-page'), id).toHaveCount(0);
  }
  facts.pages = ids.length;
  await page.goto(`${base}/pages/table-detail-overlay`);
  const document = page.getByRole('complementary', { name: '页面 JSON' });
  await document.locator('summary').click();
  const downloadEvent = page.waitForEvent('download');
  await document.getByRole('link', { name: '下载完整 JSON' }).click();
  const download = await downloadEvent;
  const raw = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(raw.id).toBe('table-detail-overlay');
  expect(raw.detailViews).toBeDefined();
  expect(download.suggestedFilename()).toBe('table-detail-overlay.json');
  facts.download = true;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await reset();
  await expect(page.locator('.page-card')).toHaveCount(ids.length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(output, 'directory-mobile.png'), fullPage: true });
  facts.mobile = true;
  expect(errors).toEqual([]);
  const result = { status: 'pass', ...facts, errors };
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
