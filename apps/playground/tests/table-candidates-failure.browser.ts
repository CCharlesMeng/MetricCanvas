import { expect, test } from '@playwright/test';

test('keeps header candidates usable when a comparison supplement fails', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/pages/period-comparison-query-page?state=error');
  await expect.poll(() => errors.some(text => text.includes('合成去年同期补查失败'))).toBe(true);
  await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
  await expect(page.getByText('比较期数据加载或计算失败', { exact: false })).toHaveCount(0);
  const customers = page.locator('th[data-column-field="customer"]');
  await expect(customers.locator('summary')).toBeVisible();
  await customers.locator('summary').click();
  await expect(customers.getByRole('checkbox')).toHaveCount(23);
  await expect(page.locator('.table-widget').getByText('暂无数据', { exact: true })).toHaveCount(0);
  await expect(customers.getByRole('checkbox', { name: 'C000023', exact: true })).toBeVisible();
  await customers.getByRole('checkbox', { name: 'C000023', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
  await expect(customers.getByRole('checkbox', { name: 'C000023', exact: true })).toBeChecked();
  await expect(page.locator('tbody')).not.toContainText('C000023');
  await page.screenshot({ path: test.info().outputPath('failed-supplement-candidates.png'), fullPage: true });
});

test('recovers through a configured header filter without injected controls', async ({ page }) => {
  await page.goto('/pages/period-comparison-query-page?state=retry');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
  await expect(page.getByText('比较期数据加载或计算失败', { exact: false })).toHaveCount(0);
  const customers = page.locator('th[data-column-field="customer"]');
  await customers.locator('summary').click();
  await expect(customers.getByRole('checkbox')).toHaveCount(23);
  await customers.getByRole('checkbox', { name: 'C000023', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toContainText('C000023');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(1);
});
