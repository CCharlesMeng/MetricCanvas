import { expect, test, type Locator, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

const ExcelJS: typeof import('../../../packages/engine/node_modules/exceljs') = createRequire(import.meta.url)('../../../packages/engine/node_modules/exceljs');
const riskObject = 'Contract-Contract_Risk_Clause_Metric_Detail';
const basicObject = 'Contract/Customer Contract Basic Information';
type Row = Record<string, string>;
interface QueryItem {
  query_type?: string;
  object_type?: string;
  output_fields?: string[];
  filter?: { fields?: { field_name: string; value_list: string[]; operator?: string }[] };
  order?: { offset?: number; limit?: number; order_by_field?: string; type?: string };
}

const basicRows: Row[] = Array.from({ length: 30 }, (_, index) => ({
  合同ID: `C${String(index + 1).padStart(3, '0')}`,
  项目名称: index >= 17 ? '合成目标项目' : '合成其他项目',
  客户名称: [11, 23, 29].includes(index) ? '合成客户乙' : '合成客户甲',
  责任人名称: '合成责任人', 合同级别名称: '一级', 站点类型: '中国', 区域责任中心: '合成区域',
  合同激活时间: '2026-11-01', 实际生效时间: '2026-11-01', 实际失效时间: '2027-11-01'
}));
const riskRows: Row[] = basicRows.flatMap(row => ['高', '低'].map(level => ({
  合同ID: row.合同ID, 站点: '中国', 版本号: 'V1', 生效合同类型: '新增',
  创建时间: '2026-11-01', 审批开始时间: '2026-11-02', 审批结束时间: '2026-11-03',
  评审人姓名: '合成评审人', 专业要素: '合成要素', 审批人角色: '合成角色', 风险类别: '合成类别',
  风险等级: level, 子模块: '合成模块', 风险点: `合成风险${level}`, 对应风险条款: '合成条款',
  执行主体: '合成场景', 条款基线: '合成基线', 原始条款: '合成原文', 建议: '合成意见', 评审结论: '通过'
})));

function matches(row: Row, filter: NonNullable<QueryItem['filter']>['fields']): boolean {
  return (filter ?? []).every(rule => {
    // The transport fixture verifies the time predicate separately; business dates remain synthetic.
    if (rule.field_name === '账期') return true;
    return rule.value_list.includes(row[rule.field_name]);
  });
}

function largeFixture() {
  const basic = Array.from({ length: 1205 }, (_, index) => ({ ...basicRows[29], 合同ID: `L${String(index + 1).padStart(5, '0')}` }));
  const risk = basic.flatMap((row, index) => ['高', '低'].map(level => ({ ...riskRows[0], 合同ID: row.合同ID, 风险等级: level, 创建时间: String(1205 - index).padStart(5, '0') })));
  return { basic, risk };
}

function execute(item: QueryItem, overflow: boolean, fixtureData = { basic: basicRows, risk: riskRows }) {
  const source = item.object_type === riskObject ? fixtureData.risk : fixtureData.basic;
  if (![riskObject, basicObject].includes(item.object_type ?? '')) return { code: 'SUCCESS', data: [], total_count: 0 };
  const rows = source.filter(row => matches(row, item.filter?.fields));
  const sort = item.order?.order_by_field;
  if (sort) rows.sort((a, b) => a[sort].localeCompare(b[sort]) * (item.order?.type === 'desc' ? -1 : 1));
  const offset = item.order?.offset ?? 0, limit = item.order?.limit ?? rows.length;
  const data = rows.slice(offset, offset + limit).map(row => Object.fromEntries((item.output_fields ?? []).map(field => [field, row[field]])));
  const lookup = item.object_type === basicObject && item.filter?.fields?.some(rule => rule.field_name === '项目名称');
  return { code: 'SUCCESS', data, total_count: overflow && lookup ? 100001 : rows.length };
}

async function open(page: Page, overflow = false, large = false) {
  const data = large ? largeFixture() : undefined;
  const requests: QueryItem[] = [];
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const items: QueryItem[] = route.request().postDataJSON().dsl_list;
    requests.push(...items);
    await route.fulfill({ json: { retCode: 'CBC.0000', results: items.map(item => execute(item, overflow, data)) } });
  });
  await page.goto('/pages/rep-business-result');
  await page.getByRole('tab', { name: '合同风险率明细', exact: true }).click();
  const table = page.getByRole('tabpanel');
  await expect(table.getByRole('cell', { name: large ? 'L00001' : 'C001', exact: true })).toHaveCount(2);
  await expect(table).toContainText(large ? '总条数： 2410' : '总条数： 60');
  return { table, requests };
}

async function search(table: Locator, value: string) {
  await table.getByRole('searchbox').fill(value);
  await table.getByRole('searchbox').press('Enter');
}

async function choose(page: Page, table: Locator, label: string, value: string) {
  await table.getByRole('searchbox').fill(value);
  await table.getByRole('button', { name: '表格搜索字段', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

test('contract risk exact search preserves duplicate records, pagination, filters, sorting and full Excel export', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const { table, requests } = await open(page);
  await search(table, '合成目标项目');
  await expect(table).toContainText('总条数： 26');
  await expect(table.locator('tbody tr')).toHaveCount(10);
  await expect(table.getByRole('cell', { name: 'C018', exact: true })).toHaveCount(2);
  await table.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(table.getByRole('cell', { name: 'C023', exact: true })).toHaveCount(2);

  const downloaded = page.waitForEvent('download');
  await table.getByRole('button', { name: '导出', exact: true }).click();
  const file = await downloaded, workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await file.path())!);
  const sheet = workbook.worksheets[0];
  expect(sheet.rowCount).toBe(27);
  expect(sheet.getRow(2).values).toEqual(expect.arrayContaining(['C018', '合成目标项目', '高']));
  expect(sheet.getRow(27).values).toEqual(expect.arrayContaining(['C030', '合成目标项目', '低']));

  const filter = table.locator('th[data-column-field="riskLevel"]');
  await filter.locator('summary').click();
  await filter.getByRole('checkbox', { name: '高', exact: true }).check();
  await expect(table).toContainText('总条数： 13');
  await expect(table.getByRole('cell', { name: 'C018', exact: true })).toHaveCount(1);
  await filter.locator('summary').click();
  await table.locator('th[data-column-field="reviewCreateTime"] button').click();
  await expect(table.locator('th[data-column-field="reviewCreateTime"] [aria-label="排序:asc"]')).toBeVisible();
  const filteredDownload = page.waitForEvent('download');
  await table.getByRole('button', { name: '导出', exact: true }).click();
  const filteredFile = await filteredDownload, filteredWorkbook = new ExcelJS.Workbook();
  await filteredWorkbook.xlsx.readFile((await filteredFile.path())!);
  expect(filteredWorkbook.worksheets[0].rowCount).toBe(14);
  expect(filteredWorkbook.worksheets[0].getRow(14).values).toEqual(expect.arrayContaining(['C030', '高']));

  await choose(page, table, '客户名称', '合成客户乙');
  await expect(table).toContainText('总条数： 3');
  await expect(table.getByRole('cell', { name: 'C024', exact: true })).toHaveCount(1);
  await choose(page, table, '合同编号', 'C024');
  await expect(table).toContainText('总条数： 1');
  await expect(table.getByRole('cell', { name: 'C024', exact: true })).toHaveCount(1);
  await search(table, 'C24');
  await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
  await table.getByRole('button', { name: '清空表格搜索' }).click();
  await expect(table).toContainText('总条数： 30');
  await filter.locator('summary').click();
  await filter.getByRole('checkbox', { name: '高', exact: true }).uncheck();
  await expect(table).toContainText('总条数： 60');

  const filtered = requests.filter(item => item.filter?.fields?.some(rule => rule.field_name === '风险等级'));
  expect(filtered.length).toBeGreaterThan(0);
  expect(filtered.every(item => item.filter?.fields?.some(rule => rule.field_name === '账期'))).toBe(true);
  expect(requests.some(item => item.object_type === basicObject && item.filter?.fields?.some(rule => rule.field_name === '项目名称' && rule.operator === '='))).toBe(true);
  expect(requests.some(item => item.object_type === riskObject && item.filter?.fields?.some(rule => rule.field_name === '合同ID' && rule.value_list.length === 13))).toBe(true);
  await page.screenshot({ path: info.outputPath('contract-risk-search.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('contract risk search refuses an over-budget lookup without querying a partial main result', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const { table, requests } = await open(page, true);
  const start = requests.length;
  await search(table, '合成目标项目');
  await expect.poll(() => errors.some(message => message.includes('DQE_QUERY_REJECTED'))).toBe(true);
  await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
  // Independent candidate preloads may finish; no main record query may use a partial lookup.
  expect(requests.slice(start).filter(item => item.object_type === riskObject && item.output_fields?.includes('合同ID'))).toHaveLength(0);
});


test('contract risk searches more than 1000 contracts and exports the globally sorted complete result', async ({ page }) => {
  const { table, requests } = await open(page, false, true);
  await search(table, '合成目标项目');
  await expect(table).toContainText('总条数： 2410');
  await table.locator('th[data-column-field="reviewCreateTime"] button').click();
  await expect(table.getByRole('cell', { name: 'L01205', exact: true })).toHaveCount(2);
  const before = requests.filter(item => item.object_type === riskObject && item.output_fields?.includes('合同ID')).length;
  await table.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(table.getByRole('cell', { name: 'L01200', exact: true })).toHaveCount(2);
  const downloaded = page.waitForEvent('download');
  await table.getByRole('button', { name: '导出', exact: true }).click();
  const file = await downloaded, workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await file.path())!);
  const sheet = workbook.worksheets[0];
  expect(sheet.rowCount).toBe(2411);
  expect(sheet.getRow(2).values).toEqual(expect.arrayContaining(['L01205', '合成目标项目']));
  expect(sheet.getRow(2411).values).toEqual(expect.arrayContaining(['L00001', '合成目标项目']));
  expect(requests.filter(item => item.object_type === riskObject && item.output_fields?.includes('合同ID'))).toHaveLength(before);
  const counts = requests.flatMap(item => (item.filter?.fields ?? []).filter(rule => rule.field_name === '合同ID').map(rule => rule.value_list.length));
  expect(counts).toContain(1000); expect(counts).toContain(205); expect(Math.max(...counts)).toBe(1000);
  await table.getByRole('button', { name: '清空表格搜索' }).click();
  await expect(table).toContainText('总条数： 2410');
  const clearedDownload = page.waitForEvent('download');
  await table.getByRole('button', { name: '导出', exact: true }).click();
  const clearedFile = await clearedDownload, clearedWorkbook = new ExcelJS.Workbook();
  await clearedWorkbook.xlsx.readFile((await clearedFile.path())!);
  expect(clearedWorkbook.worksheets[0].rowCount).toBe(2411);
});
