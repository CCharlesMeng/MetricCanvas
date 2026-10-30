import { fileURLToPath } from 'node:url';
import { pageFilesById } from '../../../../tools/scripts/page-files.mjs';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const fixture = (kind: string) => JSON.parse(readFileSync(pageFilesById(fileURLToPath(new URL('../../../../pages', import.meta.url))).get(`table-row-expansion-${kind}`)!, 'utf8'));
async function mount(page: Page, kind: string) {
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    const recorded: unknown[] = []; (window as unknown as { rowQueries: unknown[] }).rowQueries = recorded;
    window.runtime.destroy(); window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: { async fetchData(query) {
      recorded.push(structuredClone(query));
      const control = window as unknown as { rowFailNext?: boolean };
      if (control.rowFailNext) { control.rowFailNext = false; throw Error("temporary query failure"); }
      const predicate = query.filterValues.find(value => value.target === 'dimension' && value.queryField === 'row_customer');
      const id = predicate?.target === 'dimension' ? String(predicate.values[0]) : 'unbound';
      if (id === 'unbound') throw Error('missing parent');
      const all = Array.from({ length: id === 'C01' ? 25 : id === 'C02' ? 18 : 0 }, (_, i) => ({ 'customer-id': id, 'order-id': `${id}-${String(i + 1).padStart(3, '0')}`, product: ['订阅服务', '实施服务', '数据治理'][i % 3], amount: 1200 }));
      const rows = query.search ? all.filter(row => row['order-id'].includes(query.search!.query) || row.product.includes(query.search!.query)) : all;
      const offset = query.pagination?.offset ?? 0, limit = query.pagination?.limit ?? rows.length;
      return { rows: rows.slice(offset, offset + limit), totalCount: rows.length };
    } } });
  }, fixture(kind));
}

test('clean inline child tables reuse the existing pager and keep independent views', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await mount(page, 'inline'); const parent = page.locator('article').first();
  await parent.getByRole('row', { name: '展开子表格 北辰科技 30,000', exact: true }).getByRole('button').click();
  await parent.getByRole('row', { name: '展开子表格 远山制造 21,600', exact: true }).getByRole('button').click();
  const first = parent.getByRole('region', { name: '子表格', exact: true }).nth(0), second = parent.getByRole('region', { name: '子表格', exact: true }).nth(1);
  await expect(first.getByRole('searchbox')).toHaveCount(0); await expect(first.getByRole('heading')).toHaveCount(0);
  await expect(first.locator('.sort-toggle')).toHaveCount(0);
  await expect(first.locator('tbody > tr')).toHaveCount(10);
  await first.getByRole('button', { name: '2', exact: true }).click();
  await expect(first.getByRole('cell', { name: 'C01-011', exact: true })).toBeVisible();
  await expect(second.getByRole('cell', { name: 'C02-001', exact: true })).toBeVisible();
  await first.getByLabel('每页 10 条', { exact: true }).click(); await first.getByRole('option', { name: '20', exact: true }).click();
  await expect(first.locator('tbody > tr')).toHaveCount(20);
  await expect(second.locator('tbody > tr')).toHaveCount(10);
  expect(await first.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  expect(errors).toEqual([]);
});

test('query child requests are lazy, isolated, cached across folds and reset after leaving the parent page', async ({ page }) => {
  await mount(page, 'query'); const parent = page.locator('article').first();
  const calls = () => page.evaluate(() => (window as unknown as { rowQueries: unknown[] }).rowQueries);
  expect(await calls()).toHaveLength(0);
  await parent.getByRole('row', { name: '展开子表格 北辰科技 30,000', exact: true }).getByRole('button').click();
  await parent.getByRole('row', { name: '展开子表格 远山制造 21,600', exact: true }).getByRole('button').click();
  const first = parent.getByRole('region', { name: '子表格', exact: true }).nth(0), second = parent.getByRole('region', { name: '子表格', exact: true }).nth(1);
  await expect(first.getByRole('cell', { name: 'C01-001', exact: true })).toBeVisible();
  await first.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(first.getByRole('cell', { name: 'C01-011', exact: true })).toBeVisible();
  await expect(second.getByRole('cell', { name: 'C02-001', exact: true })).toBeVisible();
  expect((await calls()).at(-1)).toMatchObject({ pagination: { offset: 10, limit: 10 }, filterValues: [{ queryField: 'row_customer', values: ['C01'] }] });
  expect(await calls()).toHaveLength(3);
  await parent.getByRole('row', { name: '收起子表格 北辰科技 30,000', exact: true }).getByRole('button').click();
  await parent.getByRole('row', { name: '展开子表格 北辰科技 30,000', exact: true }).getByRole('button').click();
  await expect(first.getByRole('cell', { name: 'C01-011', exact: true })).toBeVisible();
  await expect(second.getByRole('cell', { name: 'C02-001', exact: true })).toBeVisible();
  expect(await calls()).toHaveLength(3);
  await parent.getByRole('button', { name: '2', exact: true }).last().click();
  await expect(parent.getByRole('region', { name: '子表格', exact: true })).toHaveCount(0);
  await parent.getByRole('row', { name: '展开子表格 海川能源 0', exact: true }).getByRole('button').click();
  await expect(parent.getByRole('region', { name: '子表格', exact: true }).getByText('暂无数据', { exact: true })).toBeVisible();
  expect(await calls()).toHaveLength(4);
  await parent.getByRole('button', { name: '1', exact: true }).last().click();
  await parent.getByRole('row', { name: '展开子表格 北辰科技 30,000', exact: true }).getByRole('button').click();
  await expect(first.getByRole('cell', { name: 'C01-001', exact: true })).toBeVisible();
  expect(await calls()).toHaveLength(5);
});

test('title, search and sorting are opt-in; single mode closes the previous child', async ({ page }) => {
  await mount(page, 'inline'); const parent = page.locator('article').nth(1);
  await parent.getByRole('row', { name: '展开子表格 北辰科技 30,000', exact: true }).getByRole('button').click();
  const child = parent.getByRole('region', { name: '子表格', exact: true });
  await expect(child.getByRole('heading', { name: '订单明细', exact: true })).toBeVisible();
  await child.getByRole('searchbox').fill('C01-025'); await child.getByRole('searchbox').press('Enter');
  await expect(child.locator('tbody > tr')).toHaveCount(1);
  await expect(child.getByRole('cell', { name: 'C01-025', exact: true })).toBeVisible();
  await expect(child.locator('.sort-toggle')).toHaveCount(1);
  await parent.getByRole('row', { name: '展开子表格 远山制造 21,600', exact: true }).getByRole('button').click();
  await expect(parent.getByRole('region', { name: '子表格', exact: true })).toHaveCount(1);
  await expect(child.getByRole('cell', { name: 'C02-001', exact: true })).toBeVisible();
});

test('narrow expanded tables own their overflow and retain working page controls', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 900 }); await mount(page, 'query');
  const parent = page.locator('article').first();
  await parent.getByRole('row', { name: '展开子表格 北辰科技 30,000', exact: true }).getByRole('button').click();
  const child = parent.getByRole('region', { name: '子表格', exact: true });
  await child.getByRole('button', { name: '2', exact: true }).click();
  await expect(child.getByRole('cell', { name: 'C01-011', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // The outer table can be wider than its scroll viewport. Child controls must
  // wrap inside that viewport instead of being clipped by the outer scroll box.
  const next = await child.getByRole('button', { name: '下一页', exact: true }).boundingBox();
  const outer = await parent.locator('.scroll').first().boundingBox();
  expect(next!.x + next!.width).toBeLessThanOrEqual(outer!.x + outer!.width + 1);
  await child.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(child.getByRole('cell', { name: 'C01-021', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('narrow-row-expansion.png'), fullPage: true });
});


test('query sort resets only its own window and retry keeps the failed target page', async ({ page }) => {
  await mount(page, 'query'); const parent = page.locator('article').nth(1);
  await parent.getByRole('row', { name: '展开子表格 北辰科技 30,000', exact: true }).getByRole('button').click();
  const child = parent.getByRole('region', { name: '子表格', exact: true });
  await child.getByRole('button', { name: '2', exact: true }).click();
  await expect(child.getByRole('cell', { name: 'C01-011', exact: true })).toBeVisible();
  await child.locator('.sort-toggle').click();
  await expect(child.getByRole('cell', { name: 'C01-001', exact: true })).toBeVisible();
  const calls = await page.evaluate(() => (window as unknown as { rowQueries: unknown[] }).rowQueries);
  expect(calls.at(-1)).toMatchObject({ pagination: { offset: 0, limit: 10 }, sort: [{ queryField: 'row_product', direction: 'asc' }] });
  await page.evaluate(() => { (window as unknown as { rowFailNext: boolean }).rowFailNext = true; });
  await child.getByRole('button', { name: '2', exact: true }).click();
  await expect(child.getByText('明细暂不可用')).toBeVisible();
  await expect(child.getByRole('cell', { name: 'C01-001', exact: true })).toHaveCount(0);
  await child.getByRole('button', { name: '重试', exact: true }).click();
  await expect(child.getByRole('cell', { name: 'C01-011', exact: true })).toBeVisible();
  await expect(child.getByLabel('跳转页码')).toHaveValue('2');
});
