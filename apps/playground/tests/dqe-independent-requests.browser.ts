import { expect, test } from '@playwright/test';

test('later fast cards render while the first five independent queries are still pending', async ({ page }) => {
  await page.goto('/pages/dqe-independent-requests');
  const card = (id: number) => page.locator('.metric-card').filter({ hasText: `独立查询 ${String(id).padStart(2, '0')}` });
  await expect(card(15).locator('.row-value')).toHaveText('15', { timeout: 3000 });
  await expect(card(1).locator('.row-value')).toHaveText('--');
  await expect(card(1).locator('.row-value')).toHaveText('1', { timeout: 7000 });
  for (let id = 1; id <= 15; id++) await expect(card(id).locator('.row-value')).toHaveText(String(id));
});
