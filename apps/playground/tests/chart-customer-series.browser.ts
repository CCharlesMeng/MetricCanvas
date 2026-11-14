import {expect, test, type Locator} from '@playwright/test';
import {openSelection, closeSelection} from '../../../packages/embed/tests/browser/selection-actions';

declare global {
  interface Window {
    captureCustomerQuery(query: unknown): void;
    captureCustomerRuntime(event: unknown): void;
  }
}

async function chartValues(chart: Locator) {
  return chart.evaluate(async element => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name)
      .find(name => /\/(echarts-runtime\.ts|echarts_core\.js|echarts\.js)(?:\?|$)/.test(name));
    if (!url) throw Error('ECharts runtime not loaded');
    const echarts = await import(url);
    const option = echarts.getInstanceByDom(element).getOption();
    return {
      categories: option.xAxis[0].data,
      series: option.series.map((series: {name: string; data: Array<number | null | {value: number}>}) => ({
        name: series.name,
        values: series.data.map(value => typeof value === 'object' && value !== null ? value.value : value)
      }))
    };
  });
}

async function expectValues(chart: Locator, na: Array<number | null>, commercial: Array<number | null>) {
  await expect.poll(() => chartValues(chart)).toEqual({
    categories: ['华东', '华南', '华北', '西部'],
    series: [
      {name: '华为 NA', values: na},
      {name: '商业客户', values: commercial}
    ]
  });
}

test('header selections requery and update all four groups without changing series membership', async ({page}, info) => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('captureCustomerQuery', (query: unknown) => requests.push(query));
  await page.addInitScript(() => {
    performance.setResourceTimingBufferSize(10000);
    window.addEventListener('metriccanvas:customer-series-query', event => {
      window.captureCustomerQuery((event as CustomEvent).detail);
    });
  });
  await page.setViewportSize({width: 1440, height: 1100});
  await page.goto('/pages/chart-customer-series');
  const chart = page.locator('[data-component="main/sales-chart"] .echart');
  const detail = page.locator('[data-component="main/sales-detail"]');
  const control = page.getByRole('group', {name: '客户分类', exact: true});
  await expect(chart).toHaveAttribute('_echarts_instance_', /.+/);
  await expectValues(chart, [200, 160, 120, 70], [80, 120, 100, 60]);
  await page.waitForTimeout(1100); // Capture completed ECharts animation rather than an intermediate bar height.
  await page.screenshot({path: info.outputPath('all-customers.png'), fullPage: true});

  await openSelection(control);
  await page.getByRole('option', {name: '战略', exact: true}).click();
  await closeSelection(control);
  await expectValues(chart, [40, 30, 20, 0], [null, null, null, null]);
  await expect(detail.getByRole('row').filter({has: page.getByRole('cell', {name: '西部', exact: true})})).toContainText('0');
  await expect.poll(() => requests).toContainEqual(expect.objectContaining({filter: {dims: [{dim_name: '客户级别', dim_value_list: ['战略']}], metrics: []}}));
  await page.waitForTimeout(1100);
  await page.screenshot({path: info.outputPath('strategic-only.png'), fullPage: true});

  await openSelection(control);
  await page.getByRole('option', {name: '商业客户', exact: true}).click();
  await closeSelection(control);
  await expectValues(chart, [40, 30, 20, 0], [80, 120, 100, 60]);
  await openSelection(control);
  await page.getByRole('option', {name: '战略', exact: true}).click();
  await closeSelection(control);
  await expectValues(chart, [null, null, null, null], [80, 120, 100, 60]);

  await control.hover();
  await control.getByRole('button', {name: '清空客户分类', exact: true}).click();
  await expectValues(chart, [200, 160, 120, 70], [80, 120, 100, 60]);
  await expect.poll(() => requests.length).toBeGreaterThanOrEqual(4);
  expect(errors).toEqual([]);
});

test('narrow screens retain the header and empty synthetic results do not invent groups', async ({page}, info) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/pages/chart-customer-series');
  await expect(page.locator('[data-component="main/sales-detail"]')).toContainText('华东');
  await expect(page.getByRole('group', {name: '客户分类', exact: true})).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.waitForTimeout(1100);
  await page.screenshot({path: info.outputPath('mobile.png'), fullPage: true});
  await page.goto('/pages/chart-customer-series?state=empty');
  await expect(page.locator('[data-component="main/sales-detail"]')).toContainText('暂无数据');
  await expect(page.getByRole('group', {name: '客户分类', exact: true})).toBeVisible();
});

test('URL restoration and query failures keep their real runtime states', async ({page}) => {
  const events: unknown[] = [];
  await page.exposeFunction('captureCustomerRuntime', (event: unknown) => events.push(event));
  await page.addInitScript(() => {
    performance.setResourceTimingBufferSize(10000);
    window.addEventListener('metriccanvas:customer-series-runtime', event => {
      window.captureCustomerRuntime((event as CustomEvent).detail);
    });
  });
  await page.goto('/pages/chart-customer-series?customer-category='+encodeURIComponent('战略'));
  const chart = page.locator('[data-component="main/sales-chart"] .echart');
  await expect(chart).toHaveAttribute('_echarts_instance_', /.+/);
  await expectValues(chart, [40, 30, 20, 0], [null, null, null, null]);
  await page.goto('/pages/chart-customer-series?state=error');
  await expect.poll(() => events).toContainEqual(expect.objectContaining({type: 'data-error'}));
  await expect(page.locator('[data-component="main/sales-detail"]')).not.toContainText('华东');
  await expect(page.getByRole('group', {name: '客户分类', exact: true})).toBeVisible();
});
