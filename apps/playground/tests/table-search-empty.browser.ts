import { expect, test } from '@playwright/test';

test('table search shows an empty state and recovers after clearing', async ({ page }) => {
  await page.goto('/pages/table-search-options-demo');
  for (const id of ['local-table', 'query-table', 'legacy-table']) {
    const table = page.locator(`[data-component="main/${id}"]`);
    const search = table.getByRole('searchbox');
    await expect(table.getByRole('cell', { name: '星河项目', exact: true })).toBeVisible();
    await search.fill('不存在的项目');
    await search.press('Enter');
    await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
    await expect(table.locator('thead')).toBeVisible();
    await expect(search).toHaveValue('不存在的项目');
    await table.getByRole('button', { name: '清空表格搜索' }).click();
    await expect(table.getByText('暂无数据', { exact: true })).toHaveCount(0);
    await expect(table.getByRole('cell', { name: '星河项目', exact: true })).toBeVisible();
  }
});

test('empty search keeps the independent summary and shows no-data feedback', async ({ page }) => {
  await page.goto('/pages/table-pinned-summary');
  const table = page.locator('[data-component="main/regional-table"]');
  await expect(table.locator('[data-pinned-top]')).toContainText('中国区');
  await table.getByRole('searchbox').fill('region-missing');
  await table.getByRole('searchbox').press('Enter');
  await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
  await expect(table.locator('[data-pinned-top]')).toContainText('中国区');
  await expect(table.locator('thead')).toBeVisible();
  await table.getByRole('button', { name: '清空表格搜索' }).click();
  await expect(table.getByText('暂无数据', { exact: true })).toHaveCount(0);
  await expect(table.getByRole('cell', { name: '华东地区部', exact: true })).toBeVisible();
});
