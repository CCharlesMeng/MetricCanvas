import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');
const fixture = () => JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/table-toolbar-page.json', import.meta.url), 'utf8'));

test('table-local search finds a later row and downloads all matches while another table remains independent', async ({ page }, testInfo) => {
  const document = fixture();
  const second = structuredClone(document.sections[0].components[0]); second.id = 'other-table'; second.props.title = '另一张表';
  document.sections[0].components.push(second);
  await page.goto('/examples/inline.html');
  await page.evaluate(document => { window.runtime.destroy(); window.runtime = MetricCanvas.mount('#dashboard', { document }); }, document);
  const table = page.locator('[data-component="main/records-table"]');
  const other = page.locator('[data-component="main/other-table"]');
  await table.getByRole('searchbox', { name: '表格搜索' }).fill('客户25');
  await table.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(table.getByRole('cell', { name: '客户25', exact: true })).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(1); await expect(other.locator('tbody tr')).toHaveCount(10);
  await table.getByRole('button', { name: '清空表格搜索' }).click();
  await table.getByRole('searchbox').fill('客户2'); await table.getByRole('searchbox').press('Enter');
  const downloaded = page.waitForEvent('download'); await table.getByRole('button', { name: '导出' }).click();
  const file = await downloaded; expect(file.suggestedFilename()).toBe('客户明细.xlsx');
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await file.path())!);
  const sheet = workbook.worksheets[0]; expect(sheet.rowCount).toBe(8); expect(sheet.getCell('A8').value).toBe('客户25');
  expect(sheet.getCell('B8').value).toBe(25);
  await page.screenshot({ path: testInfo.outputPath('independent-search.png'), fullPage: true });
  // Keep the submitted scope while a draft remains unsubmitted; PDF must omit controls.
  await table.getByRole('searchbox').fill('客户1');
  const exported = await page.evaluate(async () => window.runtime.withExportView(async ({ target }) => ({
    tools: target.querySelectorAll('[data-table-toolbar]').length,
    text: target.textContent
  })));
  expect(exported.tools).toBe(0); expect(exported.text).toContain('客户25');
});

test('query search forwards mapped fields and full export traverses every matching page', async ({ page }) => {
  const document = fixture();
  document.dataSources.records.fields.name.queryField = '客户'; document.dataSources.records.fields.value.queryField = '金额';
  document.dataSources.records.source = { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['客户'], output_metrics: ['金额'], order: { offset: 0, limit: 5 } }] } } };
  document.sections[0].components[0].props.pagination = { mode: 'query' };
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: { async fetchData(query) {
      const all = Array.from({ length: 35 }, (_, index) => ({ name: `客户${index + 1}`, value: index + 1 }));
      if (query.search && query.search.queryFields[0] !== '客户') throw new Error('wrong field mapping');
      const rows = query.search ? all.filter(row => row.name.toLowerCase().includes(query.search!.query.toLowerCase())) : all;
      const offset = query.pagination?.offset ?? 0, limit = query.pagination?.limit ?? rows.length;
      return { rows: rows.slice(offset, offset + limit), totalCount: rows.length };
    } } });
  }, document);
  await page.getByRole('searchbox').fill('客户35'); await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('cell', { name: '客户35', exact: true })).toBeVisible();
  await page.getByRole('searchbox').fill('客户2'); await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('cell', { name: '客户2', exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: '导出' }).click();
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await (await downloaded).path())!);
  expect(workbook.worksheets[0].rowCount).toBe(12); expect(workbook.worksheets[0].getCell('A12').value).toBe('客户29');
});

test('unsupported query search remains clearable after failure', async ({ page }) => {
  const document = fixture();
  document.dataSources.records.fields.name.queryField = '客户'; document.dataSources.records.fields.value.queryField = '金额';
  document.dataSources.records.source = { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['客户'], output_metrics: ['金额'], order: { offset: 0, limit: 10 } }] } } };
  document.sections[0].components[0].props.pagination = { mode: 'query' };
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy(); window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: { async fetchData(query) {
      if (query.search) throw Object.assign(new Error('搜索能力未配置'), { code: 'DQE_CONFIG_ERROR' });
      return { rows: [{ name: '正常记录', value: 1 }], totalCount: 1 };
    } } });
  }, document);
  await expect(page.getByRole('cell', { name: '正常记录' })).toBeVisible();
  await page.getByRole('searchbox').fill('客户'); await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('cell', { name: '暂无数据' })).toBeVisible();
  await expect(page.getByText('搜索能力未配置')).toHaveCount(0);
  await page.getByRole('button', { name: '清空表格搜索' }).click();
  await expect(page.getByRole('cell', { name: '正常记录' })).toBeVisible();
});

test('variants and Tab tables retain individual search on narrow screens without titles', async ({ page }, testInfo) => {
  const document = fixture();
  const a = structuredClone(document.sections[0].components[0]); delete a.props.title;
  a.props.variant = 'reportCompact'; a.id = 'tab-a'; a.props.fit = 'container';
  const b = structuredClone(a); b.id = 'tab-b'; b.props.variant = 'forecastMatrix';
  document.sections[0].components = [{ id: 'tabs', type: 'tabContainer', layout: { span: 12 }, props: { tabs: [{ id: 'a', label: '第一表', component: a }, { id: 'b', label: '第二表', component: b }] } }];
  await page.setViewportSize({ width: 390, height: 900 }); await page.goto('/examples/inline.html');
  await page.evaluate(document => { window.runtime.destroy(); window.runtime = MetricCanvas.mount('#dashboard', { document }); }, document);
  await page.getByRole('searchbox').fill('客户25'); await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('cell', { name: '客户25' })).toBeVisible();
  await page.getByRole('tab', { name: '第二表' }).click(); await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('tab', { name: '第一表' }).click(); await expect(page.getByRole('searchbox')).toHaveValue('客户25');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('narrow-tab-search.png'), fullPage: true });
});

test('cancelling a complete-data fetch prevents a late response from downloading a file', async ({ page }) => {
  const document = fixture();
  document.dataSources.records.fields.name.queryField = '客户'; document.dataSources.records.fields.value.queryField = '金额';
  document.dataSources.records.source = { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['客户'], output_metrics: ['金额'], order: { offset: 0, limit: 10 } }] } } };
  document.sections[0].components[0].props.pagination = { mode: 'query' };
  const downloads: string[] = []; page.on('download', file => downloads.push(file.suggestedFilename()));
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    let calls = 0;
    window.runtime.destroy(); window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: { async fetchData() {
      const result = { rows: [{ name: '客户', value: 1 }], totalCount: 1 };
      if (++calls === 1) return result;
      return new Promise(resolve => { (window as any).finishCancelledExport = () => resolve(result); });
    } } });
  }, document);
  await expect(page.getByRole('cell', { name: '客户', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '导出' }).click();
  await page.getByRole('button', { name: '取消导出' }).click();
  await expect(page.getByRole('alert')).toContainText('导出已取消');
  await expect(page.getByRole('button', { name: '导出' })).toBeEnabled();
  await page.evaluate(() => { (window as any).finishCancelledExport(); });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(downloads).toEqual([]);
});

test('detail tables search and export only their scoped complete result', async ({ page }) => {
  const document = JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/detail-views.json', import.meta.url), 'utf8'));
  document.schemaVersion = '6.21';
  const detail = document.detailViews[0].components[0];
  detail.props.toolbar = { search: { fields: ['period'] }, export: { format: 'xlsx', filename: '客户趋势' } };
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy(); window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: { async fetchData() {
      return { rows: [{ period: '2026-01', value: 10 }, { period: '2026-02', value: 20 }], totalCount: 2 };
    } } });
  }, document);
  await page.getByRole('button', { name: '客户01', exact: true }).click();
  const search = page.getByRole('searchbox', { name: '表格搜索' });
  await search.fill('2026-02'); await search.press('Enter');
  await expect(page.getByRole('cell', { name: '2026-02', exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: '导出' }).click();
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await (await downloaded).path())!);
  expect(workbook.worksheets[0].rowCount).toBe(2);
  expect(workbook.worksheets[0].getCell('A2').value).toBe('2026-02');
});
