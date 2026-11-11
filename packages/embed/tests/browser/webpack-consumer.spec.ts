import { expect, test, type Page } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import webpack from 'webpack';
import MinimizerPlugin from 'minimizer-webpack-plugin';
import { build } from 'vite';
import config from '../../vite.config';

async function buildImageProbe(root: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><metadata>${'x'.repeat(65_536)}</metadata><rect width="16" height="16" fill="blue"/></svg>`;
  await writeFile(resolve(root, 'large.svg'), svg);
  await writeFile(resolve(root, 'image-entry.js'), 'export { default as image } from "./large.svg?url";');
  await build({
    ...config,
    configFile: false,
    logLevel: 'silent',
    build: {
      ...config.build,
      outDir: resolve(root, 'image-probe'),
      reportCompressedSize: false,
      lib: { ...config.build!.lib as object, entry: resolve(root, 'image-entry.js') }
    }
  });
}

async function compileConsumer(root: string, mode: 'development' | 'production', parseUrls: boolean, pureGetters = false) {
  const compiler = webpack({
    context: root,
    mode,
    target: 'web',
    entry: './entry.js',
    devtool: false,
    module: { parser: { javascript: { url: parseUrls } } },
    // The integrating application's aggregate asset budget is outside the embed budget.
    performance: false,
    optimization: pureGetters ? { minimizer: [new MinimizerPlugin({
      minify: MinimizerPlugin.terserMinify,
      minimizerOptions: { compress: { pure_getters: true } }
    })] } : undefined,
    output: { path: resolve(root, 'output'), filename: 'app.js', publicPath: '/webpack-consumer/' }
  });
  try {
    const stats = await promisify(compiler.run.bind(compiler))();
    if (!stats) throw new Error('Webpack did not return compilation statistics');
    const result = stats.toJson({ all: false, errors: true, warnings: true });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  } finally {
    await promisify(compiler.close.bind(compiler))();
  }
}

async function openConsumer(page: Page, root: string) {
  await page.route('**/webpack-consumer/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const output = resolve(root, 'output');
    const file = resolve(output, pathname.slice('/webpack-consumer/'.length));
    if (!file.startsWith(output + sep)) return route.fulfill({ status: 404 });
    await route.fulfill({ path: file });
  });
  await page.route('**/webpack-host', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><div id="dashboard"></div>'
  }));
  await page.goto('/webpack-host');
  await page.addScriptTag({ url: '/webpack-consumer/app.js' });
}

const scenarios = [
  { mode: 'development', parseUrls: true },
  { mode: 'production', parseUrls: true },
  { mode: 'development', parseUrls: false },
  { mode: 'production', parseUrls: false }
] as const;

for (const { mode, parseUrls } of scenarios) {
  test(`copied ESM supports Webpack 5 ${mode}, URL assets ${parseUrls}, mounting and lazy Excel export`, async ({ page }) => {
    test.setTimeout(120_000);
    const root = await mkdtemp(resolve(tmpdir(), 'metriccanvas-webpack-'));
    try {
      // Reproduce a local src/ copy without inheriting this repository's ESM package scope.
      await writeFile(resolve(root, 'package.json'), '{"private":true}');
      await cp(new URL('../../dist/', import.meta.url), resolve(root, 'metricCanvas'), { recursive: true });
      await buildImageProbe(root);
      await writeFile(resolve(root, 'entry.js'), [
        'import * as runtime from "./metricCanvas/metriccanvas-runtime.es.js";',
        'import { image } from "./image-probe/metriccanvas-runtime.es.js";',
        'window.rebundledMetricCanvas = runtime;',
        'const probe = document.createElement("img"); probe.dataset.largeImageProbe = ""; probe.src = image; document.body.append(probe);'
      ].join('\n'));
      await compileConsumer(root, mode, parseUrls);

      const errors: string[] = [];
      const requests: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(new URL(request.url()).pathname));
      await openConsumer(page, root);
      expect(errors).toEqual([]);
      await expect.poll(() => page.locator('img[data-large-image-probe]').evaluate(node => {
        const image = node as HTMLImageElement;
        return image.complete && image.naturalWidth === 16 && image.currentSrc.startsWith('data:image/svg+xml;');
      })).toBe(true);
      const document = JSON.parse(await readFile(new URL('../../../page/fixtures/contract-valid/table-toolbar-page.json', import.meta.url), 'utf8'));
      await page.evaluate(document => {
        window.runtime = window.rebundledMetricCanvas.mount('#dashboard', { document });
      }, document);
      await expect(page.getByRole('cell', { name: '客户1', exact: true })).toBeVisible();
      const loadedBeforeExport = requests.length;
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: '导出', exact: true }).click();
      const file = await downloaded;
      expect(file.suggestedFilename()).toBe('客户明细.xlsx');
      expect(await file.failure()).toBeNull();
      const bytes = await readFile((await file.path())!);
      expect(bytes.subarray(0, 2).toString()).toBe('PK');
      expect(requests.slice(loadedBeforeExport).some(path => path.startsWith('/webpack-consumer/'))).toBe(true);
      await page.evaluate(() => window.runtime.update({ document: {
        schemaVersion: '6.11', layout: 'dashboard', id: 'webpack-images', dataSources: {},
        sections: [{ id: 'main', components: [{
          id: 'title', type: 'reportHeader', layout: { span: 12 },
          props: { title: 'Webpack images', decoration: 'shortBar', generatedBy: 'AI', subtitle: 'Built-in image URL regression' }
        }] }]
      } }));
      const images = page.locator('img[data-decorative-image], img[data-decorative-icon]');
      await expect(page.locator('img[data-decorative-icon="section-title-left"]')).toHaveCount(1);
      await expect(images).toHaveCount(4);
      await expect.poll(() => images.evaluateAll(nodes => nodes.every(node => {
        const image = node as HTMLImageElement;
        return image.complete && image.naturalWidth > 0 && image.currentSrc.startsWith('data:image/');
      }))).toBe(true);
      await page.evaluate(() => window.runtime.destroy());
      await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

declare global {
  interface Window {
    webpackChildProbe: { calls: number; release(fail?: boolean): void };
  }
}

async function mountDeferredChildren(page: Page) {
  const document = JSON.parse(await readFile(new URL('../../../../pages/capabilities/table/table-row-expansion-query.json', import.meta.url), 'utf8'));
  await page.evaluate(document => {
    const pending: Array<(fail: boolean) => void> = [];
    window.webpackChildProbe = { calls: 0, release(fail = false) { pending.shift()!(fail); } };
    window.runtime = window.rebundledMetricCanvas.mount('#dashboard', { document, dataGateway: {
      async fetchData(query) {
        window.webpackChildProbe.calls++;
        const predicate = query.filterValues.find(value => value.target === 'dimension' && value.queryField === 'row_customer');
        if (predicate?.target !== 'dimension') throw Error('Missing parent binding');
        const id = String(predicate.values[0]);
        const offset = query.pagination!.offset, limit = query.pagination!.limit;
        const rows = Array.from({ length: Math.min(limit, 25 - offset) }, (_, index) => ({
          'customer-id': id, 'order-id': `${id}-${String(offset + index + 1).padStart(3, '0')}`, product: '合成订单', amount: 100
        }));
        return new Promise((resolve, reject) => pending.push(fail => {
          if (fail) reject(Error('temporary child failure'));
          else resolve({ rows, totalCount: 25 });
        }));
      }
    } });
  }, document);
}

test('Webpack 5 pure_getters compression preserves async child updates without folding', async ({ page }) => {
  test.setTimeout(120_000);
  const root = await mkdtemp(resolve(tmpdir(), 'metriccanvas-webpack-child-'));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await writeFile(resolve(root, 'package.json'), '{"private":true}');
    await cp(new URL('../../dist/', import.meta.url), resolve(root, 'metricCanvas'), { recursive: true });
    await writeFile(resolve(root, 'entry.js'), 'import * as runtime from "./metricCanvas/metriccanvas-runtime.es.js"; window.rebundledMetricCanvas = runtime;');
    await compileConsumer(root, 'production', true, true);
    await openConsumer(page, root);
    await mountDeferredChildren(page);
    const parent = page.locator('article[data-component-type="table"]').first();
    const toggle = parent.getByRole('button', { name: /^(展开|收起)子表格$/ }).first();
    const child = parent.getByRole('region', { name: '子表格', exact: true });
    await toggle.click();
    await expect(child.getByText('正在加载…', { exact: true })).toBeVisible();
    await page.evaluate(() => window.webpackChildProbe.release());
    await expect(child.getByRole('cell', { name: 'C01-001', exact: true })).toBeVisible();
    await expect(child.getByText('正在加载…', { exact: true })).toHaveCount(0);
    await child.getByRole('button', { name: '下一页', exact: true }).click();
    await expect(child.getByText('正在加载…', { exact: true })).toBeVisible();
    await page.evaluate(() => window.webpackChildProbe.release());
    await expect(child.getByRole('cell', { name: 'C01-011', exact: true })).toBeVisible();
    await toggle.click();
    await toggle.click();
    await expect(child.getByRole('cell', { name: 'C01-011', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.webpackChildProbe.calls)).toBe(2);
    await child.getByRole('button', { name: '下一页', exact: true }).click();
    await page.evaluate(() => window.webpackChildProbe.release(true));
    await expect(child.getByText('明细暂不可用')).toBeVisible();
    await child.getByRole('button', { name: '重试', exact: true }).click();
    await page.evaluate(() => window.webpackChildProbe.release());
    await expect(child.getByRole('cell', { name: 'C01-021', exact: true })).toBeVisible();
    await child.getByLabel('每页 10 条', { exact: true }).click();
    await child.getByRole('option', { name: '20', exact: true }).click();
    await expect(child.getByText('正在加载…', { exact: true })).toBeVisible();
    await toggle.click();
    await expect(child).toHaveCount(0);
    await page.evaluate(() => window.webpackChildProbe.release());
    await expect(child).toHaveCount(0);
    await toggle.click();
    await expect(child.getByText('正在加载…', { exact: true })).toBeVisible();
    await page.evaluate(() => window.webpackChildProbe.release());
    await expect(child.getByRole('cell', { name: 'C01-001', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.webpackChildProbe.calls)).toBe(6);
    await page.evaluate(() => window.runtime.destroy());
    await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
