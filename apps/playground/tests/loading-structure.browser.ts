import { test, expect } from '@playwright/test';
import { sortDqeRows } from '../../../tools/dqe-sim/src/sort';
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
  rows = sortDqeRows(rows, item.order, fields)!;
  return { code: 'SUCCESS', total_count: rows.length,
    data: rows.slice(offset, offset + limit).map(row => Object.fromEntries(fields.map(field => [field,
      typeof row[field] === 'number' && item.output_metrics.includes(field)
        ? Number(row[field]) * Number(item.filter.dims.find(dimension => dimension.dim_name === 'loading_demo_round')?.dim_value_list[0] ?? 1) : row[field]]))) };
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
  await expect(table.locator('.skeleton-row')).toHaveCount(10);
  await expect(chart.locator('.echart-frame.loading')).toBeVisible();
  await expect(orders.locator('[aria-busy="true"]')).not.toHaveCount(0);
  await expect(metric).toBeVisible();
  await expect(chart).toBeVisible();
  await expect(table.getByRole('columnheader', { name: '类别', exact: true })).toBeVisible();
  await expect(table.getByText('正在加载…', { exact: true })).toHaveCount(0);
  const metricNode = await metric.elementHandle();
  const chartNode = await chart.elementHandle();
  const canvasNode = await chart.locator('canvas').elementHandle();
  await expect(chart.locator('.echart')).toHaveCSS('filter', 'grayscale(1)');
  await expect(page.locator('.chart-skeleton')).toHaveCount(0);
  const headingNode = await table.locator('thead').elementHandle();
  const pagerNode = await table.locator('.pager').elementHandle();
  await page.screenshot({ path: '/tmp/mc-loading-structure/initial.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/mc-loading-structure/initial-narrow.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  release();
  await expect(table).toContainText('合成类别1');
  await expect(orders.locator('[aria-busy="true"]')).toHaveCount(0);
  expect(await metricNode!.evaluate(node => node.isConnected)).toBe(true);
  expect(await chartNode!.evaluate(node => node.isConnected)).toBe(true);
  expect(await canvasNode!.evaluate(node => node.isConnected)).toBe(true);
  await expect(chart.locator('.echart')).toHaveCSS('filter', 'none');
  expect(await headingNode!.evaluate(node => node.isConnected)).toBe(true);

  hold();
  await table.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(table).toHaveAttribute('aria-busy', 'true');
  await expect(table.locator('.skeleton-row')).toHaveCount(10);
  await expect(table.locator('tbody')).not.toContainText('合成类别1');
  await expect(table.locator('.loading-spinner')).toHaveCount(0);
  expect(await pagerNode!.evaluate(node => node.isConnected)).toBe(true);
  expect(await headingNode!.evaluate(node => node.isConnected)).toBe(true);
  release();
  await expect(table).toContainText('合成类别3');

  hold();
  await page.getByRole('group', { name: '测试轮次', exact: true }).getByRole('button', { name: '第2轮', exact: true }).click();
  await expect(table).toHaveAttribute('aria-busy', 'true');
  await expect(table.locator('.skeleton-row')).toHaveCount(10);
  await expect(chart.locator('.echart-frame.loading')).toBeVisible();
  await expect(metric.locator('.row-value').first()).toHaveText('10');
  await expect(metric.locator('.loading-spinner')).toHaveCount(0);
  expect(await chartNode!.evaluate(node => node.isConnected)).toBe(true);
  expect(await headingNode!.evaluate(node => node.isConnected)).toBe(true);
  release();
  await expect(table).toContainText('合成类别1');
  await expect(metric.locator('.row-value').first()).toHaveText('20');

  hold();
  await table.getByRole('button', { name: '展开子表格', exact: true }).first().click();
  const nested = table.locator('.table-widget');
  await expect(nested.getByRole('columnheader', { name: '子项类别', exact: true })).toBeVisible();
  await expect(nested.locator('.skeleton-row')).toHaveCount(10);
  const nestedHeading = await nested.locator('thead').elementHandle();
  release();
  await expect(nested).toContainText('合成类别1');
  expect(await nestedHeading!.evaluate(node => node.isConnected)).toBe(true);

  hold();
  await page.getByRole('tab', { name: '收入', exact: true }).click();
  const revenue = page.locator('[data-tab-panel="revenue"]');
  await expect(revenue.locator('.echart-frame')).toBeVisible();
  await expect(revenue.getByRole('columnheader', { name: '类别', exact: true })).toBeVisible();
  const regularHeading = await revenue.locator('thead').elementHandle();
  await expect(revenue.locator('[aria-busy="true"]')).not.toHaveCount(0);
  await expect(revenue.locator('.echart-frame.loading')).toBeVisible();
  await expect(revenue.locator('.skeleton-row')).toHaveCount(10);
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
  const chartTypes = new Set(['barChart', 'lineChart', 'pieChart', 'mapChart', 'gauge']);
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
    if (component.type === 'metricCard') {
      await expect(cell.locator('.loading-spinner')).toHaveCount(0);
      await expect(cell.locator('.loading-indicator')).toHaveCount(0);
      await expect(cell.locator('.row-value').first()).toHaveText('--');
    } else if (chartTypes.has(component.type)) {
      await expect(cell.locator('.echart-frame.loading, .gauge-plot.loading')).toBeVisible();
      await expect(cell.locator('.loading-spinner')).toHaveCount(0);
    } else {
      await expect(cell.locator('.loading-spinner')).toHaveCount(0);
      await expect(cell.locator('.skeleton').first()).toBeVisible();
    }
    cells.push(await cell.elementHandle());
  }
  // Every family, including AI summary and its replay, uses a static loading presentation.
  await expect(dashboard.locator('.loading-spinner')).toHaveCount(0);
  await expect(report.locator('.ai-summary .loading-spinner')).toHaveCount(0);
  await expect(report.locator('.ai-summary .text-skeleton')).toBeVisible();
  await expect(page.locator('.loading-spinner, .loading-indicator')).toHaveCount(0);
  await expect(page.getByText(/正在加载|加载中…|加载页面…/)).toHaveCount(0);
  await expect(dashboard.locator('.skeleton-row')).not.toHaveCount(0);
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
  await expect(dashboard.locator('.loading-spinner')).toHaveCount(0);
  await expect(report.locator('.ai-summary .loading-spinner')).toHaveCount(0);
  await expect(report.locator('.ai-summary .text-skeleton')).toBeVisible();
  release();
  await expect(page.locator('.loading-spinner')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/mc-loading-gallery/ready-narrow.png', fullPage: true });
  expect(errors).toEqual([]);
});

const metricLoadingFixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/layout/metric-card-loading.json', import.meta.url), 'utf8'));

test('independent components render before a slower query returns', async ({ page }) => {
  let release: () => void = () => {};
  const slow = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/dsl/execute', async route => {
    const request = route.request().postDataJSON();
    expect(request.dsl_list).toHaveLength(1);
    if (request.dsl_list[0].output_dims.includes('preview_category')) await slow;
    await route.fulfill({ json: { retCode: 'CBC.0000', results: request.dsl_list.map(simulatedReceipt) } });
  });
  await page.goto(`/pages/${fixture.id}`);
  const orders = page.locator('[data-tab-panel="orders"]');
  await expect(orders.locator('.metric-card .row-value').first()).toHaveText('10');
  await expect(orders.locator('.table-widget')).toContainText('合成类别1');
  const slowCard = page.locator('[data-component$="/gallery-metric"]');
  await expect(slowCard.locator('.row-value').first()).toHaveText('--');
  await expect(slowCard.locator('.widget-content')).toHaveAttribute('aria-busy', 'true');
  release();
  await expect(slowCard.locator('.row-value').first()).not.toHaveText('--');
});

for (const outcome of ['ready', 'empty', 'error'] as const) {
  test(`metric values load in place across every variant, then settle to ${outcome}`, async ({ page }) => {
    let release: () => void = () => {};
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/dsl/execute', async route => {
      await pending;
      const request = route.request().postDataJSON();
      const results = request.dsl_list.map((item: DemoItem) => outcome === 'empty'
        ? { code: 'SUCCESS', total_count: 0, data: [] } : simulatedReceipt(item));
      await route.fulfill(outcome === 'error' ? { status: 500, body: 'Synthetic query failure' }
        : { json: { retCode: 'CBC.0000', results } });
    });
    await page.goto(`/pages/${metricLoadingFixture.id}`);
    const cards = page.locator('.metric-card');
    await expect(cards).toHaveCount(8);
    for (const card of await cards.all()) {
      await expect(card.locator('.loading-spinner')).toHaveCount(0);
      await expect(card.locator('.progress-ring .number')).toHaveText('--');
      await expect(card.locator('.row-value')).toHaveText(['--', '--']);
      await expect(card.locator('.change-value')).toHaveText(['--', '--']);
      await expect(card.locator('.trend-arrow, .unit, .change-unit')).toHaveCount(0);
    }
    await expect(page.locator('.loading-indicator')).toHaveCount(0);
    await page.screenshot({ path: `/tmp/mc-metric-loading/${outcome}-wide.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/mc-metric-loading/${outcome}-narrow.png`, fullPage: true });
    release();
    await expect(page.locator('.loading-spinner')).toHaveCount(0);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    for (const card of await cards.all()) {
      if (outcome === 'ready') {
        await expect(card.locator('.row-value').first()).toContainText('72');
        await expect(card.locator('.unit')).toHaveCount(2);
      } else {
        await expect(card.locator('.row-value').first()).toHaveText('--');
        await expect(card.locator('.trend-arrow, .unit, .change-unit')).toHaveCount(0);
      }
    }
  });
}


test('query sorting replaces only the table body with ten skeleton rows', async ({ page }) => {
  let pending = Promise.resolve();
  let release: () => void = () => {};
  await page.route('**/dsl/execute', async route => {
    const request = route.request().postDataJSON();
    await pending;
    await route.fulfill({ json: { retCode: 'CBC.0000', results: request.dsl_list.map(simulatedReceipt) } });
  });
  await page.goto(`/pages/${fixture.id}`);
  const table = page.locator('[data-tab-panel="orders"] .table-widget');
  await expect(table).toContainText('合成类别1');
  const heading = await table.locator('thead').elementHandle();
  const pager = await table.locator('.pager').elementHandle();
  const sort = table.getByRole('columnheader', { name: /订单量/ }).locator('.sort-toggle');
  pending = new Promise<void>(resolve => { release = resolve; });
  await sort.click();
  await expect(table.locator('.skeleton-row')).toHaveCount(10);
  await expect(table.locator('tbody')).not.toContainText('合成类别1');
  await expect(table.locator('.loading-spinner')).toHaveCount(0);
  expect(await heading!.evaluate(node => node.isConnected)).toBe(true);
  expect(await pager!.evaluate(node => node.isConnected)).toBe(true);
  release();
  await expect(table.locator('.skeleton-row')).toHaveCount(0);
  await expect(table).toContainText('合成类别1');
  pending = new Promise<void>(resolve => { release = resolve; });
  await sort.click();
  await expect(table.locator('.skeleton-row')).toHaveCount(10);
  release();
  await expect(table).toContainText('合成类别4');
  await expect(table.locator('.skeleton-row')).toHaveCount(0);
});


for (const outcome of ['empty', 'error'] as const) {
  test(`chart and table skeletons end when the query settles to ${outcome}`, async ({ page }) => {
    let release: () => void = () => {};
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/dsl/execute', async route => {
      await pending;
      const request = route.request().postDataJSON();
      await route.fulfill(outcome === 'error' ? { status: 500, body: 'Synthetic failure' }
        : { json: { retCode: 'CBC.0000', results: request.dsl_list.map(() => ({ code: 'SUCCESS', data: [], total_count: 0 })) } });
    });
    await page.goto(`/pages/${fixture.id}`);
    const orders = page.locator('[data-tab-panel="orders"]');
    await expect(orders.locator('.skeleton-row')).toHaveCount(10);
    await expect(orders.locator('.echart-frame.loading')).toBeVisible();
    release();
    await expect(orders.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(orders.locator('.skeleton, .echart-frame.loading')).toHaveCount(0);
    await expect(orders.locator('.table-widget')).toContainText('暂无数据');
    await expect(orders.getByText('正在加载…', { exact: true })).toHaveCount(0);
  });
}
