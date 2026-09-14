import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', (error) => errors.push(error.message));
const root = process.env.S1_BASE_URL || 'http://127.0.0.1:5181';
await mkdir('/private/tmp/metriccanvas-s1-evidence', { recursive: true });
try {
  await page.goto(`${root}/dialogue`);
  await expect(page.getByText('受控替身：非真实盘古，不保存页面')).toBeVisible();
  await page.getByRole('button', { name: 'draft-a', exact: true }).click();
  await expect(page.getByText('受控替身结果：draft-a')).toBeVisible();
  await page.screenshot({ path: '/private/tmp/metriccanvas-s1-evidence/t01-standalone.png' });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'draft-a', exact: true }).click();
  const canvas = page.getByRole('main', { name: '页面画布', exact: true });
  await expect(canvas.getByText('页面 draft-a')).toBeVisible();
  await page.getByRole('button', { name: 'slow', exact: true }).click();
  await page.getByRole('button', { name: 'draft-b', exact: true }).click();
  await expect(canvas.getByText('页面 draft-b')).toBeVisible();
  await page.waitForTimeout(600);
  await expect(canvas.getByText('页面 draft-b')).toBeVisible();
  for (const id of ['failure', 'invalid']) {
    await page.getByRole('button', { name: id, exact: true }).click();
    await expect(canvas.getByText('页面 draft-b')).toBeVisible();
  }
  await expect(page.getByTestId('global-rail')).toBeVisible();
  await expect(page.getByTestId('document-actions')).toBeVisible();
  await expect(page.getByRole('complementary', { name: '检查器' })).toBeVisible();
  await page.screenshot({ path: '/private/tmp/metriccanvas-s1-evidence/t01-workbench.png' });
  // Compatible upstream replacement drill: unchanged adapter/workbench, changed deployment version.
  await page.route('**/pangu-fixture.js*', (route) => route.fulfill({ contentType: 'text/javascript', body: `window.pangu={instance(id){return {renderChat(selector){document.querySelector(selector).textContent='SDK fixture '+new URL(document.currentScript?.src||location.href).searchParams;},destroy(){window.destroyed=(window.destroyed||0)+1;}}}};` }));
  for (const version of ['v1', 'v2']) {
    await page.addInitScript((version) => { window.__METRICCANVAS_PANGU__ = { resourceUrl: '/pangu-fixture.js', version }; }, version);
    const loaded = page.waitForRequest((request) => request.url().includes(`pangu-fixture.js?v=${version}`));
    await page.goto(root); await loaded;
    await expect(page.getByLabel('盘古对话模块').getByText(/SDK fixture/)).toBeVisible();
    await page.getByRole('link', { name: '页面管理', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.destroyed)).toBe(1);
  }
  expect(errors).toEqual([]);
  console.log('T01 browser PASS: standalone, embedded, failure/invalid/late preservation, shell, SDK v1→v2, destroy.');
} finally { await browser.close(); }
