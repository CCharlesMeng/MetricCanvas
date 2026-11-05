import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/pages/table-pagination-popovers');
  await expect(page.locator('.table-widget tbody tr')).toHaveCount(1, { timeout: 15_000 });
});

test('page size remains available after sixteen pages become one', async ({ page }) => {
  const table = page.locator('.table-widget');
  await table.getByLabel('每页 1 条', { exact: true }).click();
  await table.getByRole('option', { name: '20', exact: true }).click();
  await expect(table.locator('tbody tr')).toHaveCount(16);
  await expect(table.getByLabel('每页 20 条', { exact: true })).toBeVisible();
  await table.getByLabel('每页 20 条', { exact: true }).click();
  await table.getByRole('option', { name: '10', exact: true }).click();
  await expect(table.locator('tbody tr')).toHaveCount(10);
  await expect(table.getByLabel('每页 10 条', { exact: true })).toBeVisible();
});

for (const edge of ['start', 'end'] as const) {
  test(`page size menu flips at viewport ${edge}`, async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 480 });
    const trigger = page.getByLabel('每页 1 条', { exact: true });
    await page.locator('body').evaluate(body => {
      body.style.paddingTop = '100vh';
      body.style.paddingBottom = '100vh';
    });
    await trigger.evaluate((element, block) => element.scrollIntoView({ block }), edge);
    await trigger.click();
    const menu = page.getByRole('listbox', { name: '每页显示数量' });
    await expect(menu).toBeVisible();
    await expect.poll(async () => {
      const rect = await menu.boundingBox();
      return !!rect && rect.y >= 7 && rect.y + rect.height <= 473;
    }).toBe(true);
    const anchor = (await trigger.boundingBox())!;
    const panel = (await menu.boundingBox())!;
    if (edge === 'start') expect(panel.y).toBeGreaterThanOrEqual(anchor.y + anchor.height);
    else expect(panel.y + panel.height).toBeLessThanOrEqual(anchor.y);
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
}
