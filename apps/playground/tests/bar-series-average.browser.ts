import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/sdt-period-aggregation.json', import.meta.url), 'utf8'));
const chartId = fixture.sections[0].components.find((component: { id: string }) => component.id === 'efficiency-average-chart').id;
const selector = `[data-component="efficiency/${chartId}"]`;
const chartRuntime = `/@fs${fileURLToPath(new URL('../../../packages/engine/widgets/src/shared/echarts-runtime.ts', import.meta.url))}`;

declare global {
  interface Window { __pairedAveragePaints: Array<{ text: string; x: number; y: number }> }
}
async function hoverOffice(page: Page, office: string) {
  const chart = page.locator(selector), canvas = chart.locator('canvas').first();
  await expect(canvas).toBeVisible();
  await expect.poll(() => page.evaluate(name => window.__pairedAveragePaints.some(paint => paint.text === name), office)).toBe(true);
  const x = await page.evaluate(async ({ selector, url, office }) => {
    const runtime = await import(url);
    const instance = runtime.getInstanceByDom(document.querySelector(`${selector} [_echarts_instance_]`));
    const index = instance.getOption().xAxis[0].data.indexOf(office);
    return instance.convertToPixel({ xAxisIndex: 0 }, index);
  }, { selector, url: chartRuntime, office });
  await canvas.hover({ position: { x, y: (await canvas.boundingBox())!.height / 2 } });
  await expect(chart.getByText(office, { exact: true })).toBeVisible();
}
async function expectPair(page: Page, office: string, current: number | null, mean: number) {
  await hoverOffice(page, office);
  const chart = page.locator(selector);
  await expect(chart.getByText('当前值（次）', { exact: true })).toBeVisible();
  await expect(chart.getByText('均值（次）', { exact: true })).toBeVisible();
  for (const value of [current, mean]) {
    const text = value === null ? '--' : `${value} 次`;
    await expect(chart.getByText(text, { exact: true })).toBeVisible();
  }
}
async function toggleMeanLegend(page: Page) {
  const canvas = page.locator(selector).locator('canvas').first();
  const point = await page.evaluate(() => window.__pairedAveragePaints.filter(paint => paint.text === '均值（次）').at(-1)!);
  await canvas.click({ position: { x: point.x + 12, y: point.y } });
}

test('every office pairs its current bar with the same frontend mean', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__pairedAveragePaints = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      if (this.canvas.closest('[data-component="efficiency/efficiency-average-chart"]')) {
        const transform = this.getTransform(), ratio = this.canvas.width / this.canvas.getBoundingClientRect().width;
        window.__pairedAveragePaints.push({ text: args[0],
          x: (transform.a * args[1] + transform.c * args[2] + transform.e) / ratio,
          y: (transform.b * args[1] + transform.d * args[2] + transform.f) / ratio });
      }
      return fillText.apply(this, args);
    };
  });
  await page.clock.install({ time: new Date('2026-11-09T04:00:00Z') });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`/pages/${fixture.id}`);
  await expectPair(page, '合成代表处甲', 120, 90);
  await expectPair(page, '合成代表处乙', 60, 90);
  await expectPair(page, '合成代表处丙', null, 90);
  await toggleMeanLegend(page);
  await hoverOffice(page, '合成代表处甲');
  await expect(page.locator(selector).getByText('均值（次）', { exact: true })).toHaveCount(0);
  await toggleMeanLegend(page);
  await expectPair(page, '合成代表处甲', 120, 90);
  const chart = page.locator(selector), table = page.locator('[data-component="efficiency/efficiency-table"]');
  await page.mouse.move(0, 0);
  await table.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expectPair(page, '合成代表处乙', 60, 90);
  await page.getByRole('button', { name: '月', exact: true }).click();
  await expectPair(page, '合成代表处甲', 10, 7.5);
  await expectPair(page, '合成代表处乙', 5, 7.5);
  await page.getByRole('button', { name: '近一年', exact: true }).click();
  await expectPair(page, '合成代表处甲', 120, 90);
  await page.clock.runFor(1500);
  await page.mouse.move(0, 0);
  await chart.screenshot({ path: '/tmp/chart-paired-average-wide.png' });
  await page.evaluate(() => { window.__pairedAveragePaints = []; });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectPair(page, '合成代表处乙', 60, 90);
  await page.clock.runFor(1500);
  await page.mouse.move(0, 0);
  await chart.screenshot({ path: '/tmp/chart-paired-average-narrow.png' });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`/pages/${fixture.id}?state=missing`);
  await expectPair(page, '合成代表处乙', 55, 87.5);
  await page.goto(`/pages/${fixture.id}?state=truncated`);
  await expect(table.getByRole('columnheader', { name: '代表处', exact: true })).toBeVisible();
  await expect(table).not.toContainText('合成代表处甲');
  await expect(chart.locator('.chart-semantics')).not.toContainText('合成代表处甲');
  expect(errors).toEqual([]);
});
