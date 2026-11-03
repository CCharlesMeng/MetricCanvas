import { expect, test } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import webpack from 'webpack';

async function compileConsumer(root: string, mode: 'development' | 'production') {
  const compiler = webpack({
    context: root,
    mode,
    target: 'web',
    entry: './entry.js',
    devtool: false,
    // The integrating application's aggregate asset budget is outside the embed budget.
    performance: false,
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

for (const mode of ['development', 'production'] as const) {
  test(`copied ESM supports Webpack 5 ${mode}, mounting and lazy Excel export`, async ({ page }) => {
    test.setTimeout(120_000);
    const root = await mkdtemp(resolve(tmpdir(), 'metriccanvas-webpack-'));
    try {
      // Reproduce a local src/ copy without inheriting this repository's ESM package scope.
      await writeFile(resolve(root, 'package.json'), '{"private":true}');
      await cp(new URL('../../dist/', import.meta.url), resolve(root, 'metricCanvas'), { recursive: true });
      await writeFile(resolve(root, 'entry.js'),
        'import * as runtime from "./metricCanvas/metriccanvas-runtime.es.js"; window.rebundledMetricCanvas = runtime;');
      await compileConsumer(root, mode);

      const errors: string[] = [];
      const requests: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(new URL(request.url()).pathname));
      await page.route('**/webpack-consumer/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        const output = resolve(root, 'output');
        const file = resolve(output, pathname.slice('/webpack-consumer/'.length));
        if (!file.startsWith(output + sep)) return route.fulfill({ status: 404 });
        await route.fulfill({ body: await readFile(file), contentType: 'text/javascript; charset=utf-8' });
      });
      await page.route('**/webpack-host', route => route.fulfill({
        contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><div id="dashboard"></div>'
      }));
      await page.goto('/webpack-host');
      await page.addScriptTag({ url: '/webpack-consumer/app.js' });
      expect(errors).toEqual([]);
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
      await page.evaluate(() => window.runtime.destroy());
      await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
