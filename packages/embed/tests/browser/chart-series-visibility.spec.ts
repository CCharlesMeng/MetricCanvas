import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const document = JSON.parse(readFileSync(new URL('../../../../pages/capabilities/chart/chart-series-visibility.json', import.meta.url), 'utf8'));

for (const entry of ['global', 'es']) {
  test(`${entry}: installed series conditions hide and restore the line and tooltip`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/examples/inline.html');
    await page.evaluate(async ({ document, entry }) => {
      window.runtime.destroy();
      const url = '/dist/metriccanvas-runtime.es.js';
      const runtime = entry === 'es' ? await import(url) : MetricCanvas;
      window.runtime = runtime.mount('#dashboard', { document, initialSearch: '' });
    }, { document, entry });
    const host = page.locator('[data-metriccanvas-runtime]');
    const mixed = host.locator('[data-component="charts/mixed"]');
    await expect(mixed.locator('.bar-chart')).toHaveAttribute('data-series-count', '3');
    const checkbox = host.getByRole('checkbox', { name: '显示达成率', exact: true });
    await checkbox.uncheck();
    await expect(mixed.locator('.bar-chart')).toHaveAttribute('data-series-count', '2');
    await expect(mixed.locator('.chart-semantics')).not.toContainText('达成率');
    await mixed.locator('.echart').hover({ position: { x: 150, y: 100 } });
    await expect(mixed.getByText('销售额', { exact: true })).toBeVisible();
    await expect(mixed.getByText('达成率', { exact: true })).toHaveCount(0);
    await checkbox.check();
    await expect(mixed.locator('.bar-chart')).toHaveAttribute('data-series-count', '3');
    await mixed.locator('.echart').hover({ position: { x: 150, y: 100 } });
    await expect(mixed.getByText('达成率', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
