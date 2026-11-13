import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
const document = JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/table-absolute-display-limit.json', import.meta.url), 'utf8'));
for (const entry of ['global', 'esm'] as const) {
  test(`${entry}: distributed runtime displays the configured absolute limit with independent arrows and colors`, async ({ page }) => {
    await page.goto('/examples/inline.html');
    await page.waitForFunction(() => !!window.runtime);
    await page.evaluate(async ({ document, entry }) => {
      const modulePath = '/dist/metriccanvas-runtime.es.js';
      const api = entry === 'esm' ? await import(modulePath) : MetricCanvas;
      window.runtime.destroy();
      window.runtime = api.mount('#dashboard', { document });
    }, { document, entry });
    const table = page.locator('[data-component="main/limit-table"]');
    const cells = table.locator('tbody td[data-column-field="change"]');
    await expect(cells).toHaveText(['↑ > 500', '↓ > 500', '↑ +500', '↓ -500', '↑ > 500', '↓ > 500', '↑ +500', '↓ -500', '0', '--']);
    await expect(cells.nth(0)).toHaveCSS('color', 'rgb(82, 196, 26)');
    await expect(cells.nth(1)).toHaveCSS('color', 'rgb(245, 34, 45)');
    const download = page.waitForEvent('download');
    await table.getByRole('button', { name: '导出', exact: true }).click();
    expect((await download).suggestedFilename()).toBe('绝对值阈值.xlsx');
  });
}
