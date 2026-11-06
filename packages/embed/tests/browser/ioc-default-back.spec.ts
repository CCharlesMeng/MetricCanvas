import { expect, test } from '@playwright/test';

const source = '/pages/ioc-default-back-source';
const target = '/pages/ioc-default-back-target';

test('explicit IOC back returns through browser history and survives reload', async ({ page }) => {
  await page.goto(source + '?from=browser-test');
  await page.getByRole('link', { name: /^打开默认返回页/ }).click();
  await expect(page).toHaveURL(new RegExp(target));
  const back = page.locator('[data-ioc-header] [data-dashboard-back]');
  await expect(back).toBeVisible();
  await page.reload();
  await expect(back).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(new RegExp(source + '$'));
  await expect(page.locator('[data-dashboard-back]')).toHaveCount(0);
});

test('fresh direct entry has no default return; browser forward recomputes it', async ({ page }) => {
  await page.goto(target);
  await expect(page.getByRole('heading', { name: '默认返回：目标页' })).toBeVisible();
  await expect(page.locator('[data-dashboard-back]')).toHaveCount(0);
  await page.goto(source);
  await page.getByRole('link', { name: /^打开默认返回页/ }).click();
  await expect(page.locator('[data-dashboard-back]')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(source));
  await page.goForward();
  await expect(page.locator('[data-dashboard-back]')).toBeVisible();
});
