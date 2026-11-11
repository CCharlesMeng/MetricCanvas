import { expect, test } from '@playwright/test';

test('local pagination uses numeric pages for omitted and false numbered values', async ({ page }) => {
  await page.goto('/pages/table-default-sort');
  const tables = page.locator('.table-widget');
  const descending = tables.nth(0);
  const ascending = tables.nth(1);
  for (const table of [descending, ascending]) {
    await expect(table.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(table.getByRole('button', { name: '2', exact: true })).toBeVisible();
    await expect(table.locator('.page-no')).toHaveCount(0);
  }
  await descending.getByRole('button', { name: '2', exact: true }).click();
  await expect(descending.locator('tbody tr')).toHaveCount(2);
  await expect(descending.locator('tbody tr').first()).toContainText('合成地区部02');
  await expect(ascending.locator('tbody tr')).toHaveCount(10);
  await descending.getByLabel('跳转页码').fill('1');
  await descending.getByLabel('跳转页码').press('Enter');
  await expect(descending.locator('tbody tr').first()).toContainText('合成地区部12');
  await ascending.getByRole('button', { name: '2', exact: true }).click();
  await expect(ascending.locator('tbody tr').first()).toContainText('合成地区部11');
  await descending.getByLabel('每页 10 条', { exact: true }).click();
  await descending.getByRole('option', { name: '20', exact: true }).click();
  await expect(descending.locator('tbody tr')).toHaveCount(12);
  await expect(descending.locator('.page-button')).toHaveCount(0);
  await expect(descending.getByLabel('每页 20 条', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('local-numbered.png'), fullPage: true });
});

test('legacy true, no pagination and empty results retain their controls', async ({ page }) => {
  await page.goto('/pages/table-row-number');
  const tables = page.locator('.table-widget');
  const paged = tables.nth(0);
  await paged.getByRole('button', { name: '2', exact: true }).click();
  await expect(paged.locator('tbody tr').first()).toContainText('客户11');
  await expect(paged.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(tables.nth(1).locator('.pager')).toHaveCount(0);
  const empty = tables.last();
  await expect(empty).toContainText('暂无数据');
  await expect(empty.locator('.page-button')).toHaveCount(0);
  await expect(empty.getByLabel('每页 10 条', { exact: true })).toBeVisible();
});

test('query pagination uses the same numeric controls and queries the next window', async ({ page }) => {
  await page.goto('/pages/paged-join-on-demand');
  const table = page.locator('.table-widget');
  await expect(table).toContainText('总条数： 80');
  await expect(table.locator('.ellipsis')).toHaveText('…');
  await table.getByRole('button', { name: '2', exact: true }).click();
  await expect(table.locator('tbody tr').first()).toContainText('P000011');
  await expect(table.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(table.locator('tbody tr')).toHaveCount(10);
  await expect(table.locator('.page-no')).toHaveCount(0);
});
