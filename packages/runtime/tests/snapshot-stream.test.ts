import { describe, expect, it } from 'vitest';
import type { Page } from '@metriccanvas/page';
import type { DataGateway } from '../src/ports';
import { orchestrate } from '../src/orchestrator';

describe('统一页面快照流', () => {
  it('无数据组件页面同步推送空 Map，且不访问数据网关', () => {
    let calls = 0;
    const gateway: DataGateway = {
      async fetchData() {
        calls++;
        return { rows: [], totalCount: 0 };
      }
    };
    const stream = orchestrate(
      {
        schemaVersion: '5.0',
        id: 'text-only',
        dataSources: {},
        sections: [
          {
            id: 'content',
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
        return { rows: [{ gmv: 5 }], totalCount: 1 };
      }
    };
    const stream = orchestrate(
      {
        schemaVersion: '5.0',
        id: 'shared',
        dataSources: {
          sales: {
            fields: {
              gmv: {
                queryField: '成交总额',
                type: 'number',
                role: 'measure'
              }
            },
            source: {
              type: 'query',
              query: {
                language: 'dqe',
                body: {
                  dsl_list: [{
                    output_dims: [],
                    output_metrics: ['成交总额'],
                    filter: { dims: [], metrics: [] },
                    order: {}
                  }]
                }
              }
            }
          }
        },
        sections: [
          {
            id: 'main',
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

  it('仅被关联数据引用的数据源也会执行', async () => {
    let calls = 0;
    const stream = orchestrate(summaryPage(false), {
      async fetchData() {
        calls += 1;
        return { rows: [{ office: '华东', missing: 3 }], totalCount: 1 };
      }
    });
    const pushes: Array<ReadonlyMap<string, unknown>> = [];
    stream.subscribe((value) => pushes.push(value));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).toBe(1);
    expect(pushes.at(-1)?.get('inspection-progress')).toEqual({
      status: 'ready',
      rows: [{ office: '华东', missing: 3 }],
      totalCount: 1
    });
  });

  it('普通组件和 AI 总结共享同一数据源时只执行一次', async () => {
    let calls = 0;
    const stream = orchestrate(summaryPage(true), {
      async fetchData() {
        calls += 1;
        return { rows: [{ office: '华东', missing: 3 }], totalCount: 1 };
      }
    });
    stream.subscribe(() => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toBe(1);
  });
});

function summaryPage(includeTable: boolean): Page {
  return {
    schemaVersion: '5.0',
    id: 'summary-source',
    dataSources: {
      'inspection-progress': {
        fields: {
          office: { queryField: '代表处', type: 'string', role: 'dimension' },
          missing: { queryField: '未考察数', type: 'number', role: 'measure' }
        },
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: {
              dsl_list: [{
                output_dims: ['代表处'],
                output_metrics: ['未考察数'],
                filter: { dims: [], metrics: [] },
                order: {}
              }]
            }
          }
        }
      }
    },
    sections: [{
      id: 'main',
      components: [
        ...(includeTable
          ? [{
              id: 'table',
              type: 'table' as const,
              layout: { span: 6 },
              data: { main: 'inspection-progress' },
              props: { columns: [{ field: 'office', title: '代表处' }] }
            }]
          : []),
        {
          id: 'summary',
          type: 'aiSummary' as const,
          layout: { span: 6 },
          props: {
            promptTemplate: '只使用输入数据。',
            relatedData: {
              risk: {
                source: 'inspection-progress',
                description: '风险数据',
                fields: [{ field: 'missing', term: '未考察数' }]
              }
            }
          }
        }
      ]
    }]
  };
}
