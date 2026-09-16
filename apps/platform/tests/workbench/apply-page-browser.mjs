import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${process.env.APPLY_PAGE_BASE_URL || 'http://127.0.0.1:5187'}/apply-page`);
  const canvas = page.getByRole('main', { name: '页面画布', exact: true });
  for (const version of [1, 2]) {
    await page.getByRole('button', { name: '生成下一版卡片', exact: true }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(canvas.getByText(`模拟页面第 ${version} 版`, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(async (version) => {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('metriccanvas-authoring', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      try { return await new Promise((resolve, reject) => { const r = db.transaction('work').objectStore('work').getAll(); r.onsuccess = () => resolve(r.result.some(x => x.value.base?.revisionId === 'mock-r' + version)); r.onerror = () => reject(r.error); }); } finally { db.close(); }
    }, version)).toBe(true);
  }
  await page.getByRole('button', { name: '模拟读取失败', exact: true }).click();
  await expect(page.getByText(/模拟读取失败，保留当前页面/)).toBeVisible();
  await expect(canvas.getByText('模拟页面第 2 版', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '模拟其他页面通知', exact: true }).click();
  await expect(page.getByText(/通知属于其他页面/)).toBeVisible();
  await page.getByRole('button', { name: '模拟非法通知', exact: true }).click();
  await expect(page.getByText(/应用通知无效/)).toBeVisible();
  await expect(canvas.getByText('模拟页面第 2 版', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/private/tmp/metriccanvas-apply-page.png' });
  expect(errors).toEqual([]);
  console.log('PASS: repeated confirmation, cache refresh, failure preservation, foreign and invalid events');
} finally { await browser.close(); }
