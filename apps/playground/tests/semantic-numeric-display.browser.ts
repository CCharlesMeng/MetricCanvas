import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');
const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/semantic-numeric-display.json', import.meta.url), 'utf8'));

test('semantic values react to the device while explicit SLO and headcount formats remain exact', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/pages/${fixture.id}`);
  const component = (id: string) => page.locator(`[data-component="rules/${id}"]`);
  for (const [id, expected] of [
    ['cny-card', '1.23万'], ['usd-card', '12.3K'], ['rate-card', '12.3%'],
    ['tiny-card', '0.001%'], ['limit-card', '>500%'], ['slo-card', '99.999%'],
    ['users-card', '1.2万户'], ['people-card', '12,345'], ['resource-card', '1.23万核'],
    ['resource-tb-card', '1.23万TB'], ['storage-card', '1 TB'], ['bandwidth-card', '1 Gb/s'],
    ['minutes-card', '1.23千分钟'], ['messages-card', '1.23万条'], ['billing-card', '1.02小时'],
    ['missing-card', '—']
  ]) await expect(component(id!).locator('.row-value')).toHaveText(expected!);
  await expect(component('cny-card').locator('.unit')).toHaveCount(0);
  await expect(component('slo-card').locator('.unit')).toHaveCount(0);
  await expect(component('people-card').locator('.unit')).toHaveText('个');
  await expect(component('rate-card').locator('.change-value')).toHaveText('+12.3%');
  await expect(component('rate-card').locator('.trend-arrow')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/semantic-numeric-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(component('cny-card').locator('.row-value')).toHaveText('1.2万');
  await expect(component('slo-card').locator('.row-value')).toHaveText('99.999%');
  await expect(component('limit-card').locator('.row-value')).toHaveText('>500%');
  await expect(component('people-card').locator('.row-value')).toHaveText('12,345');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/semantic-numeric-mobile.png', fullPage: true });
});

test('growth uses original baselines, preserves the table and exposes the declared export', async ({ page }) => {
  await page.goto(`/pages/${fixture.id}`);
  const table = page.locator('[data-component="rules/growth-table"]');
  await expect(table.locator('tbody td[data-column-field="growth"]')).toHaveText([
    '+12.3%', '—', '—', '—', '+500%', '-50%', '>500%', '<-500%'
  ]);
  await expect(table.locator('.cell-trend-arrow')).toHaveCount(0);
  const downloaded = page.waitForEvent('download');
  await table.getByRole('button', { name: '导出', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('数值呈现规则.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await download.path())!);
  const sheet = workbook.worksheets[0];
  expect(sheet.getCell('D8').value).toBe(650);
  expect(sheet.getCell('D8').numFmt).toBe('">500%"');
  expect(sheet.getCell('D9').value).toBe(-650);
  expect(sheet.getCell('D9').numFmt).toBe('"<-500%"');
});

test('chart canvas and hover keep physical units and use the em dash placeholder', async ({ page }) => {
  await page.addInitScript(() => {
    const samples: string[] = [];
    (window as unknown as { numericLabels: string[] }).numericLabels = samples;
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) { samples.push(args[0]); return fill.apply(this, args); };
  });
  await page.goto(`/pages/${fixture.id}`);
  const labels = () => page.evaluate(() => (window as unknown as { numericLabels: string[] }).numericLabels);
  for (const text of ['1 TB', '2 TB', '甲: —', '乙: —']) await expect.poll(labels).toContain(text);
  const chart = page.locator('[data-component="rules/storage-chart"] [_echarts_instance_]');
  await chart.hover({ position: { x: 120, y: 100 } });
  await expect(chart.getByText('1 TB', { exact: true })).toBeVisible();
});

test('map tooltip applies the default limit to an explicit raw percent format', async ({ page }) => {
  await page.goto(`/pages/${fixture.id}`);
  const chart = page.locator('[data-component="rules/rate-map"] [_echarts_instance_]');
  await chart.scrollIntoViewIfNeeded();
  const runtime = '/@fs' + fileURLToPath(new URL('../../../packages/engine/widgets/src/shared/echarts-runtime.ts', import.meta.url));
  const [x, y] = await chart.evaluate(async (element, url) => {
    const echarts = await import(url);
    const instance = echarts.getInstanceByDom(element);
    const point = instance.getOption().series[1].data[0];
    return instance.convertToPixel({ geoIndex: 0 }, point.value.slice(0, 2)) as [number, number];
  }, runtime);
  await chart.hover({ position: { x, y } });
  await expect(chart.getByText('>500%', { exact: true })).toBeVisible();
});
