import {expect, test, type Locator, type Page} from '@playwright/test';

interface ObjectQuery {
  output_fields?: string[];
  filter: {fields: Array<{field_name: string; value_list: string[]}>};
}

async function mockAuthorization(page: Page, count = 1) {
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const queries: ObjectQuery[] = route.request().postDataJSON().dsl_list;
    await route.fulfill({json: {retCode: 'CBC.0000', results: queries.map(query => {
      const fields = query.output_fields ?? [];
      const child = fields.includes('代表处');
      const rows = Array.from({length: child ? 1 : count}, (_, index) => ({
        '地区部': count === 1 ? '华东地区部' : `地区部${index + 1}`,
        '代表处': '江苏代表处', '地总是否向代表处授权': '是',
        '是否销售管理规定': '是', '是否转授权': '是', '是否有任命': '是'
      }));
      return {code: 'SUCCESS', total_count: rows.length, data: rows.map(row =>
        Object.fromEntries(fields.map(field => [field, row[field as keyof typeof row]])))};
    })}});
  });
}

async function assertExpandedContentFits(parent: Locator) {
  await expect.poll(() => parent.evaluate(root => {
    const scroll = root.querySelector<HTMLElement>('.table-widget > .scroll')!;
    const bounds = scroll.getBoundingClientRect();
    const expansions = [...root.querySelectorAll<HTMLElement>('.row-expansion-content')];
    return expansions.every(content => {
      const rect = content.getBoundingClientRect();
      return rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1;
    });
  })).toBe(true);
}

async function exportAndCheck(page: Page, parent: Locator) {
  const pending = page.waitForEvent('download');
  await parent.getByRole('button', {name: '导出', exact: true}).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  await expect(parent.getByRole('button', {name: '导出', exact: true})).toBeEnabled();
  await assertExpandedContentFits(parent);
}

for (const width of [1440, 1280, 800, 390]) {
  test(`single region and office stay visible after repeated export at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 800});
    await mockAuthorization(page);
    await page.goto('/pages/authorization-norms');
    const parent = page.locator('[data-component="region-dept-auth-norms/region-dept-auth-norms-table"]');
    await expect(parent.getByRole('cell', {name: '华东地区部', exact: true})).toBeVisible();
    await parent.getByRole('button', {name: '展开子表格', exact: true}).click();
    await expect(parent.getByRole('cell', {name: '江苏代表处', exact: true})).toBeVisible();
    await assertExpandedContentFits(parent);
    await exportAndCheck(page, parent);
    await exportAndCheck(page, parent);
    await expect(parent.getByRole('button', {name: '收起子表格', exact: true})).toHaveCount(1);
    await parent.getByRole('button', {name: '收起子表格', exact: true}).click();
    await expect(parent.getByRole('region', {name: '子表格', exact: true})).toHaveCount(0);
  });
}

test('more than twelve parents include multiple expanded children in viewport height', async ({page}) => {
  await mockAuthorization(page, 13);
  await page.goto('/pages/authorization-norms');
  const parent = page.locator('[data-component="region-dept-auth-norms/region-dept-auth-norms-table"]');
  await expect(parent.getByRole('cell', {name: '地区部1', exact: true})).toBeVisible();
  await parent.locator('.page-size-select summary').click();
  await parent.getByRole('option', {name: '20', exact: true}).click();
  await parent.getByRole('button', {name: '展开子表格', exact: true}).nth(0).click();
  await parent.getByRole('button', {name: '展开子表格', exact: true}).nth(0).click();
  await expect(parent.getByRole('cell', {name: '江苏代表处', exact: true})).toHaveCount(2);
  await assertExpandedContentFits(parent);
  await exportAndCheck(page, parent);
});
