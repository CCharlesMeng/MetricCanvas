import { expect, test, type Page } from '@playwright/test';
import { chooseTree, closeSelection, openSelection } from '../../../packages/embed/tests/browser/selection-actions';

type QueryReceipt = { filterValues: Array<{ queryField: string; values: string[] }> };
const target = '/pages/ioc-region-url-demo';
const tableRows = (page: Page) => page.locator('.runtime-view tbody tr');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const calls: QueryReceipt[] = [];
    Object.assign(window, { regionURLCalls: calls });
    window.addEventListener('metriccanvas:synthetic-region-url', event => calls.push((event as CustomEvent<QueryReceipt>).detail));
  });
});

for (const scenario of [
  { search: 'region-dept=中国地区部', field: 'demo_region', value: '中国地区部', rows: 2 },
  { search: 'rep-office=上海代表处', field: 'demo_office', value: '上海代表处', rows: 1 },
  { search: 'region-dept=中国地区部&rep-office=上海代表处', field: 'demo_office', value: '上海代表处', rows: 1 },
  { search: 'rep-office=上海代表处&region-dept=中国地区部', field: 'demo_region', value: '中国地区部', rows: 2 },
  { search: 'rep-office=北京代表处&rep-office=上海代表处', field: 'demo_office', value: '上海代表处', rows: 1 },
  { search: 'region=上海代表处', field: 'demo_office', value: '上海代表处', rows: 1 },
  { search: 'region=欧洲地区部', field: 'demo_region', value: '欧洲地区部', rows: 1 },
  { search: 'region=上海代表处&region.level=office', field: 'demo_office', value: '上海代表处', rows: 1 },
  { search: '', field: 'demo_region', value: '中国地区部', rows: 2 }
]) {
  test(`URL 恢复与查询绑定：${scenario.search || '页面默认值'}`, async ({ page }) => {
    await page.goto(`${target}?${scenario.search}`);
    await expect(tableRows(page)).toHaveCount(scenario.rows);
    await expect(page.locator('[data-filter-id="region"]')).toContainText(scenario.value);
    const calls = await page.evaluate(() => (window as typeof window & { regionURLCalls: QueryReceipt[] }).regionURLCalls);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(query => query.filterValues.some(value => value.queryField === scenario.field && value.values[0] === scenario.value))).toBe(true);
    if (scenario.search === 'region=上海代表处') {
      await expect(page).toHaveURL(/\?rep-office=/);
      expect(new URL(page.url()).searchParams.get('rep-office')).toBe('上海代表处');
    }
  });
}

test('同树改选清理旧键与未声明参数，刷新恢复同一查询', async ({ page }, info) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(`${target}?keep=保留&region=中国地区部&region.level=region-dept&rep-office=上海代表处`);
  await expect(tableRows(page)).toHaveCount(1);
  const region = page.locator('[data-filter-id="region"]');
  await chooseTree(region, '欧洲地区部');
  await closeSelection(region);
  await expect(tableRows(page)).toHaveCount(1);
  await expect(tableRows(page)).toContainText('法国代表处');
  expect([...new URL(page.url()).searchParams]).toEqual([['region-dept', '欧洲地区部']]);
  await chooseTree(region, '上海代表处');
  await closeSelection(region);
  await expect(tableRows(page)).toContainText('上海代表处');
  expect([...new URL(page.url()).searchParams]).toEqual([['rep-office', '上海代表处']]);
  await page.reload();
  await expect(tableRows(page)).toContainText('上海代表处');
  await page.screenshot({ path: info.outputPath('region-url-chinese.png'), fullPage: true });
  await openSelection(region);
  await region.getByRole('button', { name: '清空Region', exact: true }).click();
  await closeSelection(region);
  await expect(tableRows(page)).toHaveCount(3);
  expect([...new URL(page.url()).searchParams]).toEqual([['region.level', 'office']]);
  await page.reload();
  await expect(tableRows(page)).toHaveCount(3);
  expect(failures).toEqual([]);
});

for (const scenario of [
  { value: 'SAME', message: 'URL 指定的区域匹配多个层级，请显式指定区域层级' },
  { value: '未授权代表处', message: 'URL 指定的区域不在当前授权候选中' },
  { value: '同码代表处', message: 'URL 指定的区域不在当前授权候选中' },
]) {
  test(`不明确的裸 region 保留原输入并阻断查询：${scenario.value}`, async ({ page }) => {
    await page.goto(`${target}?region=${encodeURIComponent(scenario.value)}`);
    await expect(page.getByRole('alert')).toHaveText(scenario.message);
    expect(new URL(page.url()).searchParams.get('region')).toBe(scenario.value);
    expect(await page.evaluate(() => (window as typeof window & { regionURLCalls: QueryReceipt[] }).regionURLCalls)).toEqual([]);
    const region = page.locator('[data-filter-id="region"]');
    await chooseTree(region, '上海代表处');
    await closeSelection(region);
    await expect(tableRows(page)).toContainText('上海代表处');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('最后空值被拒绝，未知候选阻断业务查询及导出', async ({ page }) => {
  const warnings:string[]=[];page.on('console',message=>{if(message.type()==='warning')warnings.push(message.text());});
  await page.goto(`${target}?region-dept=中国地区部&rep-office=`);
  await expect(page.getByText('目标筛选输入为空：region', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { regionURLCalls: QueryReceipt[] }).regionURLCalls)).toEqual([]);
  await page.goto(`${target}?rep-office=未授权代表处`);
  await expect(page.locator('[data-ioc-header]')).not.toContainText('等待筛选确认');
  await expect.poll(()=>warnings.join('\n')).toContain('等待筛选确认');
  await expect(page.getByRole('button', { name: '导出', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => (window as typeof window & { regionURLCalls: QueryReceipt[] }).regionURLCalls)).toEqual([]);
});

test('业务结果页等待完整 Region 候选，再按代表处和期间读取云服务候选', async ({ page }) => {
  const values: Record<string, string> = {
    'geo-pc-code': '全球', 'region-dept-code': '华东地区部', 'rep-office-code': '安徽代表处'
  };
  const candidateDimensions = new Set<string>();
  const cloudQueries: Array<{ dims: Array<{ dim_name: string; dim_value_list: string[] }>; time: { start: string; end: string } }> = [];
  let releaseGeo: () => void = () => {};
  const geo = new Promise<void>(resolve => { releaseGeo = resolve; });
  let businessQueryCount = 0;
  await page.addInitScript(() => Object.assign(window, { __METRICCANVAS__: {
    dqeEndpoint: '/synthetic-business-result-dqe', pageMetadataBaseUrl: '/pages', authToken: 'synthetic', operatorId: 'synthetic', workspaceId: 'synthetic'
  } }));
  await page.route('**/synthetic-business-result-dqe', async route => {
    const { dsl_list: items } = route.request().postDataJSON();
    const results = await Promise.all(items.map(async (item: { output_dims: string[]; output_metrics: string[]; filter: typeof cloudQueries[number] }) => {
      const dimension = item.output_dims[0]!;
      let data: Array<Record<string, string>> = [];
      if (Object.hasOwn(values, dimension)) {
        candidateDimensions.add(dimension);
        if (dimension === 'geo-pc-code') await geo;
        data = [{ [dimension]: values[dimension]! }];
      } else if (dimension === '云服务' && item.output_metrics.length === 0) {
        cloudQueries.push(item.filter);
        data = [{ 云服务: '示例云服务' }];
      } else {
        businessQueryCount++;
      }
      return { code: 'SUCCESS', data, total_count: data.length };
    }));
    await route.fulfill({ json: { retCode: 'CBC.0000', results } });
  });
  try {
    await page.goto('/pages/business-result-metrics?mtime=month:2026-10&region=安徽代表处');
    await expect.poll(() => candidateDimensions.size).toBe(3);
    await expect(page.locator('[data-ioc-header]')).toBeVisible();
    expect(cloudQueries).toEqual([]);
    expect(businessQueryCount).toBe(0);
    expect(new URL(page.url()).searchParams.get('region')).toBe('安徽代表处');
  } finally {
    releaseGeo();
  }
  await expect.poll(() => cloudQueries[0]).toMatchObject({
    dims: [{ dim_name: '代表处', dim_value_list: ['安徽代表处'] }],
    time: { start: '2026-10', end: '2026-10' }
  });
  await expect(page).toHaveURL(/rep-office=/);
  expect(new URL(page.url()).searchParams.get('region')).toBeNull();
});
