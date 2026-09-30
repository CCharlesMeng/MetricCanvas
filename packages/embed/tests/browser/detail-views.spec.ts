import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { DataGatewayResult } from '@metriccanvas/engine';

declare global {
  interface Window {
    detailRequests: Array<{ signal?: AbortSignal; resolve(result: DataGatewayResult): void }>;
  }
}
const fixture = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/detail-views.json', import.meta.url), 'utf8'));

test('two columns use distinct row and page date bindings', async ({ page }) => {
  const document = structuredClone(fixture);
  delete document.detailViews; delete document.dataSources.detail;
  document.filters = document.filters.slice(0, 1);
  document.params = [{ id: 'page-month', type: 'string', default: '202604' }];
  document.dataSources.rows.fields.mtime = { type: 'string', role: 'dimension' };
  for (const row of document.dataSources.rows.source.rows) row.mtime = '202603';
  const main = document.sections[1].components[0];
  delete main.props.actions;
  main.props.columns[0].navigate = { href: '/project', query: { mtime: { source: 'row', field: 'mtime' } } };
  main.props.columns[1].link = true;
  main.props.columns[1].navigate = { href: '/customer', query: { mtime: { source: 'param', id: 'page-month' } } };
  await page.goto('/examples/inline.html');
  await page.evaluate(document => window.runtime.update({ document }), document);
  const first = page.locator('[data-metriccanvas-runtime] tbody tr').first();
  await expect(first.getByRole('link', { name: '客户01', exact: true })).toHaveAttribute('href', '/project?mtime=202603');
  await expect(first.getByRole('link', { name: '1', exact: true })).toHaveAttribute('href', '/customer?mtime=202604');
});

test('column-specific snapshot detail reuses existing rows and never queries', async ({ page }) => {
  const document = structuredClone(fixture);
  delete document.dataSources.detail;
  document.filters = document.filters.slice(0, 1);
  const main = document.sections[1].components[0];
  delete main.props.actions;
  main.props.columns[0].openDetail = { surface: 'modal', view: 'trend', titleField: 'name' };
  document.detailViews = [{ id: 'trend', mode: 'snapshot', components: [{ id: 'snapshot-table', type: 'table',
    layout: { span: 12 }, data: { main: 'rows' }, props: { columns: [{ field: 'name' }, { field: { data: 'main', field: 'amount', missingText: '暂无数据' } }], pagination: { mode: 'local', pageSize: 10 } } }] }];
  document.dataSources.rows.source.rows[1].amount = null;
  document.dataSources.rows.source.rows[2].amount = -1200;
  document.sections[0].components.push({ id: 'metric', type: 'metricCard', layout: { span: 12 }, data: { main: 'rows' },
    props: { rows: [{ label: '累计收入', valueField: 'amount', link: true }], actions: [{ on: 'click', openDetail: { surface: 'modal', view: 'trend' } }] } });
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy(); window.queryCalls = [];
    window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: { async fetchData() { window.queryCalls.push({}); return { rows: [] }; } } });
  }, document);
  const host = page.locator('[data-metriccanvas-runtime]');
  await host.getByRole('button', { name: '客户01', exact: true }).click();
  const dialog = host.getByRole('dialog');
  await expect(dialog).toContainText('客户10');
  await expect(dialog).toContainText('暂无数据');
  await expect(dialog).toContainText('-1200');
  await dialog.getByRole('button', { name: '下一页' }).click();
  await expect(dialog).toContainText('客户20');
  expect(await page.evaluate(() => window.queryCalls.length)).toBe(0);
  await page.keyboard.press('Escape');
  const metric = host.getByRole('button', { name: '累计收入 1', exact: true });
  await metric.focus(); await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(metric).toBeFocused();
});

test('query detail cancellation, late responses, local sorting and focus restoration', async ({ page }) => {
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy();
    window.detailRequests = [];
    window.runtime = MetricCanvas.mount('#dashboard', { document,
      dataGateway: { fetchData(_query, _context, signal) {
        return new Promise(resolve => window.detailRequests.push({ signal, resolve }));
      } }
    });
  }, fixture);
  const host = page.locator('[data-metriccanvas-runtime]');
  const a = host.getByRole('button', { name: '客户01', exact: true });
  const b = host.getByRole('button', { name: '客户02', exact: true });
  await expect(a).toBeVisible();
  expect(await page.evaluate(() => window.detailRequests.length)).toBe(0);
  await a.focus(); await page.keyboard.press('Enter');
  await expect(host.getByRole('dialog')).toBeVisible();
  await host.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(a).toBeFocused();
  expect(await page.evaluate(() => window.detailRequests[0].signal?.aborted)).toBe(true);
  await b.click();
  await page.evaluate(() => {
    window.detailRequests[1].resolve({ rows: [{ period: 'B', value: 20 }, { period: 'B2', value: 10 }], totalCount: 2 });
    window.detailRequests[0].resolve({ rows: [{ period: 'OLD-A', value: 999 }], totalCount: 1 });
  });
  const dialog = host.getByRole('dialog');
  await expect(dialog).toContainText('B2');
  await expect(dialog).not.toContainText('OLD-A');
  await dialog.locator('.sort-toggle').click();
  await expect(dialog.locator('tbody tr').first()).toContainText('B2');
  await page.keyboard.press('Escape');
  await expect(b).toBeFocused();
  await a.click();
  // A global filter transition closes the overlay, including a pending request.
  await host.locator('input[type="search"]').fill('客户02', { force: true });
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.detailRequests[2].signal?.aborted)).toBe(true);
  await page.evaluate(() => window.detailRequests[2].resolve({ rows: [{ period: 'late', value: 123 }] }));
  await expect(dialog).toHaveCount(0);
});
