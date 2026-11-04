import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/authoring/relay-multislot-presentation/relay-multislot-presentation.json', import.meta.url), 'utf8'));
declare global { interface Window { __authoringLabels: string[] } }

test('multislot keys align and Tokens chart labels and real tooltips preserve raw millions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__authoringLabels = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      window.__authoringLabels.push(args[0]);
      return original.apply(this, args);
    };
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`/pages/${fixture.id}`);
  const table = page.locator('[data-component="main/comparison"]');
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByRole('row').nth(1).getByRole('cell')).toHaveText(['a', '2.0百万', '—']);
  await expect(table.getByRole('row').nth(2).getByRole('cell')).toHaveText(['b', '3.0百万', '1.0百万']);
  const charts = page.locator('[_echarts_instance_]');
  await expect(charts).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => window.__authoringLabels)).toContain('2.0百万');
  await expect.poll(() => page.evaluate(() => window.__authoringLabels)).toContain('3.0百万');
  for (const chart of await charts.all()) {
    await chart.hover({ position: { x: 140, y: 100 } });
    await expect(chart.getByText('2.0百万', { exact: true })).toBeVisible();
  }
  await page.mouse.move(0, 0);
  await page.screenshot({ path: '/tmp/authoring-multislot-wide.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(table.getByRole('row').nth(2).getByRole('cell')).toHaveText(['b', '3.0百万', '1.0百万']);
  await page.screenshot({ path: '/tmp/authoring-multislot-narrow.png', fullPage: true });
  expect(errors).toEqual([]);
});
