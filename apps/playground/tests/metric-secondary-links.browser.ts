import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`secondary metric underlines follow clickable values at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/pages/metric-card-primary-detail');
    const runtime = page.locator('.runtime-view');
    const plain = runtime.locator('[data-component="edge-cases/detail-edge"] .metric-panel');
    await expect(plain.locator('.row-value')).toHaveCount(3);
    await expect(plain.locator('a, button')).toHaveCount(0);
    for (const value of await plain.locator('.row-value, .unit').all()) {
      await expect(value).toHaveCSS('text-decoration-line', 'none');
    }
    const linkedCard = runtime.locator('[data-component="edge-cases/detail-link"]');
    const links = linkedCard.locator('[data-metric-row-link]');
    await expect(links).toHaveCount(2);
    const missing = linkedCard.locator('.metric-row').filter({ hasText: '暂无数据（已配置链接）' });
    await expect(missing.locator('a, button')).toHaveCount(0);
    await expect(missing.locator('.row-value')).toHaveCSS('text-decoration-line', 'none');
    for (const value of await links.locator('.row-value, .unit').all()) {
      await expect(value).toHaveCSS('text-decoration-line', 'underline');
    }
    const link = links.first();
    await link.press('Enter');
    await expect(runtime.getByRole('dialog')).toBeVisible();
    await expect(runtime.getByRole('dialog')).toContainText('960');
    await page.keyboard.press('Escape');
    await expect(runtime.getByRole('dialog')).toHaveCount(0);
    await links.nth(1).click();
    await expect(runtime.getByRole('dialog')).toBeVisible();
  });
}
