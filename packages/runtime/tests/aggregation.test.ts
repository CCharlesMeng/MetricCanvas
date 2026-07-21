import { describe, expect, it } from 'vitest';
import type { DataWidget, EffectiveQuery } from '@metriccanvas/page';
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
    const widget: DataWidget = {
      id: 'w-gmv',
      type: 'metricCard',
      position: { x: 0, y: 0, w: 3, h: 2 },
      query: { metrics: ['gmv'], aggregation: 'avg' }
    };

    const stream = orchestrate([widget], gateway);
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
