import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { chromium, expect } from '../../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const appRoot = resolve(repo, 'apps/platform');
const output = process.argv[2] ?? '/tmp/metriccanvas-chart-value-editor';
const sample = JSON.parse(await readFile(resolve(repo, 'pages/capabilities/chart/chart-constant-values-page.json'), 'utf8'));
process.chdir(appRoot);
const server = await createServer({root: appRoot, configFile: false, plugins: [svelte()],
  resolve: {alias: {$lib: resolve(appRoot, 'src/lib'), $pages: resolve(repo, 'pages'), $fixtures: resolve(repo, 'docs/examples')}},
  server: {host: '127.0.0.1', port: 0}});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({headless: true, channel: 'chrome'});
  const page = await browser.newPage({viewport: {width: 1600, height: 1100}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {window.__METRICCANVAS__ = {
    dqeEndpoint: '/fixture-dqe', pageMetadataBaseUrl: '/fixture-assets', authToken: 'fixture',
    operatorId: 'chart-user', workspaceId: 'chart-workspace'
  };});
  await page.route('**/fixture-assets/user-page-metadata**', async route => {
    const value = {retCode: '0', page_metadata_id: 'chart-resource', page_id: sample.id,
      revision_id: 'r1', revision_number: 1, page_metadata_definition: JSON.stringify(sample)};
    await route.fulfill({json: route.request().url().includes('?') ? {retCode: '0', page_metadata_list: [value], total: 1} : value});
  });
  await page.goto(`${server.resolvedUrls.local[0]}dialogue?page=${sample.id}`);
  await page.getByRole('checkbox', {name: '嵌入工作台'}).check();
  const cell = page.locator('[data-component="charts/line"]');
  await expect(cell.getByRole('heading', {name: '折线：实际值 + 固定 2'})).toBeVisible();
  await cell.getByRole('heading').click();
  const inspector = page.getByRole('complementary', {name: '检查器'});
  await inspector.getByRole('button', {name: '系列 1来源', exact: true}).click();
  await page.getByRole('option', {name: '常量', exact: true}).click();
  const value = inspector.getByRole('textbox', {name: '系列 1固定值', exact: true});
  await expect(value).toHaveValue('0');
  await page.getByRole('button', {name: '撤销上一步', exact: true}).click();
  await expect(inspector.getByRole('textbox', {name: '系列 1字段', exact: true})).toHaveValue('actual');
  await inspector.getByRole('button', {name: '系列 1来源', exact: true}).click();
  await page.getByRole('option', {name: '常量', exact: true}).click();
  await expect(value).toHaveValue('0');
  await value.fill('2'); await value.press('Tab');
  await expect(value).toHaveValue('2');
  await page.getByRole('button', {name: '撤销上一步', exact: true}).click();
  await expect(value).toHaveValue('0');
  await inspector.getByRole('button', {name: '增加系列', exact: true}).click();
  await page.getByRole('option', {name: '常量', exact: true}).click();
  await expect(inspector.getByRole('textbox', {name: '系列 3固定值', exact: true})).toHaveValue('0');
  await mkdir(output, {recursive: true});
  await page.screenshot({path: resolve(output, 'editor.png'), fullPage: false});
  expect(errors).toEqual([]);
  const result = {status: 'pass', checks: ['field-to-constant switch', 'constant edit', 'existing single-step undo restores source and value edits independently', 'append constant series'], errors, data: 'synthetic page-asset fixture; no remote writes'};
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await server.close();
}
