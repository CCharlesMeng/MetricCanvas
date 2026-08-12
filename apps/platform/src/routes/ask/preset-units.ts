import type { ExecutedDataRequestUnit } from '@metriccanvas/mcp';
import type { DqeQueryDefinition, QueryFieldDefinition } from '@metriccanvas/page';

/**
 * /ask 最小竖切的预置取数单元（装配输入，与视图分离）。
 *
 * 查询定义与查询字段映射对齐 pages/ 下正式页面「销售明细（跨页下钻
 * 目标页）」的定义，命中 DQE 仿真的 sales-analytics 场景（维度
 * mtime/region/channel、指标 gmv/order-count、2026 年账期）。所有单元
 * 不带内嵌初始行：每个数字都由统一运行时经数据网关取自仿真，
 * 不留静态数据兜底。
 */

const salesTimeRange = {
  period: 'day',
  is_aggregate: false,
  start: '2026-01-01',
  end: '2026-12-31'
} as const;

const fieldContracts = {
  mtime: { queryField: 'mtime', type: 'date', role: 'dimension', label: '日期' },
  region: { queryField: 'region', type: 'string', role: 'dimension', label: '区域' },
  channel: { queryField: 'channel', type: 'string', role: 'dimension', label: '渠道' },
  gmv: {
    queryField: 'gmv',
    type: 'number',
    role: 'measure',
    label: '成交总额',
    defaultFormat: 'number-grouped'
  },
  'order-count': {
    queryField: 'order-count',
    type: 'number',
    role: 'measure',
    label: '订单数（单）',
    defaultFormat: 'number-grouped'
  }
} satisfies Record<string, QueryFieldDefinition>;

function salesQuery(outputDims: string[], outputMetrics: string[]): DqeQueryDefinition {
  return {
    language: 'dqe',
    body: {
      dsl_list: [
        {
          output_dims: outputDims,
          output_metrics: outputMetrics,
          filter: { time: salesTimeRange, dims: [], metrics: [] },
          order: {}
        }
      ]
    }
  };
}

export const askPresetUnits: ExecutedDataRequestUnit[] = [
  {
    dataSourceId: 'gmv-daily-trend',
    title: 'GMV 与订单数按日趋势',
    fields: {
      mtime: fieldContracts.mtime,
      gmv: fieldContracts.gmv,
      'order-count': fieldContracts['order-count']
    },
    query: salesQuery(['mtime'], ['gmv', 'order-count']),
    intent: 'trend'
  },
  {
    dataSourceId: 'gmv-by-region',
    title: 'GMV 按区域对比',
    fields: {
      region: fieldContracts.region,
      gmv: fieldContracts.gmv
    },
    query: salesQuery(['region'], ['gmv']),
    intent: 'comparison'
  },
  {
    dataSourceId: 'gmv-by-channel',
    title: 'GMV 渠道占比',
    fields: {
      channel: fieldContracts.channel,
      gmv: fieldContracts.gmv
    },
    query: salesQuery(['channel'], ['gmv']),
    intent: 'proportion'
  },
  {
    dataSourceId: 'daily-sales-rows',
    title: '销售明细',
    fields: {
      mtime: fieldContracts.mtime,
      region: fieldContracts.region,
      channel: fieldContracts.channel,
      gmv: fieldContracts.gmv
    },
    query: salesQuery(['mtime', 'region', 'channel'], ['gmv']),
    intent: 'detail'
  }
];
