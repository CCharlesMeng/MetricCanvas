import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { chooseSearch, openResult, recordRequests, resultSearch, resultSort, selectResult } from './rep-business-result-complete-fixture';

const ExcelJS: typeof import('../../../packages/engine/node_modules/exceljs') = createRequire(import.meta.url)('../../../packages/engine/node_modules/exceljs');

async function downloadedWorkbook(page: Page, action: () => Promise<void>) {
  const downloaded = page.waitForEvent('download');
  await action();
  const file = await downloaded, workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await file.path())!);
  return workbook.worksheets[0];
}

test('1205 business keys: all three members sort globally, filters survive switching members and both site records remain', async ({ page }) => {
  const { table, requests } = await openResult(page, 'business');
  await expect(table).toContainText('总条数： 1206');
  await resultSort(table, 'effectiveDate', 'desc');
  await expect(table.getByRole('cell', { name: 'B01205', exact: true })).toBeVisible();
  for (const field of ['expiryDate', 'businessValidityMonth']) {
    await resultSort(table, field, 'desc');
    await expect(table.getByRole('cell', { name: 'B01205', exact: true })).toBeVisible();
  }
  await resultSort(table, 'approvalDate');
  await expect(table.getByRole('cell', { name: 'B01205', exact: true })).toBeVisible();
  await selectResult(table, 'applicationType', '变更');
  await expect(table).toContainText('总条数： 1');
  await resultSort(table, 'monthlyFrameworkAmount');
  await expect(table).toContainText('总条数： 1');
  await expect(table.getByRole('cell', { name: 'B01205', exact: true })).toBeVisible();
  const main = recordRequests(requests, 'business');
  expect(main.map(item => item.order?.offset)).toEqual(expect.arrayContaining([0, 500, 1000]));
  expect(main.every(item => item.order?.limit === 500)).toBe(true);
  expect(await table.getByRole('cell', { name: 'B01206', exact: true }).count()).toBe(0);
});

test('business last page, exact search outside the first 1000 keys and complete Excel preserve both site rows', async ({ page }) => {
  const { table } = await openResult(page, 'business');
  await expect(table).toContainText('总条数： 1206');
  await table.getByRole('button', { name: '121', exact: true }).click();
  await expect(table.getByRole('cell', { name: 'B01205', exact: true })).toBeVisible();
  await resultSearch(table, 'B01205');
  await expect(table).toContainText('总条数： 1');
  await table.getByRole('button', { name: '清空表格搜索' }).click();
  await expect(table).toContainText('总条数： 1206');
  await resultSort(table, 'effectiveDate', 'desc');
  const sheet = await downloadedWorkbook(page, () => table.getByRole('button', { name: '导出', exact: true }).click());
  expect(sheet.rowCount).toBe(1207);
  expect(sheet.getRow(2).values).toEqual(expect.arrayContaining(['B01205']));
  expect(sheet.getRow(1206).values).toEqual(expect.arrayContaining(['B00001']));
  expect(sheet.getRow(1207).values).toEqual(expect.arrayContaining(['B00001']));
});

test('2410 risk records: reads every batch, sorts supplemental dates and filters across members without including outside contracts', async ({ page }, info) => {
  const { table, requests } = await openResult(page, 'contract');
  await expect(table).toContainText('总条数： 2410');
  await resultSort(table, 'activationTime', 'desc');
  await expect(table.getByRole('cell', { name: 'C01205', exact: true })).toHaveCount(2);
  await table.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(table.getByRole('cell', { name: 'C01200', exact: true })).toHaveCount(2);
  await selectResult(table, 'contractLevel', '合成重点级别');
  await expect(table).toContainText('总条数： 2');
  await selectResult(table, 'riskLevel', '高风险');
  await expect(table).toContainText('总条数： 1');
  await expect(table.getByRole('cell', { name: 'C01205', exact: true })).toHaveCount(1);
  const main = recordRequests(requests, 'contract');
  expect(main.map(item => item.order?.offset)).toEqual(expect.arrayContaining([0, 500, 1000, 1500, 2000]));
  expect(main.every(item => item.order?.limit === 500)).toBe(true);
  const keyCounts = requests.flatMap(item => (item.filter?.fields ?? []).filter(rule => rule.field_name === '合同ID').map(rule => rule.value_list.length));
  expect(keyCounts).toContain(500); expect(keyCounts).toContain(205);
  expect(Math.max(...keyCounts)).toBe(500);
  const domain = main.find(item => item.filter?.fields?.some(rule => rule.field_name === '账期'));
  expect(domain).toBeDefined();
  const basic = requests.filter(item => item.object_type === 'Contract/Customer Contract Basic Information');
  expect(basic.every(item => !item.filter?.fields?.some(rule => rule.field_name === '账期'))).toBe(true);
  await page.screenshot({ path: info.outputPath('risk-supplemental-sort-filter.png'), fullPage: true });
});

test('project/customer/contract exact search, zero results, clearing and full Excel retain all 2410 risk records', async ({ page }) => {
  const { table } = await openResult(page, 'contract');
  await expect(table).toContainText('总条数： 2410');
  await resultSort(table, 'activationTime', 'desc');
  await resultSearch(table, '合成目标项目');
  await expect(table).toContainText('总条数： 2410');
  const sheet = await downloadedWorkbook(page, () => table.getByRole('button', { name: '导出', exact: true }).click());
  expect(sheet.rowCount).toBe(2411);
  expect(sheet.getRow(2).values).toEqual(expect.arrayContaining(['C01205', '合成目标项目']));
  expect(sheet.getRow(2411).values).toEqual(expect.arrayContaining(['C00001', '合成目标项目']));
  await chooseSearch(page, table, '客户名称', '合成客户乙');
  await expect(table).toContainText('总条数： 6');
  await chooseSearch(page, table, '合同编号', 'C01205');
  await expect(table).toContainText('总条数： 2');
  await resultSearch(table, '不存在');
  await expect(table).toContainText('总条数： 0');
  await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
  await table.getByRole('button', { name: '清空表格搜索' }).click();
  await expect(table).toContainText('总条数： 2410');
});

test('missing supplemental information retains both risk records and sorts them on the last page', async ({ page }) => {
  const { table } = await openResult(page, 'contract', { missingBasic: true });
  await expect(table).toContainText('总条数： 2410');
  await resultSort(table, 'activationTime', 'desc');
  await expect(table.getByRole('cell', { name: 'C01204', exact: true })).toHaveCount(2);
  await table.getByRole('button', { name: '241', exact: true }).click();
  await expect(table.getByRole('cell', { name: 'C01205', exact: true })).toHaveCount(2);
  await expect(table).toContainText('总条数： 2410');
});

test('12002 risk records remain browsable beyond both batch size and the Excel row limit', async ({ page }) => {
  test.setTimeout(60000);
  const { table, requests } = await openResult(page, 'contract', { count: 6001 });
  await expect(table).toContainText('总条数： 12002', { timeout: 45000 });
  await table.getByRole('button', { name: '1201', exact: true }).click();
  await expect(table.getByRole('cell', { name: 'C06001', exact: true })).toHaveCount(2);
  await expect(table.locator('tbody tr')).toHaveCount(2);
  expect(recordRequests(requests, 'contract').map(item => item.order?.offset)).toContain(12000);
});

for (const state of ['empty', 'error'] as const) {
  test(`complete risk ${state} does not show a partial ready result`, async ({ page }) => {
    const { table } = await openResult(page, 'contract', { state });
    await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
    await expect(table.locator('tbody td[data-column-field="contractId"]')).toHaveCount(0);
  });
}

test('the business page accepts a risk query response after 150 seconds within its 180-second batch budget', async ({ page }) => {
  await page.clock.install();
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const { table, requests, releaseHeld } = await openResult(page, 'contract', { count: 1, holdFirstRisk: true });
  await expect.poll(() => recordRequests(requests, 'contract').length).toBe(1);
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));
  await page.clock.fastForward(150000);
  await expect(table.locator('.table-widget')).toHaveAttribute('aria-busy', 'true');
  expect(errors).toEqual([]);
  await releaseHeld();
  await expect(table).toContainText('总条数： 2');
  await expect(table.getByRole('cell', { name: 'C00001', exact: true })).toHaveCount(2);
  expect(errors).toEqual([]);
});
