import { expect, test } from '@playwright/test';

test('table search shows an empty state and recovers after clearing', async ({ page }) => {
  await page.goto('/pages/table-search-options-demo');
  for (const id of ['local-table', 'query-table', 'legacy-table']) {
    const table = page.locator(`[data-component="main/${id}"]`);
    const search = table.getByRole('searchbox');
    await expect(table.getByRole('cell', { name: '星河项目', exact: true })).toBeVisible();
    await search.fill('不存在的项目');
    await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
    await expect(table.locator('thead')).toBeVisible();
    await expect(search).toHaveValue('不存在的项目');
    await table.getByRole('button', { name: '清空表格搜索' }).click();
    await expect(table.getByText('暂无数据', { exact: true })).toHaveCount(0);
    await expect(table.getByRole('cell', { name: '星河项目', exact: true })).toBeVisible();
  }
});

test('rapid typing in a query table sends a single DQE search for the final term', async ({ page }) => {
  const terms: string[] = [];
  page.on('request', request => {
    if (!request.url().endsWith('/dsl/execute') || request.method() !== 'POST') return;
    const items = request.postDataJSON().dsl_list as {filter?: {dims?: {dim_name: string; operator?: string; dim_value_list: string[]}[]}}[];
    for (const item of items) {
      const search = item.filter?.dims?.find(dim => dim.dim_name === 'search_demo_name' && dim.operator === 'contains');
      if (search) terms.push(...search.dim_value_list);
    }
  });
  await page.goto('/pages/table-search-options-demo');
  const table = page.locator('[data-component="main/query-table"]');
  await expect(table.getByRole('cell', { name: '星河项目', exact: true })).toBeVisible();
  const search = table.getByRole('searchbox');
  await search.fill('星');
  await search.fill('星河');
  await search.fill('星河项目二期');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.getByRole('cell', { name: '星河项目二期', exact: true })).toBeVisible();
  expect(terms).toEqual(['星河项目二期']);
});

test('empty search keeps the independent summary and shows no-data feedback', async ({ page }) => {
  await page.goto('/pages/table-pinned-summary');
  const table = page.locator('[data-component="main/regional-table"]');
  await expect(table.locator('[data-pinned-top]')).toContainText('中国区');
  await table.getByRole('searchbox').fill('region-missing');
  await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
  await expect(table.locator('[data-pinned-top]')).toContainText('中国区');
  await expect(table.locator('thead')).toBeVisible();
  await table.getByRole('button', { name: '清空表格搜索' }).click();
  await expect(table.getByText('暂无数据', { exact: true })).toHaveCount(0);
  await expect(table.getByRole('cell', { name: '华东地区部', exact: true })).toBeVisible();
});
