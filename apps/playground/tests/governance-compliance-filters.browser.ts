import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { prepareIocHeaderFilters } from '../../../packages/embed/examples/ioc-header-candidate-bridge';

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
  const office = query.filter?.dims?.find(dim => dim.dim_name === '代表处')?.dim_value_list.includes('合成重点代表处') ? '合成重点代表处' : '合成代表处';
  return {
    code: state === 'error' ? 'NO_PERMISSION' : 'SUCCESS',
    data: state === 'ready' ? [Object.fromEntries([
      ...(query.output_dims ?? []).map(field => [field, office]),
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

for (const regionName of ['全球', '海外地区部']) test(`legacy key-rep-only refreshes all queries and intersects ${regionName}`, async ({ page }) => {
  const document = JSON.parse(readFileSync('../../pages/temporary/governance-compliance-20261027/governance-compliance.json', 'utf8'));
  expect(document.filters[0].id).toBe('key-rep-only');
  const region = document.filters.find((filter: { id: string }) => filter.id === 'region');
  region.default = [regionName];
  region.defaultLevel = regionName === '全球' ? 'geo' : 'region-dept';
  // Synthetic authorized membership, supplied only at the integration boundary.
  const prepared = await prepareIocHeaderFilters(document, {
    async fetchData() { throw Error('Only the membership endpoint is used before mounting'); },
    async fetchFilterCandidates() { return { kind: 'values', candidates: [{ value: '合成重点代表处', label: '合成重点代表处' }] }; }
  }, { signal: new AbortController().signal });
  const expectedQueries = new Set<string>();
  for (const source of Object.values(prepared.dataSources)) {
    if (source.source.type !== 'query') continue;
    if (!source.source.query.body) throw Error('Expected an ordinary DQE query');
    for (const query of source.source.query.body.dsl_list) expectedQueries.add(querySignature(query));
    expect(source.source.query.filterBindings?.['key-rep-only']).toEqual({
      target: 'boolean', queryField: '代表处', whenTrue: ['合成重点代表处']
    });
  }
  const items = await responses(page, 'ready');
  const business = () => items.filter(query => expectedQueries.has(querySignature(query)));
  await page.goto('/preview');
  await page.getByRole('textbox', { name: 'Page JSON 编辑器' }).fill(JSON.stringify(prepared));
  await expect.poll(() => new Set(business().map(querySignature))).toEqual(expectedQueries);
  const table = page.locator('[data-component$="/rep-office-norms-table"]');
  await expect(table.getByText('合成代表处', { exact: true })).toBeVisible();
  const before = business().length;
  await page.getByRole('checkbox', { name: '仅看重点国代', exact: true }).check();
  await expect.poll(() => business().length).toBeGreaterThanOrEqual(before + 6);
  expect(new Set(business().slice(before).map(querySignature))).toEqual(expectedQueries);
  for (const query of business().slice(before)) {
    expect(query.filter?.dims).toContainEqual(expect.objectContaining({ dim_name: '代表处', dim_value_list: ['合成重点代表处'] }));
  }
  for (const query of business().slice(before)) {
    if (regionName === '海外地区部') expect(query.filter?.dims).toContainEqual(expect.objectContaining({ dim_name: '地区部', dim_value_list: [regionName] }));
    else expect(query.filter?.dims?.some(dim => dim.dim_name === '地区部')).toBe(false);
  }
  await expect(table.getByText('合成重点代表处', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: '仅看重点国代', exact: true }).uncheck();
  await expect(table.getByText('合成代表处', { exact: true })).toBeVisible();
});

function querySignature(query: QueryItem): string {
  return JSON.stringify([query.output_dims, query.output_metrics]);
}

async function numericAxes(chart: Locator) {
  return chart.evaluate(async element => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => /\/echarts-runtime\.ts(?:\?|$)/.test(name));
    if (!url) throw Error('ECharts module not loaded');
    const echarts = await import(url);
    const option = echarts.getInstanceByDom(element).getOption();
    return option.yAxis.map((axis: { name: string; nameLocation: string; nameRotate: number; axisLabel: { formatter: (value: number) => string } }) => ({
      name: axis.name, nameLocation: axis.nameLocation, nameRotate: axis.nameRotate, tick: axis.axisLabel.formatter(1.25)
    }));
  });
}

test('all four charts put units above both numeric axes without repeating them on ticks', async ({ page }, info) => {
  await responses(page, 'ready');
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  await page.goto(`/pages/governance-compliance?${search}&region-dept=全球`);
  for (const [id, units] of [
    ['sdt-duration-card', ['天', '天']],
    ['sdt-count-card', ['人', '人']],
    ['biz-decision-card', ['个', '%']],
    ['contract-decision-card', ['个', '%']]
  ] as const) {
    const chart = page.locator(`[data-component$="/${id}"] .echart`);
    await expect(chart).toHaveAttribute('_echarts_instance_', /.+/);
    const axes = await numericAxes(chart);
    expect(axes).toEqual(units.map(name => ({ name, nameLocation: 'end', nameRotate: 0, tick: expect.stringMatching(/^[+\-]?\d[\d,.eE+\-]*$/) })));
  }
  await page.screenshot({ path: info.outputPath('axis-top-units.png'), fullPage: true });
});
