import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import businessPage from '../../../pages/business/dashboard/ioc/approval/rep-office-execution-efficiency.json' with { type: 'json' };
const ExcelJS: typeof import('../../../packages/engine/node_modules/exceljs') = createRequire(import.meta.url)('../../../packages/engine/node_modules/exceljs');

interface QueryItem {
  query_type?: string; object_type?: string;
  output_dims?: string[]; output_metrics?: string[]; output_fields?: string[];
  filter?: { dims?: { dim_name: string; dim_value_list: (string | number)[]; operator?: string }[]; fields?: { field_name: string; value_list: (string | number)[]; operator?: string }[] };
  order?: { offset?: number; limit?: number };
}
const records = Array.from({ length: 24 }, (_, index) => ({
  商务编号: `B${String(index + 1).padStart(3, '0')}`, 项目名称: `合成项目${index + 1}`, 代表处: '合成代表处', 地区部: '合成地区部',
  责任人名称: (index + 1) % 12 === 0 ? '合成责任人乙' : '合成责任人甲', 客户名称: (index + 1) % 11 === 0 ? '合成客户乙' : '合成客户甲',
  商务类型: 0, 紧急决策开关: '否', '账期(month)': '2026-10', 阶段名称: '阶段A', 商审决策时长: index + 1, 商审决策人数: 3
}));
type SyntheticRow = Record<string, string | number>;

function execute(item: QueryItem) {
  const object = item.query_type === 'object';
  if (object && item.object_type !== 'Business/Basic Business Information') return { code: 'SUCCESS', data: [], total_count: 0 };
  const filters = object ? (item.filter?.fields ?? []).map(filter => ({ field: filter.field_name, values: filter.value_list, operator: filter.operator })) : (item.filter?.dims ?? []).map(filter => ({ field: filter.dim_name, values: filter.dim_value_list, operator: filter.operator }));
  const matching = records.filter(row => filters.every(filter => filter.operator === 'contains' ? String((row as SyntheticRow)[filter.field]).includes(String(filter.values[0])) : filter.values.includes((row as SyntheticRow)[filter.field])));
  const fields = object ? item.output_fields ?? [] : [...item.output_dims ?? [], ...item.output_metrics ?? []];
  const rows = !object && !item.output_dims?.length ? matching.slice(0, 1) : matching;
  const offset = item.order?.offset ?? 0, limit = item.order?.limit ?? rows.length;
  return { code: 'SUCCESS', total_count: rows.length, data: rows.slice(offset, offset + limit).map(row => Object.fromEntries(fields.map(field => [field, (row as SyntheticRow)[field] ?? 1]))) };
}

function receipt(item: QueryItem, mode: string) {
  const result = execute(item);
  if (mode === 'overflow' && item.filter?.fields?.some(filter => filter.field_name === '责任人名称')) return { ...result, total_count: 100001 };
  return result;
}

function slotSearchDocument(): unknown {
  const document = structuredClone(businessPage);
  const section = document.sections.find(item => item.id === 'detail-section');
  const props = section?.components.find(component => component.id === 'detail-tabs')?.props;
  if (!props || !('tabs' in props)) throw new Error('Expected detail tabs');
  const toolbar = props.tabs.find(tab => tab.id === 'approval-detail')?.component.props.toolbar;
  if (!toolbar) throw new Error('Expected approval detail search toolbar');
  Object.assign(toolbar, { search: { options: [
    { value: 'code', label: '商务编号', field: 'biz-code' },
    { value: 'owner', label: '责任人', field: { data: 'basic', field: 'owner-name' } },
    { value: 'customer', label: '客户名称', field: { data: 'basic', field: 'cust-company-name' } }
  ] } });
  return document;
}

async function open(page: Page, mode = 'ready') {
  const requests: QueryItem[] = [];
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const items: QueryItem[] = route.request().postDataJSON().dsl_list;
    requests.push(...items);
    await route.fulfill({ json: { retCode: 'CBC.0000', results: items.map(item => receipt(item, mode)) } });
  });
  await page.goto('/preview');
  await page.getByRole('textbox', { name: 'Page JSON 编辑器' }).fill(JSON.stringify(slotSearchDocument()));
  const table = page.getByRole('tabpanel');
  await expect(table.getByRole('cell', { name: 'B001', exact: true })).toBeVisible();
  return { table, requests };
}

test('business approval detail searches owner and customer across all pages and clears to the original scope', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const { table, requests } = await open(page);
  await table.getByRole('button', { name: '表格搜索字段', exact: true }).click();
  await page.getByRole('option', { name: '责任人', exact: true }).click();
  const beforeSearch = requests.length;
  await table.getByRole('searchbox').fill('责任人乙');
  await table.getByRole('searchbox').press('Enter');
  await expect(table.getByRole('cell', { name: 'B012', exact: true })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'B024', exact: true })).toBeVisible();
  await expect(table).toContainText('总条数： 2');
  const lookups = requests.slice(beforeSearch).filter(item => item.filter?.fields?.some(filter => filter.field_name === '责任人名称'));
  expect(lookups).toHaveLength(1);
  expect(lookups[0].filter?.fields).toEqual([{ field_name: '责任人名称', value_list: ['责任人乙'], operator: 'contains' }]);
  await page.screenshot({ path: info.outputPath('owner-slot-search.png'), fullPage: true });
  const downloaded = page.waitForEvent('download');
  await table.getByRole('button', { name: '导出', exact: true }).click();
  const file = await downloaded, workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await file.path())!);
  const sheet = workbook.worksheets[0];
  expect(sheet.rowCount).toBe(3);
  expect(sheet.getRow(2).values).toEqual(expect.arrayContaining(['B024', '合成责任人乙']));
  expect(sheet.getRow(3).values).toEqual(expect.arrayContaining(['B012', '合成责任人乙']));
  await table.getByRole('searchbox').fill('客户乙');
  await table.getByRole('button', { name: '表格搜索字段', exact: true }).click();
  await page.getByRole('option', { name: '客户名称', exact: true }).click();
  await expect(table.getByRole('cell', { name: 'B011', exact: true })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'B022', exact: true })).toBeVisible();
  await expect(table).toContainText('总条数： 2');
  await table.getByRole('searchbox').fill('不存在的客户');
  await table.getByRole('searchbox').press('Enter');
  await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
  await table.getByRole('button', { name: '清空表格搜索' }).click();
  await expect(table.getByRole('cell', { name: 'B001', exact: true })).toBeVisible();
  await expect(table).toContainText('总条数： 24');
  expect(errors).toEqual([]);
});

test('an over-budget lookup reports its error and does not issue a filtered main query', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const { table, requests } = await open(page, 'overflow');
  await table.getByRole('button', { name: '表格搜索字段', exact: true }).click();
  await page.getByRole('option', { name: '责任人', exact: true }).click();
  await expect(table.getByRole('button', { name: '导出', exact: true })).toBeEnabled();
  const beforeSearch = requests.length;
  await table.getByRole('searchbox').fill('责任人乙');
  await table.getByRole('searchbox').press('Enter');
  await expect.poll(() => errors.some(message => message.includes('DQE_QUERY_REJECTED'))).toBe(true);
  await expect(table.getByText('暂无数据', { exact: true })).toBeVisible();
  expect(requests.slice(beforeSearch).filter(item => item.output_metrics?.includes('商审决策时长'))).toHaveLength(0);
});
