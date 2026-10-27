import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5194';
const output = process.argv[2] ?? '/tmp/metriccanvas-tab-multiple-tables';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];

async function panelGeometry(panel) {
  return panel.evaluate(el => {
    const style = getComputedStyle(el);
    const container = el.closest('.tab-container');
    return {
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      height: el.clientHeight,
      scrollHeight: el.scrollHeight,
      bottom: el.getBoundingClientRect().bottom,
      containerBottom: container.getBoundingClientRect().bottom,
      containerHeight: container.getBoundingClientRect().height,
      lastTableBottom: Array.from(el.querySelectorAll('.table-widget')).at(-1).getBoundingClientRect().bottom
    };
  });
}

async function checkMultiple(container, label) {
  const panel = container.locator('[data-tab-panel="multiple"]');
  await expect(panel.locator('.table-widget')).toHaveCount(2);
  const geometry = await panelGeometry(panel);
  expect(geometry.overflowX, label).toBe('visible');
  expect(geometry.overflowY, label).toBe('visible');
  expect(geometry.scrollHeight, label).toBeLessThanOrEqual(geometry.height + 1);
  expect(geometry.lastTableBottom, label).toBeLessThanOrEqual(geometry.bottom + 1);
  expect(geometry.bottom, label).toBeLessThanOrEqual(geometry.containerBottom + 1);
  results.push({ label, geometry });
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/pages/tab-multiple-tables`);
  const containers = page.locator('.tab-container');
  await expect(containers).toHaveCount(4);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (let index = 0; index < 4; index += 1) {
      const container = containers.nth(index);
      await checkMultiple(container, `${width}px variant ${index}`);
      await container.getByRole('tab', { name: '单个表格', exact: true }).click();
      await expect(container.locator('[data-tab-panel="multiple"]')).toBeHidden();
      await expect(container.locator('[data-tab-panel="single"]')).toBeVisible();
      if (index === 1) expect(await container.evaluate(el => el.getBoundingClientRect().height)).toBe(524);
      await container.getByRole('tab', { name: '多个表格', exact: true }).click();
      await checkMultiple(container, `${width}px variant ${index} switched back`);
    }
    const firstTable = containers.first().locator('[data-tab-panel="multiple"] .table-widget').first();
    const secondTable = containers.first().locator('[data-tab-panel="multiple"] .table-widget').nth(1);
    await firstTable.getByRole('button', { name: '下一页', exact: true }).click();
    await expect(firstTable.locator('tbody tr').first()).toContainText('合成记录11');
    await expect(secondTable.locator('tbody tr').first()).toContainText('合成记录1');
    await containers.first().getByRole('tab', { name: '单个表格', exact: true }).click();
    await containers.first().getByRole('tab', { name: '多个表格', exact: true }).click();
    await expect(firstTable.locator('tbody tr').first()).toContainText('合成记录11');
    const scroll = firstTable.locator('.scroll');
    expect(await scroll.evaluate(el => getComputedStyle(el).overflowX)).toBe('auto');
    if (width === 390) {
      expect(await scroll.evaluate(el => el.scrollWidth)).toBeGreaterThan(await scroll.evaluate(el => el.clientWidth));
      await scroll.evaluate(el => { el.scrollLeft = 200; });
      expect(await scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    }
    await page.screenshot({ path: path.join(output, `tabs-${width}.png`), fullPage: true });
    await firstTable.getByRole('button', { name: '上一页', exact: true }).click();
  }
  expect(errors).toEqual([]);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'pass', results, errors }, null, 2));
  console.log(JSON.stringify({ status: 'pass', checks: results.length, errors }));
} finally {
  await browser.close();
}
