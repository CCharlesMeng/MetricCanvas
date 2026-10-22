import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-table-row-number';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/pages/table-row-number`);
  const table = page.locator('[data-component="main/records-table"]');
  await expect(table.locator('tbody td[data-row-number]').first()).toHaveText('1');
  await table.getByRole('button', {name:'2',exact:true}).click();
  await expect(table.locator('tbody td[data-row-number]').first()).toHaveText('11');
  await page.screenshot({path:path.join(output,'playground-row-number.png'),fullPage:true});
  expect(errors).toEqual([]);
  console.log('Playground row-number route: page 1 starts at 1; page 2 starts at 11; no page errors.');
} finally { await browser.close(); }
