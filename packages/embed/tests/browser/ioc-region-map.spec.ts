import { expect, test, type Page } from '@playwright/test';
import { chooseTree } from './selection-actions';

const example = '/examples/ioc-region-map.html';

interface Demo {
  queries: Array<Array<{ queryField: string; values: string[] }>>;
  viewRequests: Array<{ level: string; value: string; basemap: string; aborted: boolean }>;
}

function demo(page: Page) {
  return page.evaluate(() => (window as Window & { regionMapDemo?: Demo }).regionMapDemo!);
}

test('ES 宿主使用公开入口接入候选、查询与地图资料', async ({ page }) => {
  await page.goto(example);
  const header = page.locator('[data-filter-id="region"]');
  await expect(header.getByRole('button', { name: '区域', exact: true })).toHaveText('全球');
  await chooseTree(header, '欧洲地区部');
  await expect(page.getByRole('table').getByText('德国代表处', { exact: true })).toBeVisible();
  await expect.poll(() => demo(page)).toMatchObject({
    queries: expect.arrayContaining([[expect.objectContaining({ queryField: '地区部', values: ['欧洲地区部'] })]]),
    viewRequests: [{ level: 'region-dept', value: '欧洲地区部', basemap: 'world', aborted: false }]
  });
  await chooseTree(header, '德国代表处');
  await expect(page.getByRole('table').getByText('法国代表处', { exact: true })).toHaveCount(0);
  await expect.poll(async () => (await demo(page)).queries.at(-1)).toEqual([
    expect.objectContaining({ queryField: '代表处', values: ['德国代表处'] })
  ]);
  await chooseTree(header, '全球');
  await expect(page.locator('[data-component="global-overview/world-map"] canvas')).toBeVisible();
});

test('global 宿主可丢弃过期视口，并在无资料时继续绘制', async ({ page }) => {
  await page.goto(example + '?entry=global&viewport=slow');
  const header = page.locator('[data-filter-id="region"]');
  await chooseTree(header, '欧洲地区部');
  await expect.poll(async () => (await demo(page)).viewRequests.length).toBe(1);
  await chooseTree(header, '拉美地区部');
  await expect(page.getByRole('table').getByText('巴西代表处', { exact: true })).toBeVisible();
  await expect.poll(async () => (await demo(page)).viewRequests).toEqual([
    { level: 'region-dept', value: '欧洲地区部', basemap: 'world', aborted: true },
    { level: 'region-dept', value: '拉美地区部', basemap: 'world', aborted: false }
  ]);
  await expect(page.locator('[data-component="regional-overview/regional-map"] canvas')).toBeVisible();
});
