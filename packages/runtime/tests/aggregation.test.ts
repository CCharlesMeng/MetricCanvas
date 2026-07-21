import { describe, expect, it } from 'vitest';
import type { EffectiveQuery, Page } from '@metriccanvas/page';
import { orchestrate, type DataGateway } from '@metriccanvas/runtime';

describe('统一运行时的生效查询', () => {
  it('把页面声明的聚合方式原样交给数据网关', async () => {
    const received: EffectiveQuery[] = [];
    const gateway: DataGateway = {
      async fetchData(query) {
        received.push(query);
        return [{ gmv: 42 }];
      },
      async fetchDimensionValues() {
        return [];
      }
    };
    const page: Page = {
      schemaVersion: '1.0',
      id: 'aggregation',
      dataSources: {
        sales: {
          fields: {
            gmv: { type: 'number', role: 'metric' }
          },
          source: {
            type: 'query',
            query: { metrics: ['gmv'], aggregation: 'avg' }
          }
        }
      },
      sections: [
        {
          id: 'overview',
          layout: { type: 'grid', columns: 12 },
          components: [
            {
              id: 'w-gmv',
              type: 'metricCard',
              layout: { span: 3 },
              data: { main: 'sales' },
              props: {
                rows: [{ label: '成交总额', valueField: 'gmv' }]
              }
            }
          ]
        }
      ]
    };

    const stream = orchestrate(page, gateway);
    const unsubscribe = stream.subscribe(() => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribe();

    expect(received).toEqual([
      {
        metrics: ['gmv'],
        aggregation: 'avg',
        conditions: []
      }
    ]);
  });
});
