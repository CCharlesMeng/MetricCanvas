import { createDqeGateway } from '@metriccanvas/engine/dqe';
import { sortTableRows } from '../../../packages/data-execution/src/runtime';

const categories = ['卓越NA', '战略NA', '核心NA', '商业客户'];

type Value = string | number | null;
type RawRow = Record<string, Value>;
interface FieldRule { field_name: string; value_list: (string | number)[]; operator?: string }
interface DimensionRule { dim_name: string; dim_value_list: (string | number)[]; operator?: string }
export interface ExecutionEfficiencyQuery {
  query_type?: string;
  object_type?: string;
  output_fields?: string[];
  output_dims?: string[];
  output_metrics?: string[];
  filter?: { fields?: FieldRule[]; dims?: DimensionRule[]; time?: { start?: string; end?: string } };
  order?: { offset?: number; limit?: number; order_by_field?: string; type?: 'asc' | 'desc' };
}

function business(index: number): RawRow {
  const serial = String(index + 1).padStart(5, '0');
  const date = new Date(Date.UTC(2026, 10, index + 1)).toISOString().slice(0, 10);
  const category = categories[index % categories.length];
  return {
    商务编号: `B${serial}`, 地区部: '合成地区部', 代表处: '合成代表处', 项目名称: `合成项目${serial}`,
    责任人名称: `合成责任人${index % 2}`, 客户名称: `合成客户${index % 2}`, 华为云账号: `account-${serial}`,
    商务类型: index % 2, 紧急决策开关: index % 3 === 0 ? 'ON' : 'OFF', 商务状态: 'APPROVED',
    生效时间: date, 商务级别名称: index % 2 === 0 ? '一级' : '二级',
    客户类型: category, 客户级别: category, 周期类型: 'monthly', 账期: '2026-11-01 00:00:00'
  };
}

function approvalRows(rows: RawRow[]): RawRow[] {
  return rows.flatMap((row, index) => [
    { ...row, '账期(month)': '202611', 阶段名称: '代表处SDT', 商审决策时长: index * 2 + 1, 商审决策人数: 3 },
    { ...row, '账期(month)': '202611', 阶段名称: '地区部SDT', 商审决策时长: index * 2 + 2, 商审决策人数: 5 }
  ]);
}

function contractRows(rows: RawRow[]): RawRow[] {
  return rows.map((row, index) => ({
    ...row,
    合同编码: `CT-${String(index + 1).padStart(3, '0')}`,
    合同ID: `CONTRACT-${index + 1}`,
    版本号: 'V1',
    合同类型: '销售合同',
    合同状态名称: '已生效',
    合同级别名称: '一级',
    合同电子流创建时间: row.生效时间,
    合同激活时间: row.生效时间,
    实际生效时间: row.生效时间,
    实际失效时间: '2027-11-01',
    合同生效日期: row.生效时间,
    合同失效日期: '2027-11-01'
  }));
}

function queryRows(item: ExecutionEfficiencyQuery, rows: RawRow[]): RawRow[] {
  if (item.object_type === 'Business/Basic Business Information') return rows;
  if (item.object_type === 'Region-Biz_Apply_Approved_Metric_Detail_Global') return [
    ...rows, { ...rows[0], 项目名称: '合成项目00001第二条明细', 账期: '2026-11-02 00:00:00' }
  ];
  if (item.object_type === 'Contract-Rep_Contract_Decision_Closure_Metric_Detail' ||
      item.object_type === 'Contract/Customer Contract Basic Information') return contractRows(rows);
  if (item.output_dims?.includes('阶段名称')) return approvalRows(rows);
  return [];
}

function matchesValue(value: Value, values: (string | number)[], operator = '='): boolean {
  if (operator === 'contains') return values.some(term => String(value).toLowerCase().includes(String(term).toLowerCase()));
  if (operator === '>=') return value !== null && value >= values[0];
  if (operator === '<=') return value !== null && value <= values[0];
  if (operator === '!=') return !values.includes(value as string | number);
  return values.includes(value as string | number);
}

function matchesField(row: RawRow, field: string, values: (string | number)[], operator?: string): boolean {
  const raw = row[field];
  const value = field === '账期' && /^\d{6}$/.test(String(values[0]))
    ? String(raw).slice(0, 7).replace('-', '') : raw;
  return matchesValue(value, values, operator);
}

function matchingRows(item: ExecutionEfficiencyQuery, rows: RawRow[]): RawRow[] {
  const { fields = [], dims = [], time } = item.filter ?? {};
  const from = time?.start?.replaceAll('-', '').slice(0, 6);
  const to = time?.end?.replaceAll('-', '').slice(0, 6);
  return rows.filter(row => {
    const month = String(row.账期).slice(0, 7).replace('-', '');
    return (!from || month >= from) && (!to || month <= to) &&
      fields.every(rule => matchesField(row, rule.field_name, rule.value_list, rule.operator)) &&
      dims.every(rule => matchesField(row, rule.dim_name, rule.dim_value_list, rule.operator));
  });
}

function summaryRows(item: ExecutionEfficiencyQuery, rows: RawRow[]): RawRow[] {
  const approvals = matchingRows(item, approvalRows(rows));
  if (!approvals.length) return [];
  return [{
    商审SDT平均决策时长: approvals.reduce((total, row) => total + Number(row.商审决策时长), 0) / approvals.length,
    商审SDT平均决策人数: 4,
    区域商审闭环率: 86,
    销售合同决策代表处闭环率: 92
  }];
}

function previewResultRows(item: ExecutionEfficiencyQuery, rows: RawRow[]): RawRow[] {
  if (item.output_metrics?.includes('商审SDT平均决策时长')) return summaryRows(item, rows);
  return matchingRows(item, queryRows(item, rows));
}

/** Synthetic November 2026 data evaluated through the IOC page's existing DQE bindings. */
export function createExecutionEfficiencyTabPreview() {
  const rows = Array.from({ length: 16 }, (_, index) => business(index));
  return createDqeGateway({ fetchImpl: async (_url, init) => {
    const { dsl_list: items } = JSON.parse(String(init?.body)) as { dsl_list: ExecutionEfficiencyQuery[] };
    return Response.json({ retCode: 'CBC.0000', results: items.map(item => execute(item, rows)) });
  } });
}

function execute(item: ExecutionEfficiencyQuery, rows: RawRow[]) {
  const matching = previewResultRows(item, rows);
  const ordered = item.order?.order_by_field
    ? sortTableRows(matching, [{ field: item.order.order_by_field, direction: item.order.type ?? 'asc' }])
    : matching;
  const offset = item.order?.offset ?? 0;
  const limit = item.order?.limit ?? ordered.length;
  const fields = [...item.output_fields ?? [], ...item.output_dims ?? [], ...item.output_metrics ?? []];
  return {
    code: 'SUCCESS',
    total_count: ordered.length,
    data: ordered.slice(offset, offset + limit).map(row => Object.fromEntries(fields.map(field => [field, row[field] ?? null])))
  };
}
