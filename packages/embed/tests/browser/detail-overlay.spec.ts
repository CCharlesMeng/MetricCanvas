import { test, expect } from '@playwright/test';

test('public mount opens detail above the integrating application sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/examples/detail-overlay.html');
  const trigger = page.getByRole('button', { name: '8', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
  expect((await dialog.boundingBox())!.width).toBeCloseTo(1296, 0);
  expect(await dialog.evaluate(element => element.getRootNode() instanceof ShadowRoot)).toBe(true);
  await expect(dialog).toContainText('SO-0901');
  await page.screenshot({ path: '../../.scratch/detail-overlay/modal.png' });
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains((element.getRootNode() as ShadowRoot).activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '关闭', exact: true })).toBeFocused();
  await page.mouse.click(40, 122);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#status')).toHaveText('侧栏点击：0');
  await expect(trigger).toBeFocused();
  await page.locator('#sidebar-action').click();
  await expect(page.locator('#status')).toHaveText('侧栏点击：1');
});

test('drawer, Escape, page updates and destroy release the document', async ({ page }) => {
  await page.goto('/examples/detail-overlay.html');
  const trigger = page.getByRole('button', { name: '3', exact: true });
  const dialog = page.getByRole('dialog');
  await trigger.click();
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
  const box = (await dialog.boundingBox())!;
  expect(box.x + box.width).toBeCloseTo(page.viewportSize()!.width, 0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.evaluate(() => window.runtime.update({ document: window.pageDocument }));
  await expect(dialog).toHaveCount(0);
  await trigger.click();
  await page.evaluate(() => window.runtime.destroy());
  await expect(dialog).toHaveCount(0);
  await page.locator('#sidebar-action').click();
  await expect(page.locator('#status')).toHaveText('侧栏点击：1');
});
