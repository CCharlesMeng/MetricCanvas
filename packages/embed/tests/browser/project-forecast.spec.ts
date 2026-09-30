import { expect, test } from '@playwright/test';

for (const width of [1280, 375]) {
  test(`项目详情全年预测在${width}px可横向访问12月`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/pages/ioc-project-detail');
    const table = page.locator('[data-component="sales-forecast/sales-forecast-table"]');
    await expect(table).toBeVisible();
    const monthHeaders = table.locator('thead th[colspan="3"]');
    await expect(monthHeaders).toHaveText(Array.from({ length: 12 }, (_, i) => `${i + 1}月`));
    await expect(table.locator('thead th[data-column-field]')).toHaveCount(38);
    const december = table.locator('thead th[data-column-field="total-forecast-dec"]');
    await december.scrollIntoViewIfNeeded();
    await expect(december).toBeInViewport();
    const scroll = table.locator('.scroll');
    expect(await scroll.evaluate(node => node.scrollWidth > node.clientWidth && getComputedStyle(node).overflowX === 'auto')).toBe(true);
    await expect(table.locator('tbody')).toContainText('合计');
  });
}
