import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/chart/chart-number-format.json', import.meta.url), 'utf8'));

test('chart labels and real hover tooltips share the declared numeric format', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/pages/${fixture.id}`);
  const charts = page.locator('[_echarts_instance_]');
  await expect(charts).toHaveCount(fixture.sections[0].components.length);
  const expected = ['12345.68', '12345.68', '1.2万', '12345.6789', '12345.68', '12345.68', '12345.68', '12345.68'];
  for (let index = 0; index < expected.length; index++) {
    const chart = charts.nth(index);
    await chart.hover({ position: { x: 140, y: 100 } });
    await expect(chart.getByText(expected[index]!, { exact: true })).toBeVisible();
  }
  await charts.first().hover({ position: { x: 287, y: 100 } });
  await expect(charts.first().getByText('0.00', { exact: true })).toBeVisible();
  await charts.first().hover({ position: { x: 433, y: 100 } });
  await expect(charts.first().getByText('-2345.68', { exact: true })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: '/tmp/chart-number-format-wide.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/chart-number-format-narrow.png', fullPage: true });
  expect(errors).toEqual([]);
});

declare global {
  interface Window {
    __pieLabels: string[];
    __piePaints: Array<{ text: string; left: number; right: number; width: number }>;
  }
}

test('pie outer percentages use the common formatter on the actual canvas', async ({ page }) => {
  await page.addInitScript(() => {
    window.__pieLabels = [];
    window.__piePaints = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      window.__pieLabels.push(args[0]);
      const metrics = this.measureText(args[0]);
      const transform = this.getTransform();
      window.__piePaints.push({ text: args[0],
        left: transform.a * (args[1] - metrics.actualBoundingBoxLeft) + transform.c * args[2] + transform.e,
        right: transform.a * (args[1] + metrics.actualBoundingBoxRight) + transform.c * args[2] + transform.e,
        width: this.canvas.width });
      return fillText.apply(this, args);
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/pages/${fixture.id}`);
  await expect(page.locator('[_echarts_instance_]')).toHaveCount(fixture.sections[0].components.length);
  for (const label of ['甲: 1.2%', '乙: 98.8%', '零: 0.0%', '甲: —', '乙: —', '甲: 33.3%', '乙: 33.3%', '丙: 33.3%']) {
    await expect.poll(() => page.evaluate(() => window.__pieLabels)).toContain(label);
  }
  const legends = page.locator('[aria-label="表格式图例"]');
  await expect(legends.first().getByText('1.2%', { exact: true })).toBeVisible();
  await expect(legends.first().getByText('0.0%', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/pie-percentage-wide.png', fullPage: true });
  await page.evaluate(() => { window.__pieLabels = []; window.__piePaints = []; });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const label of ['甲: 1.2%', '乙: 98.8%', '零: 0.0%', '甲: —', '乙: —', '甲: 33.3%', '乙: 33.3%', '丙: 33.3%']) {
    await expect.poll(() => page.evaluate(() => window.__pieLabels)).toContain(label);
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const label of ['甲: —', '乙: —']) {
    await expect.poll(async () => {
      const paint = (await page.evaluate(() => window.__piePaints)).filter(paint => paint.text === label).at(-1);
      return paint !== undefined && paint.left >= 0 && paint.right <= paint.width;
    }).toBe(true);
  }
  await page.screenshot({ path: '/tmp/pie-percentage-narrow.png', fullPage: true });
});
