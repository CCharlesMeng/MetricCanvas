import { expect, test, type Page } from '@playwright/test';

type QueryItem = { output_dims?: string[]; output_metrics?: string[]; filter?: { dims?: Array<{ dim_name: string; dim_value_list: string[] }> } };
const search = 'mtime=month%3A2026-11&sdt-duration-site=国内&sdt-count-site=国内&biz-decision-site=国内&contract-decision-site=国内';
const filters = ['sdt-duration-site', 'sdt-count-site', 'biz-decision-site', 'contract-decision-site'];

async function responses(page: Page, state: 'ready' | 'empty' | 'error') {
  const items: QueryItem[] = [];
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const queries: QueryItem[] = route.request().postDataJSON().dsl_list;
    items.push(...queries);
    await route.fulfill({ json: { retCode: 'CBC.0000', results: queries.map(query => response(query, state)) } });
  });
  return items;
}

function response(query: QueryItem, state: 'ready' | 'empty' | 'error') {
  if (!query.output_metrics?.length) return { code: 'SUCCESS', data: ['全球', '海外地区部', '巴黎代表处'].map(value => Object.fromEntries((query.output_dims ?? []).map(field => [field, value]))), total_count: 3 };
  return {
    code: state === 'error' ? 'NO_PERMISSION' : 'SUCCESS',
    data: state === 'ready' ? [Object.fromEntries([
      ...(query.output_dims ?? []).map(field => [field, '合成代表处']),
      ...(query.output_metrics ?? []).map(field => [field, 0.5])
    ])] : [], total_count: state === 'ready' ? 1 : 0
  };
}

for (const state of ['ready', 'empty', 'error'] as const) test(`global URL retains four independent chart filters with ${state} data`, async ({ page }, info) => {
  const items = await responses(page, state);
  await page.goto(`/pages/governance-compliance?${search}&region-dept=全球`);
  for (const id of filters) {
    const group = page.locator(`[data-filter-group="${id}"]`);
    await expect(group.getByRole('button', { name: '中国区', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(group.getByRole('button', { name: '海外', exact: true })).toBeVisible();
  }
  await expect.poll(() => items.filter(query => query.output_metrics?.length).length).toBeGreaterThanOrEqual(6);
  const table = page.locator('[data-component$="/rep-office-norms-table"]');
  await expect(table.getByText(state === 'ready' ? '合成代表处' : '暂无数据', { exact: true })).toBeVisible();
  const group = page.locator('[data-filter-group="biz-decision-site"]');
  await group.getByRole('button', { name: '海外', exact: true }).click();
  await expect(group.getByRole('button', { name: '海外', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-filter-group="sdt-duration-site"]').getByRole('button', { name: '中国区', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/biz-decision-site=%E6%B5%B7%E5%A4%96/);
  await page.reload();
  await expect(group.getByRole('button', { name: '海外', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath(`global-${state}.png`), fullPage: true });
});

test('specific department and office URLs hide controls and omit site predicates', async ({ page }) => {
  const items = await responses(page, 'ready');
  for (const region of ['region-dept=海外地区部', 'rep-office=巴黎代表处']) {
    const before = items.length;
    await page.goto(`/pages/governance-compliance?${search}&${region}`);
    await expect.poll(() => items.slice(before).filter(query => query.output_metrics?.length).length).toBeGreaterThanOrEqual(6);
    await expect(page.locator('[data-filter-group]')).toHaveCount(0);
    for (const query of items.slice(before).filter(query => query.output_metrics?.length)) {
      expect(query.filter?.dims?.some(dim => dim.dim_name === '国内或海外')).toBe(false);
    }
  }
});
