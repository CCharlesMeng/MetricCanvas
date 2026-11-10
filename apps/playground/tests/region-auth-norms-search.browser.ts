import { expect, test, type Page } from '@playwright/test';

interface NormsQuery {
  output_dims?: string[];
  output_metrics?: string[];
  filter?: { dims?: { dim_name: string; dim_value_list: string[] }[] };
}

async function mockNormsResponses(page: Page, empty = false) {
  const requests: NormsQuery[] = [];
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const queries: NormsQuery[] = route.request().postDataJSON().dsl_list;
    requests.push(...queries);
    await route.fulfill({ json: { retCode: 'CBC.0000', results: queries.map(query => {
      const nameFilter = query.filter?.dims?.find(filter => ['商务审批人', '审批人名称'].includes(filter.dim_name));
      const noMatch = empty || (nameFilter !== undefined && !nameFilter.dim_value_list.includes('合成审批人'));
      return {
        code: 'SUCCESS', total_count: noMatch ? 0 : 1,
        data: noMatch ? [] : [Object.fromEntries([
          ...(query.output_dims ?? []).map(field => [field, '合成审批人']),
          ...(query.output_metrics ?? []).map(field => [field, 0.5])
        ])]
      };
    }) } });
  });
  await page.goto('/pages/region-auth-norms-detail');
  const table = page.locator('[data-table-title="决策有效意见明细"]');
  return { table, requests };
}

test('decision opinion table shows no data after a successful empty gateway receipt', async ({ page }, info) => {
  const { table } = await mockNormsResponses(page, true);
  await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
  await expect(table.locator('thead')).toBeVisible();
  await expect(table).toContainText('总条数： 0');
  await page.screenshot({ path: info.outputPath('decision-search-empty.png'), fullPage: true });
});

for (const scenario of [
  { name: 'approver', tab: '决策意见明细', title: '决策有效意见明细', keyword: '不存在的审批人' },
  { name: 'reviewer', tab: '申请规范率明细', title: '评审组织人驳回情况统计', keyword: '不存在的评审组织人' }
]) {
  test(`exact ${scenario.name} search reaches both DQE members and clearing restores rows without a config error`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const { requests } = await mockNormsResponses(page);
    await page.getByRole('tab', { name: scenario.tab, exact: true }).click();
    const table = page.locator(`[data-table-title="${scenario.title}"]`);
    await expect(table.getByRole('button', { name: '表格搜索字段', exact: true })).toHaveCount(0);
    await expect(table.getByRole('cell', { name: '合成审批人', exact: true }).first()).toBeVisible();
    const beforeSearch = requests.length;
    await table.getByRole('searchbox').fill(scenario.keyword);
    await table.getByRole('searchbox').press('Enter');
    await expect.poll(() => requests.slice(beforeSearch).flatMap(query => query.filter?.dims ?? [])).toEqual(expect.arrayContaining([
      { dim_name: '商务审批人', dim_value_list: [scenario.keyword] },
      { dim_name: '审批人名称', dim_value_list: [scenario.keyword] }
    ]));
    await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
    await expect(table.getByRole('searchbox')).toHaveValue(scenario.keyword);
    expect(errors.some(message => message.includes('DQE_CONFIG_ERROR'))).toBe(false);
    await page.screenshot({ path: info.outputPath(`${scenario.name}-search-empty.png`), fullPage: true });
    await table.getByRole('button', { name: '清空表格搜索' }).click();
    await expect(table.getByRole('cell', { name: '合成审批人', exact: true }).first()).toBeVisible();
  });
}

test('multiple search dimensions still show the selector and changing it searches the selected field', async ({ page }) => {
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', route => route.fulfill({
    json: { retCode: 'CBC.0000', results: [{ code: 'SUCCESS', data: [], total_count: 0 }] }
  }));
  await page.goto('/pages/table-search-options-demo');
  const table = page.locator('[data-component="main/local-table"]');
  const selector = table.getByRole('button', { name: '表格搜索字段', exact: true });
  await expect(selector).toBeVisible();
  await table.getByRole('searchbox').fill('00123');
  await selector.click();
  await page.getByRole('option', { name: '项目编码', exact: true }).click();
  await expect(table.getByRole('searchbox')).toHaveAttribute('placeholder', '请输入完整项目编码');
  await expect(table.getByRole('cell', { name: '00123', exact: true })).toBeVisible();
  await expect(table.getByRole('cell', { name: '星河项目二期', exact: true })).toHaveCount(0);
});
