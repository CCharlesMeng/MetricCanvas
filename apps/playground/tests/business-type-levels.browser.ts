import { expect, test, type Locator } from '@playwright/test';

type Predicate = { dim_name: string; dim_value_list: string[]; is_exclude?: boolean };
type QueryItem = {
  output_dims: string[];
  output_metrics: string[];
  filter: { dims: Predicate[] };
  order?: { offset?: number; limit?: number };
};
const regionValues: Record<string, string> = {
  'geo-pc-code': '全球',
  'region-dept-code': '华东地区部',
  'rep-office-code': '上海代表处',
};

async function selectBusinessType(control: Locator, label: string, parent?: string) {
  const trigger = control.getByRole('button', { name: '业务类型', exact: true });
  await trigger.click();
  const tree = control.getByRole('tree');
  if (parent) await tree.getByRole('button', { name: `展开${parent}`, exact: true }).click();
  await tree.getByRole('button', { name: label, exact: true }).click();
  await expect(trigger).toHaveText(label);
}

function businessTypePredicates(request: QueryItem) {
  return request.filter.dims.filter(item => ['业务类型编码', '子业务类型编码'].includes(item.dim_name));
}

const longCloudService = '合成云服务22（跨区域智能网络与分布式数据治理企业级服务）';

function cloudServiceWindow(item: QueryItem) {
  const values = Array.from({length:25}, (_, index) => `合成云服务${String(index + 1).padStart(2, '0')}`);
  values[21] = longCloudService;
  const selection = item.filter.dims.find(predicate => predicate.dim_name === '云服务');
  const matches = selection ? values.filter(value => selection.dim_value_list.includes(value)) : values;
  const {offset=0,limit=matches.length} = item.order ?? {};
  return {code:'SUCCESS', data:matches.slice(offset,offset+limit).map(value=>({云服务:value,净付费金额:100})), total_count:matches.length};
}

test('业务类型按层下推并与分页的云服务排除一起作用', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 850 });
  const requests: QueryItem[] = [];
  const cloudPages: number[] = [];
  await page.addInitScript(() => Object.assign(window, { __METRICCANVAS__: {
    dqeEndpoint: '/synthetic-business-type-dqe', pageMetadataBaseUrl: '/pages',
    authToken: 'synthetic', operatorId: 'synthetic', workspaceId: 'synthetic'
  } }));
  await page.route('**/synthetic-business-type-dqe', async route => {
    const items: QueryItem[] = route.request().postDataJSON().dsl_list;
    const results = items.map(item => {
      const dimension = item.output_dims[0]!;
      const region = regionValues[dimension];
      if (region) return { code: 'SUCCESS', data: [{ [dimension]: region }], total_count: 1 };
      if (dimension === '云服务' && item.output_metrics.includes('净付费金额')) {
        expect(item.order?.limit).toBe(20);
        cloudPages.push(item.order!.offset!);
        return cloudServiceWindow(item);
      }
      if (item.output_metrics.some(metric => metric.startsWith('净商务折扣（原价）'))) requests.push(item);
      return { code: 'SUCCESS', data: [], total_count: 0 };
    });
    await route.fulfill({ json: { retCode: 'CBC.0000', results } });
  });
  await page.goto('/pages/business-result-metrics?mtime=last12Months&mtime.from=2025-11&mtime.to=2026-10&region=华东地区部');
  await expect(page).toHaveURL(/business-result-metrics.*region-dept=/);
  await expect.poll(() => requests.some(item => item.output_metrics.includes('净商务折扣（原价）'))).toBe(true);
  await expect.poll(() => cloudPages).toEqual([0]);
  const header = page.locator('[data-ioc-header]');
  const control = header.locator('[data-filter-id="business-type"]');
  await expect(page.locator('[data-filter-group="business-type"], [data-filter-group="cloud-service"]')).toHaveCount(0);
  const parent = '华为公有云CORE';
  const child = '公网REGION';

  await selectBusinessType(control, parent);
  await expect.poll(() => requests.some(request => businessTypePredicates(request).some(predicate =>
    predicate.dim_name === '业务类型编码' && predicate.dim_value_list.includes('SERVICE_TYPE_HUAWEI_PUBLIC_CLOUD_CORE')
  ))).toBe(true);

  requests.length = 0;
  await selectBusinessType(control, child, parent);
  const childPredicate = { dim_name: '子业务类型编码', dim_value_list: ['SUB_SERVICE_TYPE_PUBLIC_REGION'] };
  await expect.poll(() => requests.filter(request => businessTypePredicates(request).some(item => item.dim_name === childPredicate.dim_name))
    .map(request => ({ dimensions: request.output_dims, predicates: businessTypePredicates(request) }))).toEqual(expect.arrayContaining([
    { dimensions: ['代表处'], predicates: [childPredicate] },
    { dimensions: [], predicates: [childPredicate] },
  ]));
  expect(cloudPages).toEqual([0]);
  const restoredUrl = page.url();
  cloudPages.length = 0;
  await page.reload();
  await expect(control.getByRole('button', { name: '业务类型', exact: true })).toHaveText(child);
  await expect(page).toHaveURL(restoredUrl);

  requests.length = 0;
  await selectBusinessType(control, '全部业务类型');
  await expect.poll(() => requests.map(businessTypePredicates)).toContainEqual([]);

  await selectBusinessType(control, child, parent);
  const cloudControl = header.locator('[data-filter-id="cloud-service"]');
  await cloudControl.getByRole('button', { name: '云服务排除项', exact: true }).press('ArrowDown');
  const cloudPopup = cloudControl.getByRole('dialog', { name: '云服务排除项候选' });
  const list = cloudControl.getByRole('listbox');
  await expect(list.getByRole('option', { name: '合成云服务10', exact: true })).toBeVisible();
  const initialPopupWidth = (await cloudPopup.boundingBox())!.width;
  expect(initialPopupWidth).toBeGreaterThanOrEqual(160);
  expect(cloudPages).toEqual([0]);
  await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const choice = list.getByRole('option', { name: longCloudService, exact: true });
  await expect(choice).toBeVisible();
  expect(cloudPages).toEqual([0, 20]);
  await expect.poll(async () => (await cloudPopup.boundingBox())!.width).toBeGreaterThan(initialPopupWidth);
  const label = choice.getByText(longCloudService, { exact: true });
  await expect.poll(() => label.evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0);
  await choice.click();
  await expect.poll(() => requests.some(({filter}) =>
    filter.dims.some(predicate => predicate.dim_name === childPredicate.dim_name) &&
    filter.dims.some(predicate => predicate.dim_name === '云服务' && predicate.is_exclude && predicate.dim_value_list.includes(longCloudService))
  )).toBe(true);
});

test('独立示例支持搜索并恢复子层节点', async ({ page }) => {
  await page.goto('/pages/filter-source-candidate-levels');
  const control = page.locator('[data-filter-group="organization"]');
  const trigger = control.getByRole('button', { name: '组织', exact: true });
  await expect(trigger).toHaveText('北区');
  await trigger.click();
  await control.getByRole('textbox').fill('深圳');
  await control.getByRole('tree').getByRole('button', { name: '深圳', exact: true }).click();
  await expect(trigger).toHaveText('深圳');
  await expect(page).toHaveURL(/organization.level=office/);
  await page.reload();
  await expect(trigger).toHaveText('深圳');
});
