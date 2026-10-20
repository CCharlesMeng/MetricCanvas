import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.TAB_URL_BASE_URL ?? 'http://127.0.0.1:5193';
const output = process.argv[2] ?? '/tmp/metriccanvas-tab-url';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const results = [];
page.on('pageerror', error => errors.push(error.message));
const source = `${base}/pages/tab-url-source`;
const target = `${base}/pages/tab-url-initialization`;
async function selected(sales, support) {
  const containers = page.locator('.tab-container');
  await expect(containers).toHaveCount(2);
  await expect(containers.nth(0).getByRole('tab', { name: sales, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(containers.nth(1).getByRole('tab', { name: support, exact: true })).toHaveAttribute('aria-selected', 'true');
}
try {
  // Consume the two complete authored pages; tests never rewrite their interaction metadata.
  for (const [link, sales, support] of [
    ['固定打开明细与已关闭工单', '销售明细', '已关闭工单'],
    ['页面参数打开明细', '销售明细', '未关闭工单'],
    ['从当前行打开销售明细', '销售明细', '未关闭工单'],
    ['从当前行打开销售概览', '销售概览', '未关闭工单'],
    ['未指定使用默认', '销售概览', '未关闭工单'],
    ['无效值回退', '销售概览', '未关闭工单'],
    ['空值回退', '销售概览', '未关闭工单'],
    ['重复值回退', '销售概览', '未关闭工单']
  ]) {
    await page.goto(source);
    const anchor = page.getByRole('link', { name: new RegExp(`^${link}(?: →)?$`) });
    await expect(anchor).toHaveAttribute('href', /\/pages\/tab-url-initialization/);
    await anchor.click();
    await selected(sales, support);
    if (link === '固定打开明细与已关闭工单') expect(new URL(page.url()).hash).toBe('#tabs');
    if (link === '页面参数打开明细') expect(new URL(page.url()).searchParams.get('static')).toBe('kept');
    results.push({ link, sales, support, status: 'pass' });
  }

  await page.goto(`${target}?sales-tab=detail&support-tab=closed`);
  await selected('销售明细', '已关闭工单');
  const original = page.url();
  await page.getByRole('tab', { name: '销售概览', exact: true }).click();
  await selected('销售概览', '已关闭工单');
  expect(page.url()).toBe(original);
  await page.reload();
  await selected('销售明细', '已关闭工单');
  results.push({ scenario: 'manual-switch-independent-and-refresh', status: 'pass' });

  await page.goto(`${target}?tab=detail&sales-tab=detail&sales-tab=detail`);
  await selected('销售概览', '未关闭工单');
  await page.goto(`${target}?tab=detail`);
  await selected('销售概览', '未关闭工单');
  results.push({ scenario: 'duplicate-identical-and-undeclared-key', status: 'pass' });

  await page.goto(`${target}?sales-tab=detail&support-tab=closed`);
  await selected('销售明细', '已关闭工单');
  await page.screenshot({ path: path.join(output, 'tabs-wide.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await selected('销售明细', '已关闭工单');
  await page.screenshot({ path: path.join(output, 'tabs-narrow.png'), fullPage: true });
  expect(errors).toEqual([]);
  const result = { status: 'pass', browser: browser.version(), results, errors };
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
