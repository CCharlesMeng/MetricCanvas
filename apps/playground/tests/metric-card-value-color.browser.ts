import { expect, test } from '@playwright/test';

test('colors only configured primary values and stacks primary-detail changes by default', async ({ page }) => {
  await page.goto('/pages/metric-card-value-color');
  const card = (id: string) => page.locator(`[data-component="metrics/${id}"]`);
  await expect(card('gain').locator('.row-value')).toHaveCSS('color', 'rgb(82, 196, 26)');
  await expect(card('loss').locator('.row-value')).toHaveCSS('color', 'rgb(245, 34, 45)');

  for (const id of ['flat', 'missing', 'default']) {
    await expect(card(id).locator('.row-value')).toHaveCSS('color', 'rgb(15, 26, 77)');
  }

  const changes = card('gain').locator('.changes');
  await expect(changes).toHaveCSS('flex-direction', 'column');
  await expect(changes.locator('.change-label')).toHaveText(['同比', '环比']);
  for (const label of await changes.locator('.change-label').all()) {
    await expect(label).toHaveCSS('color', 'rgb(113, 113, 122)');
  }
});
