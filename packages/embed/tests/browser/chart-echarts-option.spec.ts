import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const route = '/pages/chart-echarts-option-page';
const line = '[data-component="charts/lines"]';
const host = `${line} .echart`;

/** Test-only canvas fault injection: product code has no fault switch or page-id branch. */
async function failText(page: import('@playwright/test').Page, target: 'screen' | 'export', always = false) {
  await page.addInitScript(({ target, always }) => {
    let failures = 0;
    const instrument = (view: Window & typeof globalThis) => {
      const original = view.CanvasRenderingContext2D.prototype.fillText;
      view.CanvasRenderingContext2D.prototype.fillText = function(text: string, x: number, y: number, maxWidth?: number) {
        const selected = this.canvas.closest(target === 'screen' ? '[data-component="charts/lines"]' : '[data-export-component="lines"]');
        if (selected && (always || String(text).includes('件')) && (always || failures === 0)) {
          failures++;
          throw Error('test canvas failure: extension label');
        }
        if (maxWidth === undefined) original.call(this, text, x, y);
        else original.call(this, text, x, y, maxWidth);
      };
    };
    instrument(window);
    const create = Document.prototype.createElement;
    Document.prototype.createElement = function(name: string, options?: ElementCreationOptions) {
      const element = create.call(this, name, options);
      if (name.toLowerCase() === 'iframe') element.addEventListener('load', () => {
        const view = (element as HTMLIFrameElement).contentWindow;
        if (view) instrument(view as Window & typeof globalThis);
      }, { once: true });
      return element;
    };
  }, { target, always });
}

for (const width of [1440, 390]) test(`${width}: complete scene renders three extensions and preserves an editable document`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 1100 });
  await page.goto(route);
  await expect(page.locator('.echart[data-chart-render-mode="extended"]')).toHaveCount(3);
  await expect(page.locator('.echart canvas')).toHaveCount(3);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`chart-options-${width}.png`), fullPage: true });
  await page.evaluate(() => {
    const document = structuredClone((window as any).pageDocument);
    delete document.sections[0].components[2].props.echartsOption;
    (window as any).runtime.update({ document });
  });
  await expect(page.locator(host)).toHaveAttribute('data-chart-render-mode', 'base');
  await expect(page.locator('.echart[data-chart-render-mode="extended"]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('a drawing failure falls back once, retains config, and resize never retries the extension', async ({ page }) => {
  const warnings: string[] = [], errors: string[] = [];
  page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await failText(page, 'screen');
  await page.goto(route);
  await expect(page.locator(host)).toHaveAttribute('data-chart-render-mode', 'degraded');
  await expect(page.locator(`${host} canvas`)).toHaveCount(1);
  await expect(page.locator(line)).toContainText('显式覆盖平滑与标签');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.setViewportSize({ width: 1200, height: 1000 });
  await expect(page.locator(host)).toHaveAttribute('data-chart-render-mode', 'degraded');
  expect(warnings.filter(message => message.includes('CHART_OPTION_DEGRADED'))).toHaveLength(1);
  const retained = await page.evaluate(() => !!(window as any).pageDocument.sections[0].components[2].props.echartsOption);
  expect(retained).toBe(true);
  await page.evaluate(() => {
    const document = structuredClone((window as any).pageDocument);
    document.dataSources.sales.source.rows[0].actual = 30;
    (window as any).runtime.update({ document });
  });
  await expect(page.locator(host)).toHaveAttribute('data-chart-render-mode', 'extended');
  expect(errors).toEqual([]);
});

test('a failed base render leaves its title and empty drawing box, with diagnostics only in console', async ({ page }) => {
  const errors: string[] = [], messages: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => messages.push(message.text()));
  await failText(page, 'screen', true);
  await page.goto(route);
  await expect(page.locator(host)).toHaveAttribute('data-chart-render-mode', 'failed');
  await expect(page.locator(`${host} canvas`)).toHaveCount(0);
  await expect(page.locator(line)).toContainText('显式覆盖平滑与标签');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('图表绘制失败', { exact: true })).toHaveCount(0);
  expect(messages.some(message => message.includes('CHART_RENDER_FAILED'))).toBe(true);
  expect(errors).toEqual([]);
});

test('protected payload is rejected with a structured invalid event and console, without page error text', async ({ page }) => {
  const messages: string[] = []; page.on('console', message => messages.push(message.text()));
  await page.route('**/pages/chart-echarts-option-page.json', async request => {
    const response = await request.fetch();
    const document = await response.json();
    document.sections[0].components[1].props.echartsOption.series[0].data = [999];
    await request.fulfill({ response, json: document });
  });
  await page.goto(route);
  await expect.poll(() => messages.some(message => message.includes('CHART_OPTION_INVALID'))).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByText('页面文档未通过校验')).toHaveCount(0);
  const invalid = await page.evaluate(() => (window as any).queryEvents.find((event: any) => event.type === 'invalid'));
  expect(invalid.errors).toContainEqual(expect.objectContaining({ type: 'CHART_OPTION_ERROR', path: '/sections/0/components/1/props/echartsOption/series/0/data' }));
});

for (const format of ['PDF', '图片']) test(`static ${format} degradation aborts download and restores buttons without page diagnostics`, async ({ page }) => {
  test.setTimeout(60_000);
  const messages: string[] = [], errors: string[] = []; let downloads = 0;
  page.on('console', message => messages.push(message.text()));
  page.on('pageerror', error => errors.push(error.message));
  page.on('download', () => downloads++);
  await failText(page, 'export');
  await page.goto(route);
  const button = page.getByRole('button', { name: `下载 ${format}`, exact: true });
  const selected = format === 'PDF' ? button : page.getByRole('button', { name: '下载图片', exact: true });
  await expect(page.locator(host)).toHaveAttribute('data-chart-render-mode', 'extended');
  await selected.click();
  await expect.poll(() => messages.some(message => message.includes('REPORT_EXPORT_FAILED'))).toBe(true);
  await expect(selected).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('[data-report-export-frame]')).toHaveCount(0);
  expect(downloads).toBe(0);
  expect(errors).toEqual([]);
});

test('normal scene downloads PDF and PNG with all custom charts', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(route);
  for (const [name, magic] of [['下载 PDF', '%PDF'], ['下载图片', 'PNG']] as const) {
    const ready = page.waitForEvent('download', { timeout: 90_000 });
    await page.getByRole('button', { name, exact: true }).click();
    const download = await ready;
    const bytes = await readFile((await download.path())!);
    expect(magic === 'PNG' ? bytes.subarray(1, 4).toString() : bytes.subarray(0, 4).toString()).toBe(magic);
  }
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('layout-stage failure also recovers once and reports its actual stage', async ({ page }) => {
  const details: unknown[] = [];
  page.on('console', async message => {
    if (message.type() === 'warning' && message.text().includes('CHART_OPTION_DEGRADED')) details.push(await message.args()[1]?.jsonValue());
  });
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.measureText;
    CanvasRenderingContext2D.prototype.measureText = function(text) {
      if (text === 'layout-fault') throw Error('test layout measurement failure');
      return original.call(this, text);
    };
  });
  await page.route('**/pages/chart-echarts-option-page.json', async request => {
    const response = await request.fetch(); const document = await response.json();
    document.sections[0].components[2].props.echartsOption.xAxis = { name: 'layout-fault' };
    await request.fulfill({ response, json: document });
  });
  await page.goto(route);
  await expect(page.locator(host)).toHaveAttribute('data-chart-render-mode', 'degraded');
  await expect.poll(() => details).toContainEqual(expect.objectContaining({ stage: 'layout', componentId: 'lines', path: '/sections/0/components/2/props/echartsOption' }));
  await expect(page.getByRole('alert')).toHaveCount(0);
});
