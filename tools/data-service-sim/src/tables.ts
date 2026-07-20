/**
 * 种子表:形状按《中间层分析.md》§2.6/§3.2 的真实表(指标行式:metric_code/metric_value 列)。
 * 数据手写、量小、可手算——适配器与方言执行器测试的期望值由这里推得(独立事实)。
 * 与 catalog/snapshot.json 口径一致:指标 gmv/order-count/target-rate,维度 region/channel/stat-date(mtime 列)。
 */
export type SimRow = Record<string, string | number>;

export interface SimTable {
  serviceCode: string;
  serviceName: string;
  description?: string;
  columns: string[];
  rows: SimRow[];
}

const P001_ROWS: SimRow[] = [
  // gmv:2026-07-19 与 2026-07-20 两天 × 3 区域 × 2 渠道
  { mtime: '2026-07-19', region: '华东', channel: '线上', metric_code: 'gmv', metric_value: 100 },
  { mtime: '2026-07-19', region: '华东', channel: '线下', metric_code: 'gmv', metric_value: 50 },
  { mtime: '2026-07-19', region: '华北', channel: '线上', metric_code: 'gmv', metric_value: 80 },
  { mtime: '2026-07-19', region: '华北', channel: '线下', metric_code: 'gmv', metric_value: 40 },
  { mtime: '2026-07-19', region: '华南', channel: '线上', metric_code: 'gmv', metric_value: 60 },
  { mtime: '2026-07-19', region: '华南', channel: '线下', metric_code: 'gmv', metric_value: 30 },
  { mtime: '2026-07-20', region: '华东', channel: '线上', metric_code: 'gmv', metric_value: 120 },
  { mtime: '2026-07-20', region: '华东', channel: '线下', metric_code: 'gmv', metric_value: 70 },
  { mtime: '2026-07-20', region: '华北', channel: '线上', metric_code: 'gmv', metric_value: 90 },
  { mtime: '2026-07-20', region: '华北', channel: '线下', metric_code: 'gmv', metric_value: 45 },
  { mtime: '2026-07-20', region: '华南', channel: '线上', metric_code: 'gmv', metric_value: 65 },
  { mtime: '2026-07-20', region: '华南', channel: '线下', metric_code: 'gmv', metric_value: 35 },
  // order-count:仅 2026-07-20,3 区域(渠道不分)
  { mtime: '2026-07-20', region: '华东', channel: '线上', metric_code: 'order-count', metric_value: 11 },
  { mtime: '2026-07-20', region: '华北', channel: '线上', metric_code: 'order-count', metric_value: 7 },
  { mtime: '2026-07-20', region: '华南', channel: '线上', metric_code: 'order-count', metric_value: 5 },
  // target-rate:2026-07-20,3 区域
  { mtime: '2026-07-20', region: '华东', channel: '线上', metric_code: 'target-rate', metric_value: 82.5 },
  { mtime: '2026-07-20', region: '华北', channel: '线上', metric_code: 'target-rate', metric_value: 64 },
  { mtime: '2026-07-20', region: '华南', channel: '线上', metric_code: 'target-rate', metric_value: 47.5 }
];

export const tables: SimTable[] = [
  {
    serviceCode: 'P001_ADS_T_IOC_SPD_METRIC_ACC_D',
    serviceName: 'IOC 指标累计日表(仿真种子)',
    description: '指标行式:metric_code/metric_value;内置聚合字段 metric_value_sum 与 cnt',
    columns: ['mtime', 'region', 'channel', 'metric_code', 'metric_value'],
    rows: P001_ROWS
  },
  {
    serviceCode: 'F34_ioc',
    serviceName: 'IOC 收入汇总(仿真种子)',
    columns: ['cal2', 'dim', 'dim_value', 'metric_code', 'metric_value'],
    rows: [
      { cal2: '2026', dim: 'region', dim_value: '华东', metric_code: 'revenue-external_customer', metric_value: 1000 },
      { cal2: '2026', dim: 'region', dim_value: '华北', metric_code: 'revenue-external_customer', metric_value: 800 }
    ]
  }
];

/** MetricBaseInfo resolver 供数:与种子表中出现过的 metric_code 一致 */
export const metricBaseInfo = [
  { metric_code: 'gmv', metric_name_zh: '成交总额', scope: 'IOC' },
  { metric_code: 'order-count', metric_name_zh: '订单量', scope: 'IOC' },
  { metric_code: 'revenue-external_customer', metric_name_zh: '外部客户收入', scope: 'IOC' },
  { metric_code: 'target-rate', metric_name_zh: '目标完成率', scope: 'IOC' }
];

export function findTable(serviceCode: string): SimTable | undefined {
  return tables.find((t) => t.serviceCode === serviceCode);
}
