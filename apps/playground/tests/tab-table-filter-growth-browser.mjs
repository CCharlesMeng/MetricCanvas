import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-tab-table-filter-growth';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];

async function geometry(container) {
  return container.evaluate(el => {
    const panel = el.querySelector('[data-tab-panel="multiple"]');
    const [upper, lower] = panel.querySelectorAll('.table-widget');
    const rect = node => {
      const box = node.getBoundingClientRect();
      return { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY, height: box.height };
    };
    return { upper: rect(upper), lower: rect(lower), upperHost: rect(upper.parentElement),
      panel: rect(panel), container: rect(el), section: rect(el.closest('.page-section')) };
  });
}

async function check(container, label) {
  await expect.poll(async () => {
    const box = await geometry(container);
    return Math.max(box.upper.bottom - box.lower.top, box.upper.bottom - box.upperHost.bottom,
      box.lower.bottom - box.panel.bottom, box.panel.bottom - box.container.bottom,
      box.container.bottom - box.section.bottom);
  }, { message: `${label}: tables and their layout owners must not overlap` }).toBeLessThanOrEqual(1);
  const box = await geometry(container);
  results.push({ label, ...box });
  return box;
}

async function search(table, value, count) {
  const input = table.getByRole('searchbox', { name: '表格搜索', exact: true });
  await input.fill(value);
  await input.press('Enter');
  await expect(table.locator('tbody tr')).toHaveCount(count);
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/pages/tab-table-filter-growth`);
  const containers = page.locator('.tab-container');
  await expect(containers).toHaveCount(5);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (let index = 0; index < 5; index += 1) {
      const container = containers.nth(index);
      const panel = container.locator('[data-tab-panel="multiple"]');
      const upper = panel.locator('.table-widget').first();
      const lower = panel.locator('.table-widget').nth(1);
      await search(upper, '第一组', 10);
      await expect(lower.locator('tbody tr')).toHaveCount(10);
      const ten = await check(container, `${width}px variant ${index}: 10 rows`);
      await upper.getByRole('button', { name: '清空表格搜索', exact: true }).click();
      await expect(upper.locator('tbody tr')).toHaveCount(20);
      const twenty = await check(container, `${width}px variant ${index}: 20 rows`);
      expect(twenty.upper.height).toBeGreaterThan(ten.upper.height + 20);
      expect(twenty.lower.top).toBeGreaterThan(ten.lower.top + 20);
      await expect(lower.locator('tbody tr')).toHaveCount(10);
      await container.getByRole('tab', { name: '单个表格', exact: true }).click();
      if (index === 1) expect(await container.evaluate(el => el.getBoundingClientRect().height)).toBe(524);
      await container.getByRole('tab', { name: '多个表格', exact: true }).click();
      await expect(upper.locator('tbody tr')).toHaveCount(20);
      await check(container, `${width}px variant ${index}: revisited`);
      await search(upper, '第一组', 10);
      await expect.poll(async () => Math.abs((await geometry(container)).upper.height - ten.upper.height),
        { message: `${width}px variant ${index}: shrink height` }).toBeLessThanOrEqual(1);
      await check(container, `${width}px variant ${index}: shrunk`);
      await search(upper, '不存在的记录', 1);
      await expect(upper.locator('.empty-row')).toHaveText('暂无数据');
      await check(container, `${width}px variant ${index}: empty`);
      await upper.getByRole('button', { name: '清空表格搜索', exact: true }).click();
      await expect(upper.locator('tbody tr')).toHaveCount(20);
      await check(container, `${width}px variant ${index}: recovered`);
    }
    await page.screenshot({ path: path.join(output, `tabs-${width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'pass', results, errors }, null, 2));
  console.log(JSON.stringify({ status: 'pass', checks: results.length, errors }));
} catch (error) {
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'fail', results, errors, failure: error.message }, null, 2));
  throw error;
} finally {
  await browser.close();
}
