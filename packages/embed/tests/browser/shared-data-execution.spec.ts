import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createPageDataExecutor } from '@metriccanvas/data-execution';

const main = 'project-efficiency-bottom5', detail = `${main}-stages`;
const fixture = () => JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/query-cascade-page.json', import.meta.url), 'utf8'));

test('Node-filled SDT metadata renders raw initial, refreshes a cascade and invalidates URL parameter overrides', async ({ page }, testInfo) => {
  const document = fixture();
  document.params = { query: { times: [{ id: 'period', granularity: 'month', start: '2026-09', end: '2026-09' }] } };
  for (const id of [main, detail]) document.dataSources[id].source.query.body.dsl_list[0].filter.time = { period: 'month', param: 'period' };
  const filled: unknown = await createPageDataExecutor({ gateway: { async fetchData(_query, context) {
    return context!.dataSourceIds![0] === main
      ? { rows: [{ 'commerce-id': 'A', 'customer-name': '客户甲', 'project-name': '回填项目', 'decision-time': 2 }], totalCount: 1 }
      : { rows: [{ 'commerce-id': 'A', 'stage-name': '代表处SDT', 'decision-time': 0, 'decision-count': 3 }], totalCount: 1 };
  } } }).execute(document);
  await page.goto('/examples/inline.html');
  await page.evaluate(({ filled, main }) => {
    window.runtime.destroy();
    (window as any).sharedCalls = [];
    window.runtime = MetricCanvas.mount('#dashboard', { document: filled, dataGateway: {
      async fetchData(query, context) {
        const id = context!.dataSourceIds![0]; (window as any).sharedCalls.push({ id, query });
        return id === main
          ? { rows: [{ 'commerce-id': 'B', 'customer-name': '客户乙', 'project-name': '刷新项目', 'decision-time': 6 }], totalCount: 1 }
          : { rows: [{ 'commerce-id': 'B', 'stage-name': '代表处SDT', 'decision-time': 4, 'decision-count': 8 }], totalCount: 1 };
      }
    } });
  }, { filled, main });
  await expect(page.getByRole('table').getByText('回填项目')).toBeVisible();
  await expect(page.getByRole('table').getByText('0.0', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).sharedCalls)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('sdt-filled-initial.png'), fullPage: true });
  await page.evaluate(({ filled, main }) => {
    window.runtime.update({ document: filled, initialSearch: 'period=2026-10', dataGateway: {
      async fetchData(query, context) {
        const id = context!.dataSourceIds![0]; (window as any).sharedCalls.push({ id, query });
        return id === main
          ? { rows: [{ 'commerce-id': 'B', 'customer-name': '客户乙', 'project-name': '刷新项目', 'decision-time': 6 }], totalCount: 1 }
          : { rows: [{ 'commerce-id': 'B', 'stage-name': '代表处SDT', 'decision-time': 4, 'decision-count': 8 }], totalCount: 1 };
      }
    } });
  }, { filled, main });
  await expect(page.getByRole('table').getByText('刷新项目')).toBeVisible();
  const calls = await page.evaluate(() => (window as any).sharedCalls);
  expect(calls.map((call: any) => call.id)).toEqual([main, detail]);
  expect(calls[0].query.body.dsl_list[0].filter.time).toMatchObject({ start: '2026-10', end: '2026-10' });
  expect(calls[1].query.filterValues).toContainEqual({ target: 'dimension', queryField: '商务编号', values: ['B'] });
  await page.screenshot({ path: testInfo.outputPath('sdt-parameter-refresh.png'), fullPage: true });
});

test('interactive SDT filters reuse initial then query main before the newly selected details', async ({ page }) => {
  const document = fixture();
  document.layout = 'dashboard';
  document.filters = [{ id: 'customer', type: 'dimension', dimension: 'customer', label: '客户范围', display: 'tabs', default: ['East'] }];
  document.dataSources[main].source.query.filterBindings = { customer: { target: 'dimension', queryField: '客户名称' } };
  const filled: unknown = await createPageDataExecutor({ gateway: { async fetchData(_query, context) {
    return context!.dataSourceIds![0] === main
      ? { rows: [{ 'commerce-id': 'A', 'customer-name': 'East', 'project-name': '东区项目', 'decision-time': 2 }], totalCount: 1 }
      : { rows: [{ 'commerce-id': 'A', 'stage-name': '代表处SDT', 'decision-time': 1, 'decision-count': 3 }], totalCount: 1 };
  } } }).execute(document);
  await page.goto('/examples/inline.html');
  await page.evaluate(({ filled, main }) => {
    window.runtime.destroy(); (window as any).sharedCalls = [];
    window.runtime = MetricCanvas.mount('#dashboard', { document: filled, dataGateway: {
      async fetchData(query, context) {
        const id = context!.dataSourceIds![0]; (window as any).sharedCalls.push({ id, query });
        return id === main
          ? { rows: [{ 'commerce-id': 'B', 'customer-name': 'West', 'project-name': '西区项目', 'decision-time': 6 }], totalCount: 1 }
          : { rows: [{ 'commerce-id': 'B', 'stage-name': '代表处SDT', 'decision-time': 4, 'decision-count': 8 }], totalCount: 1 };
      },
      async fetchDimensionValues() { return { kind: 'values', candidates: [{ value: 'East', label: 'East' }, { value: 'West', label: 'West' }] }; }
    } });
  }, { filled, main });
  await expect(page.getByRole('table').getByText('东区项目')).toBeVisible();
  expect(await page.evaluate(() => (window as any).sharedCalls)).toEqual([]);
  await page.getByRole('tab', { name: 'West', exact: true }).click();
  await expect(page.getByRole('table').getByText('西区项目')).toBeVisible();
  const calls = await page.evaluate(() => (window as any).sharedCalls);
  expect(calls.map((call: any) => call.id)).toEqual([main, detail]);
  expect(calls[0].query.filterValues).toContainEqual({ target: 'dimension', queryField: '客户名称', values: ['West'] });
  expect(calls[1].query.filterValues).toContainEqual({ target: 'dimension', queryField: '商务编号', values: ['B'] });
});
