import { expect, type Locator, type Page } from '@playwright/test';

type Value = string | number;
type Row = Record<string, Value>;
interface Rule { field_name: string; value_list: Value[] }
interface Dimension { dim_name: string; dim_value_list: Value[] }
export interface QueryItem {
  query_type?: string; object_type?: string;
  output_fields?: string[]; output_dims?: string[]; output_metrics?: string[];
  filter?: { fields?: Rule[]; dims?: Dimension[] };
  order?: { offset?: number; limit?: number; order_by_field?: string; type?: string };
}
interface Options { count?: number; missingBasic?: boolean; state?: 'empty' | 'error'; holdFirstRisk?: boolean }
const riskObject = 'Contract-Contract_Risk_Clause_Metric_Detail';
const basicObject = 'Contract/Customer Contract Basic Information';
const businessObject = 'Business/Basic Business Information';
const approvalObject = 'Business/Business Approval Details';
const serial = (index: number) => String(index + 1).padStart(5, '0');
const date = (index: number) => new Date(Date.UTC(2020, 0, index + 1)).toISOString().slice(0, 10);

function business(index: number, count: number): Row {
  return {
    商务编码: `B${serial(index)}`, 商务编号: `B${serial(index)}`, 商务ID: `B${serial(index)}`,
    站点: '合成站点甲', 框架已达成金额: index + 1, 框架目标消费金额: count - index, 框架执行率: 50,
    生效时间: date(index), 失效时间: date(index + 365), 特价审批通过时间: date(count - index),
    申请类型: index === count - 1 ? 'CHANGE' : 'CREATE', 客户名称: '合成客户',
    责任人名称: '合成责任人', 代表处: '合成代表处', 区域责任中心: '合成区域',
    销售纵队: '合成纵队', '商务有效期(月)': index + 1
  };
}
function contract(index: number, count: number): Row {
  return {
    合同ID: `C${serial(index)}`, 站点类型: '合成站点', 项目名称: '合成目标项目',
    客户名称: index >= count - 3 ? '合成客户乙' : '合成客户甲', 区域责任中心: '合成区域',
    责任人名称: '合成责任人', 合同激活时间: date(index), 实际生效时间: date(index), 实际失效时间: date(index + 365),
    合同级别名称: index === count - 1 ? '合成重点级别' : '一级'
  };
}
function risk(row: Row, index: number): Row {
  return {
    合同ID: row.合同ID, 站点: '合成站点', 版本号: 'V1', 生效合同类型: '新增',
    创建时间: date(index), 审批开始时间: date(index), 审批结束时间: date(index),
    评审人姓名: '合成评审人', 专业要素: '合成要素', 审批人角色: '合成角色', 风险类别: 'QUALITATIVE',
    风险等级: 'HIGH_RISK', 子模块: '合成模块', 风险点: '合成风险点', 对应风险条款: '合成条款',
    执行主体: 'ALL', 条款基线: '合成基线', 原始条款: '合成原文', 建议: '合成意见', 评审结论: 'DECISION_FINISHED'
  };
}
function populations(count: number, missingBasic: boolean) {
  const businesses = Array.from({ length: count }, (_, index) => business(index, count));
  const contracts = Array.from({ length: count }, (_, index) => contract(index, count));
  const businessDomain = [...businesses, { ...businesses[0], 站点: '合成站点乙' }];
  const contractDomain = contracts.flatMap((row, index) => [risk(row, index), { ...risk(row, index), 风险等级: 'LOW_RISK' }]);
  const contractBasic = contracts.filter((_, index) => !(missingBasic && index === count - 1));
  return {
    businessDomain, contractDomain,
    businessBasic: [...businesses, business(count, count)],
    businessApproval: [...businesses, business(count, count)],
    contractBasic: [...contractBasic, contract(count, count)]
  };
}
type Populations = ReturnType<typeof populations>;
function sourceRows(item: QueryItem, data: Populations): Row[] {
  if (item.output_dims?.includes('商务编码')) return data.businessDomain;
  switch (item.object_type) {
    case businessObject: return data.businessBasic;
    case approvalObject: return data.businessApproval;
    case riskObject: return data.contractDomain;
    case basicObject: return data.contractBasic;
    default: return [];
  }
}
function matches(row: Row, item: QueryItem): boolean {
  const fields = (item.filter?.fields ?? []).filter(rule => rule.field_name !== '账期');
  const dims = item.filter?.dims ?? [];
  return fields.every(rule => rule.value_list.includes(row[rule.field_name])) && dims.every(rule => rule.dim_value_list.includes(row[rule.dim_name]));
}
function execute(item: QueryItem, data: Populations, empty: boolean) {
  const rows = empty ? [] : sourceRows(item, data).filter(row => matches(row, item));
  const sort = item.order?.order_by_field;
  if (sort) rows.sort((a, b) => String(a[sort]).localeCompare(String(b[sort])) * (item.order?.type === 'desc' ? -1 : 1));
  const offset = item.order?.offset ?? 0, limit = item.order?.limit ?? rows.length;
  const fields = [...(item.output_fields ?? []), ...(item.output_dims ?? []), ...(item.output_metrics ?? [])];
  return { code: 'SUCCESS', total_count: rows.length, data: rows.slice(offset, offset + limit).map(row => Object.fromEntries(fields.map(field => [field, row[field]]))) };
}
export async function openResult(page: Page, tab: 'business' | 'contract', options: Options = {}) {
  const count = options.count ?? 1205;
  const data = populations(count, options.missingBasic ?? false), requests: QueryItem[] = [];
  let releaseHeld: (() => Promise<void>) | undefined;
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const items: QueryItem[] = route.request().postDataJSON().dsl_list;
    requests.push(...items);
    if (options.state === 'error') { await route.fulfill({ status: 503, body: 'Synthetic unavailable' }); return; }
    if (options.holdFirstRisk && !releaseHeld && items.some(item => item.object_type === riskObject)) {
      releaseHeld = () => route.fulfill({ json: { retCode: 'CBC.0000', results: items.map(item => execute(item, data, false)) } });
      return;
    }
    await route.fulfill({ json: { retCode: 'CBC.0000', results: items.map(item => execute(item, data, options.state === 'empty')) } });
  });
  await page.goto('/pages/rep-business-result');
  await page.getByRole('tab', { name: tab === 'business' ? '框架执行率明细' : '合同风险率明细', exact: true }).click();
  const panel = page.getByRole('tabpanel');
  const table = tab === 'business' ? panel.locator('[data-table-title="客户商务信息"]') : panel;
  return { table, panel, requests, count, releaseHeld: async () => { expect(releaseHeld).toBeDefined(); await releaseHeld!(); } };
}
export async function resultSearch(table: Locator, value: string) {
  await table.getByRole('searchbox').fill(value);
  await table.getByRole('searchbox').press('Enter');
}
export async function chooseSearch(page: Page, table: Locator, label: string, value: string) {
  await table.getByRole('searchbox').fill(value);
  await table.getByRole('button', { name: '表格搜索字段', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}
export async function selectResult(table: Locator, field: string, label: string) {
  const heading = table.locator(`th[data-column-field="${field}"]`);
  await heading.locator('summary').click();
  await heading.getByRole('checkbox', { name: label, exact: true }).check();
  await heading.locator('summary').click();
}
export async function resultSort(table: Locator, field: string, direction: 'asc' | 'desc' = 'asc') {
  const heading = table.locator(`th[data-column-field="${field}"]`);
  await heading.locator('.sort-toggle').click();
  if (direction === 'desc') await heading.locator('.sort-toggle').click();
  await expect(heading.locator(`[aria-label="排序:${direction}"]`)).toBeVisible();
}
export function recordRequests(requests: QueryItem[], tab: 'business' | 'contract') {
  return requests.filter(item => tab === 'business' ? item.output_dims?.includes('商务编码') : item.object_type === riskObject && item.output_fields?.includes('合同ID'));
}
