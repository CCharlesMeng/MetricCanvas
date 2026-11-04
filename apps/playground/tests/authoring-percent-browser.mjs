import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5197';
const output = process.argv[2] ?? '/tmp/metriccanvas-authoring-percent';
const document = JSON.parse(await readFile(new URL('../../../pages/capabilities/data/authoring-percent-coverage.json', import.meta.url), 'utf8'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage();
const errors = [], receipts = [];
page.on('pageerror', error => errors.push(error.message));
try {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(`${base}/pages/${document.id}`);
    const table = page.locator('[data-component="percentage/rate-table"]');
    await expect(table).toBeVisible({ timeout: 30_000 });
    await expect(table.locator('tbody tr')).toHaveCount(document.dataSources.rates.source.rows.length);
    await expect(table.locator('tbody tr').nth(0)).toContainText('12.50%');
    await expect(table.locator('tbody tr').nth(0)).toContainText('12.5%');
    await expect(table.locator('tbody tr').nth(1)).toContainText('0.0001');
    await expect(table.locator('tbody tr').nth(1)).toContainText('0.00%');
    await expect(table.locator('tbody tr').nth(2)).toContainText('-0.0001');
    await expect(table.locator('tbody tr').nth(2)).toContainText('-0.00%');
    await expect(table.locator('tbody tr').nth(3)).toContainText('0.00%');
    await expect(table.locator('tbody tr').nth(4)).toContainText('—');
    await expect(page.locator('[data-component="percentage/rate-card"]')).toContainText('12.50%');
    receipts.push({ width, rows: await table.locator('tbody').innerText() });
    await page.screenshot({ path: path.join(output, `page-${width}.png`), fullPage: true });
    await table.getByRole('button', { name: '继承百分比', exact: true }).click();
    await expect(table.locator('tbody tr').first()).toContainText('微小负值');
  }
  await page.goto(`${base}/files`);
  await page.getByRole('searchbox', { name: '搜索页面', exact: true }).fill(document.id);
  await expect(page.locator(`.page-card[href="/pages/${document.id}"]`)).toBeVisible();
  expect(errors).toEqual([]);
  await writeFile(path.join(output, 'browser.json'), JSON.stringify({ pageId: document.id, base, receipts, errors,
    catalogDiscoverable: true, data: 'inline synthetic; Python query coverage tested separately; no real DQE/Relay' }, null, 2));
  console.log('Authoring percent browser acceptance passed');
} finally { await browser.close(); }
