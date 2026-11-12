import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.DQE_TIMEOUT_BASE_URL ?? 'http://127.0.0.1:5204';
const output = process.argv[2] ?? '/tmp/metriccanvas-dqe-request-timeout/browser';
const fixture = JSON.parse(await readFile(new URL('../../../pages/capabilities/query/dqe-request-timeout.json', import.meta.url), 'utf8'));
const request = fixture.dataSources.records.source.query.body;
const row = { '审批记录ID': 'TIMEOUT-OK', '商务编号': 'B001', '特价审批通过时间': '2025-01-15', '区域': '东区', '审批金额': 120, '预算金额': 200 };
const response = { retCode: 'CBC.0000', results: [{ code: 'SUCCESS', data: [row], total_count: 1 }] };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

async function scenario(mode) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const consoleErrors = [];
  let heldRoute;
  await page.clock.install();
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', route => { heldRoute = route; });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  try {
    await page.goto(`${base}/pages/${fixture.id}`);
    await expect.poll(() => Boolean(heldRoute)).toBe(true);
    expect(heldRoute.request().postDataJSON()).toEqual(request);
    await page.clock.pauseAt(await page.evaluate(() => Date.now()));
    const table = page.locator('.table-widget');
    await page.clock.fastForward(120_000);
    await expect(table).toHaveAttribute('aria-busy', 'true');
    expect(consoleErrors).toEqual([]);
    if (mode === 'success') {
      await page.clock.fastForward(30_000);
      await heldRoute.fulfill({ json: response });
      await expect(table.getByRole('cell', { name: 'TIMEOUT-OK', exact: true })).toBeVisible();
      await expect(table).toHaveAttribute('aria-busy', 'false');
      expect(consoleErrors).toEqual([]);
    } else {
      await page.clock.fastForward(59_000);
      await expect(table).toHaveAttribute('aria-busy', 'true');
      expect(consoleErrors).toEqual([]);
      await page.clock.fastForward(1_000);
      await expect.poll(() => consoleErrors.some(text => text.includes('DQE_TIMEOUT') && text.includes('180000'))).toBe(true);
      await expect(table.getByRole('cell', { name: 'TIMEOUT-OK', exact: true })).toHaveCount(0);
      await expect(table).toHaveAttribute('aria-busy', 'false');
    }
    expect(errors).toEqual([]);
    await page.screenshot({ path: path.join(output, `${mode}.png`), fullPage: true });
    return { mode, errors, consoleErrors };
  } finally {
    await page.close();
  }
}

try {
  const results = [];
  results.push(await scenario('success'));
  results.push(await scenario('timeout'));
  results.push(await scenario('success'));
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ page: fixture.id, clock: 'virtual', transport: 'synthetic HTTP', results }, null, 2));
  console.log('DQE default timeout browser acceptance passed');
} finally {
  await browser.close();
}
