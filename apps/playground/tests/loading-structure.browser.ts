import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/layout/loading-structure-demo.json', import.meta.url), 'utf8'));

const galleryRows: Record<string, unknown>[] = JSON.parse(readFileSync(new URL('../../../tools/dqe-sim/fixtures/loading-structure-gallery.json', import.meta.url), 'utf8'));
const entryRows = ['CN', 'OVERSEAS'].flatMap((region, regionIndex) => Array.from({ length: 4 }, (_, index) => ({
  chart_demo_region: region, chart_demo_category: `合成类别${index + 1}`,
  chart_demo_orders: (index + 1) * 10 * (regionIndex + 1), chart_demo_revenue: (index + 1) * 100 * (regionIndex + 1)
})));
type DemoItem = { output_dims: string[]; output_metrics: string[]; filter: { dims: { dim_name: string; dim_value_list: string[] }[] }; order: { offset?: number; limit?: number } };
// Deterministic UI receipts use the same gallery fixture; Sim query validation has separate coverage.
function simulatedReceipt(item: DemoItem) {
  let rows: Record<string, unknown>[] = item.output_dims.includes('preview_category') ? galleryRows : entryRows;
  for (const dimension of item.filter.dims) {
    if (dimension.dim_name === 'loading_demo_round') continue;
    rows = rows.filter(row => dimension.dim_value_list.includes(String(row[dimension.dim_name])));
  }
  const offset = item.order.offset ?? 0;
  const limit = item.order.limit ?? rows.length;
  const fields = [...item.output_dims, ...item.output_metrics];
  return { code: 'SUCCESS', total_count: rows.length,
    data: rows.slice(offset, offset + limit).map(row => Object.fromEntries(fields.map(field => [field, row[field]]))) };
}

test('native components stay mounted through initial loading, filtering, pagination and tab activation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let release: () => void = () => {};
  let pending: Promise<void>;
  function hold() { pending = new Promise<void>(resolve => { release = resolve; }); }
  hold();
  await page.route('**/dsl/execute', async route => {
    const request = route.request().postDataJSON();
    await pending;
    await route.fulfill({ json: { retCode: 'CBC.0000', results: request.dsl_list.map(simulatedReceipt) } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/pages/${fixture.id}`);
  const orders = page.locator('[data-tab-panel="orders"]');
  const metric = orders.locator('.metric-card');
  const chart = orders.locator('.bar-chart');
  const table = orders.locator('.table-widget');
  await expect(orders.locator('.skeleton')).toHaveCount(0);
  await expect(orders.locator('[aria-busy="true"]')).not.toHaveCount(0);
  await expect(metric).toBeVisible();
  await expect(chart).toBeVisible();
  await expect(table.getByRole('columnheader', { name: '类别', exact: true })).toBeVisible();
  await expect(table.getByText('正在加载…', { exact: true })).toBeVisible();
  const metricNode = await metric.elementHandle();
  const chartNode = await chart.elementHandle();
  const headingNode = await table.locator('thead').elementHandle();
  const pagerNode = await table.locator('.pager').elementHandle();
  await page.screenshot({ path: '/tmp/mc-loading-structure/initial.png', fullPage: true });
  release();
  await expect(table).toContainText('合成类别1');
  await expect(orders.locator('[aria-busy="true"]')).toHaveCount(0);
  expect(await metricNode!.evaluate(node => node.isConnected)).toBe(true);
  expect(await chartNode!.evaluate(node => node.isConnected)).toBe(true);
  expect(await headingNode!.evaluate(node => node.isConnected)).toBe(true);

  hold();
  await table.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(table.getByText('正在加载…', { exact: true })).toBeVisible();
  expect(await pagerNode!.evaluate(node => node.isConnected)).toBe(true);
  expect(await headingNode!.evaluate(node => node.isConnected)).toBe(true);
  release();
  await expect(table).toContainText('合成类别3');

  hold();
  await page.getByRole('group', { name: '测试轮次', exact: true }).getByRole('button', { name: '第2轮', exact: true }).click();
  await expect(table.getByText('正在加载…', { exact: true })).toBeVisible();
  await expect(metric).not.toContainText('10');
  expect(await chartNode!.evaluate(node => node.isConnected)).toBe(true);
  expect(await headingNode!.evaluate(node => node.isConnected)).toBe(true);
  release();
  await expect(table).toContainText('合成类别1');

  hold();
  await table.getByRole('button', { name: '展开子表格', exact: true }).first().click();
  const nested = table.locator('.table-widget');
  await expect(nested.getByRole('columnheader', { name: '子项类别', exact: true })).toBeVisible();
  await expect(nested.getByText('正在加载…', { exact: true })).toBeVisible();
  const nestedHeading = await nested.locator('thead').elementHandle();
  release();
  await expect(nested).toContainText('合成类别1');
  expect(await nestedHeading!.evaluate(node => node.isConnected)).toBe(true);

  hold();
  await page.getByRole('tab', { name: '收入', exact: true }).click();
  const revenue = page.locator('[data-tab-panel="revenue"]');
  await expect(revenue.locator('.echart')).toBeVisible();
  await expect(revenue.getByRole('columnheader', { name: '类别', exact: true })).toBeVisible();
  const regularHeading = await revenue.locator('thead').elementHandle();
  await expect(revenue.locator('[aria-busy="true"]')).not.toHaveCount(0);
  await expect(revenue.locator('.skeleton')).toHaveCount(0);
  const lineNode = await revenue.locator('.echart').elementHandle();
  release();
  await expect(revenue.locator('[aria-busy="true"]')).toHaveCount(0);
  expect(await lineNode!.evaluate(node => node.isConnected)).toBe(true);
  expect(await regularHeading!.evaluate(node => node.isConnected)).toBe(true);
  await page.getByRole('tab', { name: '订单', exact: true }).click();
  expect(await chartNode!.evaluate(node => node.isConnected)).toBe(true);
  expect(await headingNode!.evaluate(node => node.isConnected)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/mc-loading-structure/ready-narrow.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('all component families share a replayable loading review without replacing their cells', async ({ page }) => {
  const { flattenPageComponents } = await import('../../../packages/page/src/component-walk');
  const components = flattenPageComponents<import('@metriccanvas/page/internal').Component>(fixture)
    .filter(component => 'data' in component && component.data?.main === 'gallery');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let release: () => void = () => {};
  let pending: Promise<void>;
  function hold() { pending = new Promise<void>(resolve => { release = resolve; }); }
  hold();
  await page.route('**/dsl/execute', async route => {
    const request = route.request().postDataJSON();
    await pending;
    await route.fulfill({ json: { retCode: 'CBC.0000', results: request.dsl_list.map(simulatedReceipt) } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/loading-components-review');
  const dashboard = page.locator('[data-review-surface="dashboard"]');
  const report = page.locator('[data-review-surface="report"]');
  const cells = [];
  for (const component of components) {
    const cell = component.id.startsWith('gallery-composite-')
      ? dashboard.locator('[data-component$="/gallery-composite"] .widget-content').nth(component.id.endsWith('metric') ? 0 : 1)
      : dashboard.locator(`[data-component$="/${component.id}"]`);
    await expect(cell.locator('.loading-spinner')).toHaveCount(1);
    cells.push(await cell.elementHandle());
  }
  await expect(dashboard.locator('.loading-spinner')).toHaveCount(17);
  await expect(report.locator('.ai-summary .loading-spinner')).toHaveCount(1);
  await expect(page.locator('.skeleton')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/mc-loading-gallery/loading-wide.png', fullPage: true });
  release();
  await expect(dashboard.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(report.locator('.ai-summary')).toHaveAttribute('aria-busy', 'false');
  await expect(report.locator('.ai-summary')).toContainText('本地 Mock 分析');
  await expect(dashboard.locator('[data-component$="/gallery-ranking"]')).toContainText('华北团队');
  await expect(dashboard.locator('[data-component$="/gallery-field-text"]')).toContainText('合成说明');
  for (const cell of cells) expect(await cell!.evaluate(node => node.isConnected)).toBe(true);
  await page.screenshot({ path: '/tmp/mc-loading-gallery/ready-wide.png', fullPage: true });
  hold();
  await page.getByRole('button', { name: '重新播放全部加载', exact: true }).click();
  await expect(dashboard.locator('.loading-spinner')).toHaveCount(17);
  await expect(report.locator('.ai-summary .loading-spinner')).toHaveCount(1);
  release();
  await expect(page.locator('.loading-spinner')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/mc-loading-gallery/ready-narrow.png', fullPage: true });
  expect(errors).toEqual([]);
});
