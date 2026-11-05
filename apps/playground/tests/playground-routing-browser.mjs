import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PLAYGROUND_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-playground-route-check';
const source = await readFile(new URL('../../../pages/capabilities/navigation/playground-route-source.json', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
context.setDefaultTimeout(10000);
context.setDefaultNavigationTimeout(15000);
const page = await context.newPage();
const errors = [];
const remoteRequests = [];
context.on('page', tab => tab.on('pageerror', error => errors.push(error.message)));
page.on('pageerror', error => errors.push(error.message));
context.on('request', request => {
  if (new URL(request.url()).hostname === 'business.example') remoteRequests.push(request.url());
});
const facts = {};
async function openSource() {
  await page.goto(`${base}/pages/playground-route-source`);
  await expect(page.getByRole('link', { name: /^打开本地目标页/ }))
    .toHaveAttribute('href', '/pages/playground-route-target?region=north&region=south&project-id=P001#summary');
}
async function expectProject(tab, id) {
  await expect(tab.getByText(id, { exact: true })).toBeVisible();
  expect(new URL(tab.url()).pathname).toBe('/pages/playground-route-target');
  expect(new URL(tab.url()).searchParams.get('project-id')).toBe(id);
}
try {
  await mkdir(output, { recursive: true });
  await openSource();
  const link = page.getByRole('link', { name: /^打开本地目标页/ });
  const popupPromise = context.waitForEvent('page', { timeout: 10000 });
  await link.click({ button: 'middle' });
  const popup = await popupPromise;
  await expectProject(popup, 'P001');
  facts.nativeNewTab = true;
  await popup.close();
  await link.click();
  await expectProject(page, 'P001');
  expect(new URL(page.url()).searchParams.getAll('region')).toEqual(['north', 'south']);
  expect(new URL(page.url()).hash).toBe('#summary');
  await page.reload();
  await expectProject(page, 'P001');
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(page).toHaveURL(`${base}/pages/playground-route-source`);
  facts.regularClickReturnReload = true;
  const guarded = page.getByRole('link', { name: /^校验目标输入后打开/ });
  await expect(guarded).toHaveAttribute('href', '/pages/playground-route-target?project-id=P001');
  await guarded.click();
  await expectProject(page, 'P001');
  facts.targetInputContractUsesAutomaticRoute = true;
  await openSource();
  await page.getByRole('link', { name: /^绝对业务地址预览/ }).click();
  await expectProject(page, 'P002');
  facts.absoluteBusinessURL = true;
  await openSource();
  await page.getByRole('link', { name: /^查看未收录目标/ }).click();
  await expect(page.getByRole('heading', { name: '本地未收录该目标页', exact: true })).toBeVisible();
  const original = `${base}/operation-map/playground-route-unavailable?project-id=P003&region=north&region=south#summary`;
  await expect(page.locator('[data-target-href]')).toHaveText(original);
  await expect(page.locator('dd')).toHaveText(['P003', 'north', 'south']);
  await page.reload();
  await expect(page.locator('[data-target-href]')).toHaveText(original);
  await page.screenshot({ path: path.join(output, 'missing-target.png') });
  facts.missingTargetPreservesDetails = true;
  await page.goto(`${base}/preview`);
  await page.getByRole('textbox', { name: 'Page JSON 编辑器', exact: true }).fill(source);
  await expect(page.getByRole('link', { name: /^校验目标输入后打开/ }))
    .toHaveAttribute('href', '/pages/playground-route-target?project-id=P001');
  await expect(page.getByRole('textbox', { name: 'Page JSON 编辑器', exact: true })).toHaveValue(source);
  await page.screenshot({ path: path.join(output, 'preview.png') });
  await page.getByRole('link', { name: /^校验目标输入后打开/ }).click();
  await expectProject(page, 'P001');
  facts.jsonPreview = true;
  expect(remoteRequests).toEqual([]);
  expect(errors).toEqual([]);
  facts.noBusinessRequestsOrPageErrors = true;
  console.log(JSON.stringify(facts, null, 2));
  await writeFile(path.join(output, 'browser.json'), JSON.stringify({ facts, errors, remoteRequests }, null, 2));
} finally { await browser.close(); }
