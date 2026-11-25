import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  discountMetric, finalizationName, finalizationProgressiveTable, monthTitle
} from '../fixtures/finalization-progressive-table';

const endpoint = '/finalization-progressive-dqe';
const regionName = '示例地区';
const selectedMonth = '2026-10';

type QueryItem = {
  output_dims: string[];
  output_metrics: string[];
  filter?: { time?: { period?: string; start?: string; end?: string } };
};

function gate() {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  return { pending, release };
}

async function routeQueries(page: Page) {
  const finalization = gate();
  const discount = gate();
  const calls: { finalizations: number; business: QueryItem[] } = { finalizations: 0, business: [] };
  await page.route(`**${endpoint}`, async route => {
    const { dsl_list: items } = route.request().postDataJSON() as { dsl_list: QueryItem[] };
    expect(items).toHaveLength(1);
    const [item] = items;
    const row = await reply(item);
    await route.fulfill({ json: {
      retCode: 'CBC.0000', results: [{ code: 'SUCCESS', total_count: 1, data: [row] }]
    } });
  });
  return { calls, finalization, discount };

  async function reply(item: QueryItem) {
    if (item.output_dims.includes('名称')) {
      calls.finalizations++;
      await finalization.pending;
      return { 名称: finalizationName, 截止日期: '2026-10-15' };
    }
    calls.business.push(item);
    if (item.output_metrics.includes(discountMetric)) {
      await discount.pending;
      return { 区域: regionName, [discountMetric]: 2.37 };
    }
    return { 区域: regionName, 金额: 42 };
  }
}

async function mountTable(page: Page, id: string) {
  await page.goto(`/examples/inline.html?visit=${id}`);
  await page.waitForFunction(() => Boolean(window.runtime));
  await page.evaluate(async ({ json, endpoint, selectedMonth }) => {
    const modulePath = '/dist/metriccanvas-runtime.es.js';
    const api: typeof import('../../src') = await import(modulePath);
    window.runtime.destroy();
    window.runtime = api.mount('#dashboard', {
      document: JSON.parse(json),
      initialSearch: `mtime=month:${selectedMonth}`,
      dataGateway: api.createDqeGateway({
        endpoint,
        headers: { 'X-Auth-Token': 'test', 'X-Operator-Id': 'test', 'X-Workspace-Id': 'test' },
        finalizationSource: {
          nameField: '名称', dateField: '截止日期',
          body: { dsl_list: [{ output_dims: ['名称', '截止日期'], output_metrics: [], filter: { dims: [], metrics: [] } }] }
        }
      })
    });
  }, { json: JSON.stringify({ ...finalizationProgressiveTable, id }), endpoint, selectedMonth });
}

async function watchDisplayedRow(row: Locator) {
  return row.evaluateHandle((element: HTMLTableRowElement) => {
    const table = element.closest('table')!;
    const heading = table.tHead;
    const cells = [...element.cells];
    const changes: string[] = [];
    const observer = new MutationObserver(() => {
      if (table.querySelector('.skeleton-row')) changes.push('whole-table skeleton');
      if (!element.isConnected || table.tHead !== heading) changes.push('table content detached');
      if (cells.some((cell, index) => element.cells[index] !== cell)) changes.push('cell replaced');
    });
    observer.observe(table.closest('.table-widget')!, { childList: true, subtree: true });
    return { changes, observer };
  });
}

test('finalization gates queries while discounts preserve displayed rows and a new page reuses the daily lookup', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'));
  const queries = await routeQueries(page);
  await mountTable(page, finalizationProgressiveTable.id);
  const table = page.getByRole('table');
  const monthHeading = table.getByRole('columnheader', { name: monthTitle, exact: true });
  const row = table.getByRole('row').filter({ has: page.getByRole('cell', { name: regionName, exact: true }) });
  const discountCell = row.getByRole('cell').last();

  await expect.poll(() => queries.calls.finalizations).toBe(1);
  await expect(monthHeading).toBeVisible();
  expect(queries.calls.business).toEqual([]);
  queries.finalization.release();

  await expect(row.getByRole('cell', { name: '42', exact: true })).toBeVisible();
  await expect.poll(() => queries.calls.business.filter(item => item.output_metrics.includes(discountMetric)).length).toBeGreaterThan(0);
  for (const item of queries.calls.business) {
    expect(item.filter?.time).toMatchObject({ period: 'month', start: selectedMonth, end: selectedMonth });
  }
  await expect(discountCell.locator('.skeleton')).toBeVisible();
  const rendered = await watchDisplayedRow(row);

  queries.discount.release();
  await expect(discountCell).toContainText('2.37');
  await expect(page.locator('.table-widget')).toHaveAttribute('aria-busy', 'false');
  expect(await rendered.evaluate(({ changes, observer }) => {
    observer.disconnect();
    return changes;
  })).toEqual([]);

  // A real navigation destroys the JS session and constructs a fresh DQE gateway.
  await mountTable(page, 'finalization-progressive-next');
  await expect(discountCell).toContainText('2.37');
  expect(queries.calls.finalizations).toBe(1);

  await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
  await mountTable(page, 'finalization-progressive-next-day');
  await expect(discountCell).toContainText('2.37');
  expect(queries.calls.finalizations).toBe(2);
});
