import { expect, test, type Page } from '@playwright/test';

async function mockNormsResponses(page: Page, empty = false) {
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const queries = route.request().postDataJSON().dsl_list as { output_dims?: string[]; output_metrics?: string[] }[];
    await route.fulfill({ json: { retCode: 'CBC.0000', results: queries.map(query => ({
      code: 'SUCCESS', total_count: empty ? 0 : 1,
      data: empty ? [] : [Object.fromEntries([
        ...(query.output_dims ?? []).map(field => [field, '合成审批人']),
        ...(query.output_metrics ?? []).map(field => [field, 0.5])
      ])]
    })) } });
  });
  await page.goto('/pages/region-auth-norms-detail');
  const table = page.locator('[data-table-title="决策有效意见明细"]');
  return table;
}

test('decision opinion table shows no data after a successful empty gateway receipt', async ({ page }, info) => {
  const table = await mockNormsResponses(page, true);
  await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
  await expect(table.locator('thead')).toBeVisible();
  await expect(table).toContainText('总条数： 0');
  await page.screenshot({ path: info.outputPath('decision-search-empty.png'), fullPage: true });
});

test('failed search shows no data and clearing restores rows while diagnostics retain the error', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const table = await mockNormsResponses(page);
  await expect(table.getByRole('cell', { name: '合成审批人', exact: true }).first()).toBeVisible();
  await table.getByRole('searchbox').fill('不存在的审批人');
  await table.getByRole('searchbox').press('Enter');
  await expect.poll(() => errors.some(message => message.includes('DQE_CONFIG_ERROR') && message.includes('数据网关未配置全表文本搜索能力'))).toBe(true);
  await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
  await expect(table.getByRole('searchbox')).toHaveValue('不存在的审批人');
  await page.screenshot({ path: info.outputPath('decision-search-empty.png'), fullPage: true });
  await table.getByRole('button', { name: '清空表格搜索' }).click();
  await expect(table.getByRole('cell', { name: '合成审批人', exact: true })).toHaveCount(8);
});
