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
    if (version === 'v1') {
      await page.evaluate(() => { window.__METRICCANVAS_PANGU__.version = 'v2'; });
      await page.getByRole('link', { name: '页面搭建工作台', exact: true }).click();
      await expect(page.getByText('盘古资源版本已固定，请重新加载页面后切换版本。')).toBeVisible();
      await page.getByRole('link', { name: '页面管理', exact: true }).click();
      await page.evaluate(() => { window.__METRICCANVAS_PANGU__.version = 'v1'; });
      await page.getByRole('link', { name: '页面搭建工作台', exact: true }).click();
      await expect(page.getByLabel('盘古对话模块').getByText(/SDK fixture/)).toBeVisible();
    }
  }
  const manual = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  manual.on('pageerror', (error) => errors.push(error.message));
  await manual.addInitScript(() => {
    window.__METRICCANVAS__ = { dqeEndpoint: '/fixture-dqe', pageAssetsBaseUrl: '/fixture-assets', authToken: 'fixture', operatorId: 'alice', workspaceId: 'workspace' };
  });
  let stored = { schemaVersion: '6.0', layoutForm: 'report', id: 'manual-page', dataSources: {}, sections: [{ id: 's', title: '页面', container: 'panel', components: [{ id: 't', type: 'text', layout: { span: 12 }, props: { title: '原标题', body: '固定内容' } }] }] };
  let revision = 1, writes = 0, fail = false;
  const response = () => ({ retCode: '0', page_metadata_id: 'metadata-7', page_id: 'manual-page', revision_id: `r${revision}`, revision_number: revision, page_metadata_definition: JSON.stringify(stored) });
  await manual.route('**/fixture-assets/user-page-metadata**', async (route) => {
    const request = route.request();
    if (request.method() === 'PUT') {
      writes++;
      const body = request.postDataJSON();
      expect(request.url()).toContain('/metadata-7'); expect(body.base_revision_id).toBe(`r${revision}`);
      expect(body.page_metadata_definition.schemaVersion).toBe('6.1'); expect(body.page_metadata_definition.layout).toBe('report');
      expect(body.page_metadata_definition.layoutForm).toBeUndefined();
      expect(body.idempotencyKey).toBeUndefined();
      if (fail) { await route.abort(); return; }
      await new Promise((resolve) => setTimeout(resolve, 200));
      stored = body.page_metadata_definition; revision++;
    }
    await route.fulfill({ json: request.url().includes('?') ? { retCode: '0', total: 1, page_metadata_list: [response()] } : response() });
  });
  await manual.goto(`${root}/?page=manual-page`);
  const inspector = manual.getByRole('complementary', { name: '检查器' });
  await inspector.getByRole('button', { name: /原标题/ }).click();
  await inspector.getByLabel('组件标题').fill('手工改名');
  await inspector.getByLabel('组件标题').press('Tab');
  await manual.getByRole('button', { name: '保存新修订', exact: true }).click();
  await expect(manual.getByRole('button', { name: '保存中…' })).toBeDisabled();
  await expect(manual.getByText('已保存修订 R2')).toBeVisible(); expect(writes).toBe(1);
  await manual.getByRole('button', { name: '精确修订预览' }).click();
  await expect(manual.getByLabel('精确修订预览 r2').getByText('手工改名')).toBeVisible();
  await manual.screenshot({ path: '/private/tmp/metriccanvas-s1-evidence/t02-preview.png' });
  await manual.getByRole('button', { name: '精确修订预览' }).click();
  await inspector.getByLabel('组件标题').fill('离线保留'); await inspector.getByLabel('组件标题').press('Tab');
  fail = true;
  await manual.getByRole('button', { name: '保存新修订', exact: true }).click();
  await expect(manual.getByText(/保存结果未确定，已暂停再次保存/)).toBeVisible();
  await expect(manual.getByRole('button', { name: '保存新修订', exact: true })).toBeDisabled();
  await expect(manual.getByRole('main', { name: '页面画布', exact: true }).getByText('离线保留')).toBeVisible();
  expect(writes).toBe(2);
  await manual.screenshot({ path: '/private/tmp/metriccanvas-s1-evidence/t02-unknown.png' });
  await manual.goto(`${root}/manage/pages/manual-page`);
  await expect(manual.getByText(/尚未开放历史修订读取/)).toBeVisible();
  await manual.close();
  console.log('T02 browser PASS: open legacy, manual edit, one PUT, exact preview, unknown blocks resend/preserves local, history unavailable.');
  expect(errors).toEqual([]);
  console.log('T01 browser PASS: standalone, embedded, failure/invalid/late preservation, shell, SDK v1→v2, destroy.');
} finally { await browser.close(); }
