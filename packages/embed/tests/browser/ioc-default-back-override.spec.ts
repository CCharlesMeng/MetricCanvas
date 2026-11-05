import { expect, test } from '@playwright/test';

test('custom callback without returnContext overrides browser history and update restores the default', async ({ page }) => {
  await page.goto('/pages/ioc-default-back-source');
  await page.getByRole('link', { name: /^打开默认返回页/ }).click();
  await expect(page.locator('[data-dashboard-back]')).toBeVisible();
  await page.evaluate(() => {
    window.runtime.update({ document: window.pageDocument, navigation: { back() {
      document.body.dataset.customBack = 'called';
    } } });
  });
  await page.locator('[data-dashboard-back]').click();
  await expect(page.locator('body')).toHaveAttribute('data-custom-back', 'called');
  await expect(page).toHaveURL(/ioc-default-back-target$/);
  await page.evaluate(() => window.runtime.update({ document: window.pageDocument }));
  await page.locator('[data-dashboard-back]').click();
  await expect(page).toHaveURL(/ioc-default-back-source$/);
});
