import { describe, expect, it } from 'vitest';
import type { EffectiveQuery, Page, Row } from '@metriccanvas/page';
import { createFilterState } from '../src/filter-state';
import { orchestrate } from '../src/orchestrator';
import type { DataGateway } from '../src/ports';

function page(): Page {
  return {
    schemaVersion: '2.0',
    id: 'dqe-runtime',
    filters: [
      {
        id: 'level-filter',
        type: 'dimension',
        dimension: 'customer-level',
        default: ['卓越NA']
      }
    ],
    dataSources: {
      overview: {
        fields: {
          'customer-level': {
            queryField: '客户级别',
            type: 'string',
            role: 'dimension'
          },
          'na-customer-count': {
            queryField: 'NA客户数',
            type: 'number',
            role: 'metric'
          }
        },
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: {
              dsl_list: [
                {
                  output_dims: ['客户级别'],
                  output_metrics: ['NA客户数'],
                  filter: {
                    dims: [
                      {
                        dim_name: '客户级别',
                        dim_value_list: ['卓越NA', '战略NA']
                      }
                    ],
                    metrics: []
                  },
                  order: {}
                }
              ]
            },
            filterBindings: {
              'level-filter': {
                target: 'dimension',
                queryField: '客户级别'
              }
            }
          }
        }
      }
    },
    sections: [
      {
        id: 'overview',
        layout: { type: 'grid', columns: 12 },
        components: [
          {
            id: 'card',
            type: 'metricCard',
            layout: { span: 4 },
            data: { main: 'overview' },
            props: {
              rows: [
                {
                  label: '卓越',
                  valueField: {
                    data: 'main',
                    field: 'na-customer-count',
                    match: { field: 'customer-level', equals: '卓越NA' }
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

describe('统一运行时编排 raw DQE 页面数据源', () => {
  it('把稳定字段契约和显式筛选绑定合成为 DQE 生效查询', async () => {
    const received: EffectiveQuery[] = [];
    const gateway: DataGateway = {
      async fetchData(query) {
        received.push(query);
        return [
          { 'customer-level': '卓越NA', 'na-customer-count': 15 }
        ] satisfies Row[];
      },
      async fetchDimensionValues() {
        return [];
      }
    };
    const filters = createFilterState();
    filters.write('level-filter', {
      type: 'dimension',
      dimension: 'customer-level',
      values: ['战略NA']
    });
    const snapshots: unknown[] = [];
    const unsubscribe = orchestrate(page(), gateway, filters).subscribe((value) =>
      snapshots.push(value)
    );

    await Promise.resolve();
    await Promise.resolve();
    unsubscribe();

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      metrics: ['na-customer-count'],
      dimensions: ['customer-level'],
      conditions: [],
      dqe: {
        fieldMappings: {
          'customer-level': {
            queryField: '客户级别',
            type: 'string',
            role: 'dimension'
          },
          'na-customer-count': {
            queryField: 'NA客户数',
            type: 'number',
            role: 'metric'
          }
        },
        filterValues: [
          {
            target: 'dimension',
            queryField: '客户级别',
            values: ['战略NA']
          }
        ]
      }
    });
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
  });
});
