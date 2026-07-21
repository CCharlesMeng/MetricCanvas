import { describe, expect, it } from 'vitest';
import type { DataGateway } from '../src/ports';
import { orchestrate } from '../src/orchestrator';

describe('统一页面快照流', () => {
  it('无数据组件页面同步推送空 Map，且不访问数据网关', () => {
    let calls = 0;
    const gateway: DataGateway = {
      async fetchData() {
        calls++;
        return [];
      },
      async fetchDimensionValues() {
        return [];
      }
    };
    const stream = orchestrate(
      {
        schemaVersion: '1.0',
        id: 'text-only',
        dataSources: {},
        sections: [
          {
            id: 'content',
            layout: { type: 'grid', columns: 12 },
            components: [
              {
                id: 'intro',
                type: 'text',
                layout: { span: 12 },
                props: { body: '说明' }
              }
            ]
          }
        ]
      },
      gateway
    );
    const pushes: Array<ReadonlyMap<string, unknown>> = [];

    stream.subscribe((value) => pushes.push(value));
    stream.subscribe((value) => pushes.push(value));

    expect(pushes).toHaveLength(2);
    expect(pushes[0]).toBe(pushes[1]);
    expect(pushes[0].size).toBe(0);
    expect(calls).toBe(0);
  });

  it('编排器保持冷流，多订阅者共享同一会话', async () => {
    let calls = 0;
    const gateway: DataGateway = {
      async fetchData() {
        calls++;
        return [{ gmv: 5 }];
      },
      async fetchDimensionValues() {
        return [];
      }
    };
    const stream = orchestrate(
      {
        schemaVersion: '1.0',
        id: 'shared',
        dataSources: {
          sales: {
            fields: { gmv: { type: 'number', role: 'metric' } },
            source: { type: 'query', query: { metrics: ['gmv'] } }
          }
        },
        sections: [
          {
            id: 'main',
            layout: { type: 'grid', columns: 12 },
            components: [
              {
                id: 'card',
                type: 'metricCard',
                layout: { span: 4 },
                data: { main: 'sales' },
                props: { rows: [{ label: 'GMV', valueField: 'gmv' }] }
              }
            ]
          }
        ]
      },
      gateway
    );

    expect(calls).toBe(0);
    const first: unknown[] = [];
    const second: unknown[] = [];
    stream.subscribe((value) => first.push(value));
    await new Promise((resolve) => setTimeout(resolve, 0));
    stream.subscribe((value) => second.push(value));

    expect(calls).toBe(1);
    expect(second).toHaveLength(1);
    expect(second[0]).toBe(first.at(-1));
  });
});
