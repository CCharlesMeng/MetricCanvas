import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

let copiedDist: string;
const publicPath = '/copied-project/static/metriccanvas/';
const runtimeExports = [
  'ExecutionError', 'ExportViewError', 'createDqeGateway', 'createLastFilterRecorder',
  'loadExecution', 'mount', 'prepareExecution', 'projectNavigationInputs', 'withOperationMapRegion'
];

test.beforeAll(async () => {
  copiedDist = await mkdtemp(resolve(tmpdir(), 'metriccanvas-embed-copy-'));
  await cp(new URL('../../dist/', import.meta.url), copiedDist, { recursive: true });
});

test.afterAll(async () => {
  await rm(copiedDist, { recursive: true, force: true });
});

async function serveCopiedDistribution(page: Page) {
  await page.route('**/copied-project/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const file = resolve(copiedDist, pathname.slice(publicPath.length));
    if (!pathname.startsWith(publicPath) || !file.startsWith(copiedDist + sep)) {
      await route.fulfill({ status: 404 });
      return;
    }
    await route.fulfill({ path: file });
  });
  await page.route('**/distribution-host', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><base href="/unrelated-base/"><div id="dashboard"></div>'
  }));
  await page.goto('/distribution-host');
}

test('copied ESM entry mounts synchronously and shares chunks with the global entry', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await serveCopiedDistribution(page);
  const exports = await page.evaluate(async (url) => {
    const runtime = await import(url);
    const document = {
      schemaVersion: '6.11', layout: 'dashboard', id: 'copied-distribution', dataSources: {},
      sections: [{ id: 'main', components: [{
        id: 'title', type: 'reportHeader', layout: { span: 12 },
        props: { title: 'Copied runtime', decoration: 'shortBar', generatedBy: 'AI' }
      }] }]
    };
    window.runtime = runtime.mount('#dashboard', { document });
    return Object.keys(runtime).sort();
  }, `${publicPath}metriccanvas-runtime.es.js`);
  expect(exports).toEqual(runtimeExports);
  await expect(page.getByRole('heading', { name: 'Copied runtime' }).first()).toBeVisible();
  await expectHeaderImages(page);
  const chunkRequests = requests.filter((path) => path.includes('/chunks/'));
  expect(chunkRequests.length).toBeGreaterThan(5);
  expect(chunkRequests.some((path) => /excel|china|world/.test(path))).toBe(false);

  await page.addScriptTag({ url: `${publicPath}metriccanvas-runtime.global.js` });
  expect(await page.evaluate(async (url) => {
    await MetricCanvas.ready;
    const esm = await import(url);
    return MetricCanvas.mount === esm.mount;
  }, `${publicPath}metriccanvas-runtime.es.js`)).toBe(true);
  expect(requests.filter((path) => path.includes('/chunks/') && !path.includes('/global-bridge-'))).toEqual(chunkRequests);
  await page.evaluate(() => { window.runtime.destroy(); window.runtime.destroy(); });
  await expect(page.locator('[data-metriccanvas-runtime]')).toHaveCount(0);
});

async function expectHeaderImages(page: Page) {
  const images = page.locator('img[data-decorative-image], img[data-decorative-icon]');
  await expect(images).toHaveCount(2);
  await expect.poll(() => images.evaluateAll(nodes => nodes.every(node => {
    const image = node as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.currentSrc.startsWith('data:image/');
  }))).toBe(true);
}

test('classic global entry resolves beside its own URL and exposes the same public API', async ({ page }) => {
  await serveCopiedDistribution(page);
  await page.addScriptTag({ url: `${publicPath}metriccanvas-runtime.global.js` });
  const exports = await page.evaluate(async () => {
    const runtime = await MetricCanvas.ready;
    return Object.keys(runtime).filter((key) => key !== 'ready').sort();
  });
  expect(exports).toEqual(runtimeExports);
  expect(await page.evaluate(async (url) => {
    const original = MetricCanvas;
    const script = document.createElement('script');
    script.src = url;
    const loaded = new Promise<void>((resolve) => { script.onload = () => resolve(); });
    document.head.append(script);
    await loaded;
    return MetricCanvas === original && MetricCanvas.ready === original.ready;
  }, `${publicPath}metriccanvas-runtime.global.js`)).toBe(true);
  await page.evaluate(() => {
    window.runtime = MetricCanvas.mount('#dashboard', { document: {
      schemaVersion: '6.11', layout: 'dashboard', id: 'global-images', dataSources: {},
      sections: [{ id: 'main', components: [{
        id: 'title', type: 'reportHeader', layout: { span: 12 },
        props: { title: 'Global images', decoration: 'shortBar', generatedBy: 'AI' }
      }] }]
    } });
  });
  await expectHeaderImages(page);
  await page.evaluate(() => window.runtime.destroy());
});

test('global ready rejects when a required chunk cannot be loaded', async ({ page }) => {
  await serveCopiedDistribution(page);
  await page.route('**/chunks/runtime~*.js', (route) => route.abort('failed'));
  const rejected = await page.evaluate(async (url) => {
    const script = document.createElement('script');
    script.src = url;
    const loaded = new Promise<void>((resolve) => { script.onload = () => resolve(); });
    document.head.append(script);
    await loaded;
    try {
      await MetricCanvas.ready;
      return false;
    } catch (error) {
      return error instanceof Error && error.message.includes('could not be loaded');
    }
  }, `${publicPath}metriccanvas-runtime.global.js`);
  expect(rejected).toBe(true);
});
