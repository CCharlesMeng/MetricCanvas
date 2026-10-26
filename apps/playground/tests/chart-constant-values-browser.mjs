import { chromium, expect } from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.CHART_VALUES_BASE_URL ?? 'http://127.0.0.1:5173';
const output = process.argv[2] ?? '/tmp/metriccanvas-chart-values';
const sample = JSON.parse(await readFile(new URL('../../../pages/capabilities/chart/chart-constant-values-page.json', import.meta.url), 'utf8'));
await mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true, channel: 'chrome'});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
const errors = [], requests = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.url().includes('/dsl/execute')) requests.push(request.url());
});
const component = id => page.locator(`[data-component="charts/${id}"]`);

async function drawnPixels(canvas) {
  return canvas.evaluate(node => {
    const bytes = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
    let count = 0;
    for (let i = 0; i < bytes.length; i += 16) {
      if (bytes[i + 3] > 0 && Math.min(bytes[i], bytes[i + 1], bytes[i + 2]) < 230) count++;
    }
    return count;
  });
}

try {
  await page.goto(`${base}/pages/${sample.id}`);
  await expect(component('gauge').locator('strong')).toHaveText('2');
  await expect(component('gauge-empty-default').locator('strong')).toHaveText('—');
  await expect(component('gauge-empty-show').locator('strong')).toHaveText('2');
  await expect(component('zero').locator('strong')).toHaveText('0');
  await expect(component('map-summary')).toContainText('固定目标');
  checks.push('standalone gauge, zero, successful-empty default/showConstants and map summary');
  for (const id of ['line', 'mixed', 'horizontal', 'stacked', 'area', 'pie', 'ring', 'map', 'map-summary', 'empty-line']) {
    const canvas = component(id).locator('canvas').first();
    await expect(canvas).toBeAttached();
    await expect.poll(() => drawnPixels(canvas)).toBeGreaterThan(10);
  }
  checks.push('all four chart types and existing variants draw in real Chrome');
  const canvas = component('line').locator('canvas').first();
  const box = await canvas.boundingBox();
  await canvas.hover({position: {x: box.width / 2, y: box.height / 2}});
  await expect(component('line')).toContainText('基线');
  await expect(component('line')).toContainText('2');
  checks.push('constant line participates in axis tooltip');
  await page.mouse.move(0, 0);
  await component('line').screenshot({path: path.join(output, 'baseline-line.png')});
  await page.screenshot({path: path.join(output, 'charts-1440.png'), fullPage: true});
  for (const width of [1024, 390]) {
    await page.setViewportSize({width, height: 900});
    await expect(component('gauge').locator('strong')).toHaveText('2');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: path.join(output, `charts-${width}.png`), fullPage: true});
  }
  await page.setViewportSize({width: 1440, height: 1000});
  await page.evaluate(async document => {
    const {mountPdfRuntimeFixture} = await import('/tests/report-pdf-runtime-fixture.ts');
    const target = window.document.createElement('div'); target.id = 'constant-export'; target.style.width = '1200px'; window.document.body.append(target);
    const included = new Set(['line', 'mixed', 'pie', 'map', 'gauge', 'gauge-empty-default', 'gauge-empty-show']);
    const report = {...document, layout: 'report', id: 'chart-constant-export', sections: [
      {id: 'cover', components: [{id: 'header', type: 'reportHeader', layout: {span: 12}, props: {title: '常量图表导出验证'}}]},
      {...document.sections[0], components: document.sections[0].components.filter(c => included.has(c.id))}
    ]};
    window.constantExport = mountPdfRuntimeFixture(target, report);
  }, sample);
  await expect(page.locator('#constant-export [data-component="charts/gauge"] strong')).toHaveText('2');
  const download = page.waitForEvent('download');
  const exported = await page.evaluate(async () => {
    let values;
    const facts = await window.constantExport.export(view => {
      const text = id => view.querySelector(`[data-component="charts/${id}"] strong`)?.textContent;
      values = {gauge: text('gauge'), empty: text('gauge-empty-default'), show: text('gauge-empty-show'), chartImages: view.querySelectorAll('.echart img').length};
    });
    return {facts, values};
  });
  await (await download).saveAs(path.join(output, 'constant-charts.pdf'));
  expect(exported.values).toMatchObject({gauge: '2', empty: '—', show: '2'});
  expect(exported.values.chartImages).toBeGreaterThanOrEqual(4);
  checks.push('actual PDF export renders constant charts and preserves captured empty-state values');
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  const result = {status: 'pass', base, checks, errors, requests, data: 'synthetic inline data; standalone constants; no real DQE'};
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
