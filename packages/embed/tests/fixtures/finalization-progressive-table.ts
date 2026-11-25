import type { PageDocument } from '@metriccanvas/page';
import type { QueryDataSource } from '@metriccanvas/page/internal';

export const finalizationName = '经营结果指标';
export const monthTitle = '折扣月环比';
export const discountMetric = '折扣变化';

function query(dimensions: string[], metrics: string[]): QueryDataSource['source'] {
  return {
    type: 'query',
    resultScope: 'complete',
    query: {
      language: 'dqe',
      body: { dsl_list: [{
        output_dims: dimensions,
        output_metrics: metrics,
        filter: { dims: [], metrics: [], time: { is_aggregate: true } },
        order: {}
      }] },
      filterBindings: { mtime: { target: 'time' }, customer: { target: 'dimension', queryField: '客户级别' } }
    }
  };
}

const region = { type: 'string', role: 'dimension', queryField: '区域' } as const;
const change = { type: 'number', role: 'measure', nullable: true } as const;

export const finalizationProgressiveTable: PageDocument = {
  schemaVersion: '6.135',
  id: 'finalization-progressive-table',
  layout: 'dashboard',
  filters: [{
    id: 'mtime', type: 'timeRange', display: 'period', precision: 'date', required: true,
    label: '统计期间', default: { mode: 'month', finalizationName }, periodModes: ['month', 'quarter', 'year']
  }, {
    id: 'customer', type: 'dimension', dimension: 'customer-class-code', display: 'select',
    label: '客户分类', emptyLabel: '客户分类', selection: { mode: 'multiple', allBehavior: 'values' },
    options: [{ label: '核心NA', value: '核心NA' }, { label: '商业客户', value: '商业客户' }]
  }],
  dataSources: {
    results: {
      fields: { region, amount: { type: 'number', role: 'measure', queryField: '金额' }, change },
      source: query(['区域'], ['金额']),
      compute: [{
        op: 'joinAggregate', source: 'discounts', keys: [{ local: 'region', foreign: 'region' }],
        values: [{ field: 'change', output: 'change', aggregate: 'unique' }], onMissing: 'null'
      }]
    },
    discounts: {
      fields: { region, change: { ...change, queryField: discountMetric } },
      source: query(['区域'], [discountMetric])
    },
    summary: {
      fields: { change: { ...change, queryField: discountMetric } },
      source: query([], [discountMetric])
    }
  },
  sections: [{
    id: 'header', container: 'plain', components: [{
      id: 'ioc-header', type: 'iocHeader', layout: { span: 12 },
      props: {
        identity: { title: finalizationName },
        components: [
          { id: 'period', type: 'filterControl', props: { filterId: 'mtime' } },
          { id: 'customer-control', type: 'filterControl', props: { filterId: 'customer' } }
        ]
      }
    }]
  }, {
    id: 'results', container: 'card', components: [{
      id: 'results-table', type: 'table', layout: { span: 12 },
      data: { main: 'results', summary: 'summary', discounts: 'discounts' },
      props: {
        columns: [
          { field: 'region', title: '区域', pinnedTop: { text: '合计' } },
          { field: 'amount', title: '金额' },
          {
            field: 'change', title: monthTitle,
            visibleWhen: { filter: 'mtime', part: 'mode', op: 'eq', value: 'month' },
            pinnedTop: { field: { data: 'summary', field: 'change' } }
          }
        ],
        // The discount source participates in both the table join and the shared page result.
        pinnedTop: { data: 'summary', additionalData: ['discounts'] }
      }
    }]
  }]
};
