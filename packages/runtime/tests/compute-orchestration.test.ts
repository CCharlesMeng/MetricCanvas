import { describe, expect, it } from 'vitest';
import type { Page } from '@metriccanvas/page';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import type { DataGateway } from '../src/ports';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const subtotal = [
  {
    op: 'groupSubtotal' as const,
    groupBy: 'type',
    measures: ['amount'],
    rowKind: { field: 'row-kind' as const, value: 'subtotal' as const },
    labelSuffix: '合计'
  }
];

const rowKinds = (snapshots: PageDataSnapshots, sourceId: string) => {
  const snapshot = snapshots.get(sourceId);
  return snapshot?.status === 'ready'
    ? snapshot.rows.map((row) => [row.type, row.amount, row['row-kind']])
    : [];
};

function inlinePage(): Page {
  return {
    schemaVersion: '5.1',
    id: 'inline-compute',
    dataSources: {
      forecast: {
        fields: {
          type: { type: 'string', role: 'dimension' },
          'row-kind': { type: 'string', role: 'dimension', nullable: true },
          amount: { type: 'number', role: 'measure', collapsible: true, nullable: true }
        },
        compute: subtotal,
        source: {
          type: 'inline',
          rows: [
            { type: '类型A', amount: 100 },
            { type: '类型A', amount: 200 }
          ]
        }
      }
    },
    sections: [
      {
        id: 'body',
        components: [
          {
            id: 'grid',
            type: 'table',
            layout: { span: 12 },
            data: { main: 'forecast' },
            props: { columns: [{ field: 'type' }] }
          }
        ]
      }
    ]
  };
}

function queryPage(): Page {
  return {
    schemaVersion: '5.1',
    id: 'query-compute',
    dataSources: {
      forecast: {
        fields: {
          type: { queryField: '类型', type: 'string', role: 'dimension' },
          'row-kind': { type: 'string', role: 'dimension', nullable: true },
          amount: {
            queryField: '金额',
            type: 'number',
            role: 'measure',
            collapsible: true,
            nullable: true
          }
        },
        compute: subtotal,
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: {
              dsl_list: [
                {
                  output_dims: ['类型'],
                  output_metrics: ['金额'],
                  filter: { dims: [], metrics: [] },
                  order: {}
                }
              ]
            }
          }
        }
      }
    },
    sections: [
      {
        id: 'body',
        components: [
          {
            id: 'grid',
            type: 'table',
            layout: { span: 12 },
            data: { main: 'forecast' },
            props: { columns: [{ field: 'type' }] }
          }
        ]
      }
    ]
  };
}

/**
 * 计算阶段收敛在数据快照成型的同一处:两条路径都过算子,否则 inline 骨架
 * 与线上行为会分叉,而分叉只在真数据接入时才会暴露。
 */
describe('inline 与 query 两条路径都经过计算阶段', () => {
  it('inline 行同步进入快照时已折叠', () => {
    let snapshots: PageDataSnapshots = new Map();
    orchestrate(inlinePage(), {
      async fetchData() {
        throw new Error('inline 页面不应访问数据网关');
      }
    }).subscribe((next) => {
      snapshots = next;
    });

    expect(rowKinds(snapshots, 'forecast')).toEqual([
      ['类型A', 100, null],
      ['类型A', 200, null],
      ['类型A合计', 300, 'subtotal']
    ]);
  });

  it('远程执行结果落地时同样折叠', async () => {
    const gateway: DataGateway = {
      async fetchData() {
        return {
          rows: [
            { type: '类型A', amount: 100 },
            { type: '类型B', amount: 50 }
          ]
        };
      }
    };
    let snapshots: PageDataSnapshots = new Map();
    orchestrate(queryPage(), gateway).subscribe((next) => {
      snapshots = next;
    });
    await flush();

    expect(rowKinds(snapshots, 'forecast')).toEqual([
      ['类型A', 100, null],
      ['类型A合计', 100, 'subtotal'],
      ['类型B', 50, null],
      ['类型B合计', 50, 'subtotal']
    ]);
  });

  it('内嵌初始行同样折叠，不需要等一次远程执行', () => {
    const page = queryPage();
    const source = page.dataSources.forecast!.source;
    if (source.type !== 'query') throw new Error('测试固件应为 query 数据源');
    source.initial = {
      capturedAt: '2026-04-01T00:00:00Z',
      rows: [{ type: '类型A', amount: 100 }]
    };

    let snapshots: PageDataSnapshots = new Map();
    orchestrate(page, {
      async fetchData() {
        throw new Error('内嵌初始行命中时不应发起查询');
      }
    }).subscribe((next) => {
      snapshots = next;
    });

    expect(rowKinds(snapshots, 'forecast')).toEqual([
      ['类型A', 100, null],
      ['类型A合计', 100, 'subtotal']
    ]);
  });
});
