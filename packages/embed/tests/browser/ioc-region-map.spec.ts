import { readFileSync } from 'node:fs';
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
  await page.addInitScript(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      if (args[0].trim() === '中国区') document.documentElement.dataset.mapAliasDrawn = 'true';
      fillText.apply(this, args);
    };
  });
  await page.goto(example + '?mapLabels=short');
  const header = page.locator('[data-filter-id="region"]');
  await expect(header.getByRole('button', { name: '区域', exact: true })).toHaveText('全球');
  await expect(page.locator('html')).toHaveAttribute('data-map-alias-drawn', 'true');
  await expect(page.getByRole('table').getByText('中国地区部', { exact: true })).toBeVisible();
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

test('global 宿主丢弃过期视口并绘制最新组织', async ({ page }) => {
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

test('缺少组织视口资料时继续绘制组织地图', async ({ page }) => {
  await page.goto(example + '?entry=global&viewport=missing');
  await chooseTree(page.locator('[data-filter-id="region"]'), '拉美地区部');
  await expect(page.getByRole('table').getByText('巴西代表处', { exact: true })).toBeVisible();
  await expect.poll(async () => (await demo(page)).viewRequests).toEqual([
    { level: 'region-dept', value: '拉美地区部', basemap: 'world', aborted: false }
  ]);
  await expect(page.locator('[data-component="regional-overview/regional-map"] canvas')).toBeVisible();
});

test('正式合同商务页从代表处 URL 恢复，按授权父级选择中国分区', async ({ page }) => {
  const document = JSON.parse(readFileSync(new URL('../../../../pages/business/dashboard/ioc/commercial/contract-business-overview.json',import.meta.url),'utf8'));
  await page.route('**/pages/ioc-region-map-demo.json', route => route.fulfill({json:document}));
  await page.goto(example + '?rep-office=' + encodeURIComponent('上海代表处'));
  const header = page.locator('[data-filter-id="region"]');
  await expect(header.getByRole('button',{name:'区域',exact:true})).toHaveText('上海代表处');
  await expect(page.locator('[data-component="overview-content/china-map"] canvas')).toBeVisible();
  await expect(page.locator('[data-component="overview-content/regional-map"]')).toHaveCount(0);
  await chooseTree(header,'全球');
  await expect(page.locator('[data-component="overview-content/world-map"] canvas')).toBeVisible();
  const table = page.locator('[data-component="overview-content/global-overview-table"]');
  const canvas = page.locator('[data-component="overview-content/world-map"] canvas');
  await table.getByRole('button', { name: '放大表格' }).click();
  await expect(canvas).toBeHidden();
  await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  await table.getByRole('button', { name: '还原表格' }).click();
  await expect(canvas).toBeVisible();
});
