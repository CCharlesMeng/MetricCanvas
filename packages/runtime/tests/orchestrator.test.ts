import { describe, expect, it } from 'vitest';
import { QUERY_ERROR_CODES, type EffectiveQuery, type Page } from '@metriccanvas/page';
import { createFilterState } from '../src/filter-state';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import type { DataGateway, QueryDiagnosticContext } from '../src/ports';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function page(): Page {
  return {
    schemaVersion: '5.0',
    id: 'mixed-runtime',
    filters: [{
      id: 'region-filter',
      type: 'dimension',
      dimension: 'region',
      label: '区域'
    }],
    dataSources: {
      target: {
        fields: {
          target: { type: 'number', role: 'measure', nullable: false }
        },
        source: { type: 'inline', rows: [{ target: 100 }] }
      },
      sales: {
        fields: {
          region: {
            queryField: '地区',
            type: 'string',
            role: 'dimension',
            nullable: false
          },
          revenue: {
            queryField: '收入',
            type: 'number',
            role: 'measure',
            nullable: false
          }
        },
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: {
              dsl_list: [{
                output_dims: ['地区'],
                output_metrics: ['收入'],
                filter: { dims: [], metrics: [] },
                order: {}
              }]
            },
            filterBindings: {
              'region-filter': { target: 'dimension', queryField: '地区' }
            }
          }
        }
      }
    },
    sections: [{
      id: 'overview',
      components: [
        {
          id: 'target-card',
          type: 'metricCard',
          layout: { span: 4 },
          data: { main: 'target' },
          props: { rows: [{ label: '目标', valueField: 'target' }] }
        },
        {
          id: 'sales-table',
          type: 'table',
          layout: { span: 8 },
          data: { main: 'sales' },
          props: {
            columns: [
              { field: 'region', title: '区域' },
              { field: 'revenue', title: '收入' }
            ]
          }
        }
      ]
    }]
  };
}

describe('页面数据源快照编排', () => {
  it('inline 同步就绪，DQE 从 loading 进入 ready', async () => {
    const received: EffectiveQuery[] = [];
    const gateway: DataGateway = {
      async fetchData(query) {
        received.push(query);
        return { rows: [{ region: '华东', revenue: 42 }], totalCount: 1 };
      },
      async fetchDimensionValues() {
        return [];
      }
    };
    const pushes: PageDataSnapshots[] = [];
    const unsubscribe = orchestrate(page(), gateway).subscribe((value) => pushes.push(value));

    expect(pushes[0]?.get('target')).toEqual({
      status: 'ready',
      rows: [{ target: 100 }]
    });
    expect(pushes[0]?.get('sales')).toEqual({ status: 'loading' });
    await flush();
    expect(received[0]).toMatchObject({
      language: 'dqe',
      fieldMappings: {
        region: { queryField: '地区', role: 'dimension' },
        revenue: { queryField: '收入', role: 'measure' }
      },
      filterValues: []
    });
    expect(pushes.at(-1)?.get('sales')).toEqual({
      status: 'ready',
      rows: [{ region: '华东', revenue: 42 }],
      totalCount: 1
    });
    unsubscribe();
  });

  it('只在显式筛选绑定变化时重新执行，并写入 queryField', async () => {
    const received: EffectiveQuery[] = [];
    const filters = createFilterState();
    const gateway: DataGateway = {
      async fetchData(query) {
        received.push(query);
        return { rows: [], totalCount: 0 };
      },
      async fetchDimensionValues() {
        return [];
      }
    };
    const unsubscribe = orchestrate(page(), gateway, filters).subscribe(() => {});
    await flush();
    filters.write('region-filter', {
      type: 'dimension',
      dimension: 'region',
      values: ['华东']
    });
    await flush();
    expect(received).toHaveLength(2);
    expect(received[1]?.filterValues).toEqual([{
      target: 'dimension',
      queryField: '地区',
      values: ['华东']
    }]);
    unsubscribe();
  });

  it('默认入口直接使用内嵌初始行，非默认入口立即查询', async () => {
    const document = page();
    const source = document.dataSources.sales?.source;
    if (source?.type !== 'query') throw new Error('测试数据源必须为 query');
    source.initial = {
      capturedAt: '2026-08-04T00:00:00+08:00',
      rows: [{ region: '首屏', revenue: 10 }],
      totalCount: 1
    };
    let calls = 0;
    const gateway: DataGateway = {
      async fetchData() {
        calls += 1;
        return { rows: [{ region: '动态', revenue: 20 }], totalCount: 1 };
      },
      async fetchDimensionValues() {
        return [];
      }
    };
    const initialPushes: PageDataSnapshots[] = [];
    const initialStream = orchestrate(document, gateway);
    const unsubscribeInitial = initialStream.subscribe((value) => initialPushes.push(value));

    expect(initialPushes.at(-1)?.get('sales')).toEqual({
      status: 'ready',
      rows: [{ region: '首屏', revenue: 10 }],
      totalCount: 1
    });
    await flush();
    expect(calls).toBe(0);
    unsubscribeInitial();

    const filters = createFilterState();
    filters.write('region-filter', {
      type: 'dimension',
      dimension: 'region',
      values: ['华南']
    });
    const dynamicPushes: PageDataSnapshots[] = [];
    const unsubscribeDynamic = orchestrate(document, gateway, filters).subscribe((value) =>
      dynamicPushes.push(value)
    );
    expect(dynamicPushes.at(-1)?.get('sales')).toEqual({ status: 'loading' });
    await flush();
    expect(calls).toBe(1);
    expect(dynamicPushes.at(-1)?.get('sales')).toEqual({
      status: 'ready',
      rows: [{ region: '动态', revenue: 20 }],
      totalCount: 1
    });
    filters.write('region-filter', null);
    await flush();
    expect(calls).toBe(2);
    expect(dynamicPushes.at(-1)?.get('sales')).toEqual({
      status: 'ready',
      rows: [{ region: '动态', revenue: 20 }],
      totalCount: 1
    });
    unsubscribeDynamic();
  });

  it('动态查询失败进入错误态，不回退到内嵌初始行', async () => {
    const document = page();
    const source = document.dataSources.sales?.source;
    if (source?.type !== 'query') throw new Error('测试数据源必须为 query');
    source.initial = {
      capturedAt: '2026-08-04T00:00:00+08:00',
      rows: [{ region: '首屏', revenue: 10 }]
    };
    const filters = createFilterState();
    const pushes: PageDataSnapshots[] = [];
    const stream = orchestrate(document, {
      async fetchData() {
        throw new Error('查询失败');
      },
      async fetchDimensionValues() {
        return [];
      }
    }, filters);
    const unsubscribe = stream.subscribe((value) => pushes.push(value));

    filters.write('region-filter', {
      type: 'dimension',
      dimension: 'region',
      values: ['华东']
    });
    await flush();
    // 普通 Error 未携带查询错误分类,兜底为 UNKNOWN(issue #51)。
    expect(pushes.at(-1)?.get('sales')).toEqual({
      status: 'error',
      error: { code: 'UNKNOWN', message: '查询失败' }
    });
    unsubscribe();
  });

  it('数据快照错误态保留数据网关的稳定错误分类与安全上下文(表驱动)', async () => {
    const filterSentinel = '筛选哨兵值-华东机密';
    for (const code of QUERY_ERROR_CODES) {
      const document = page();
      const filters = createFilterState();
      const gateway: DataGateway = {
        async fetchData() {
          // 按结构携带分类,不依赖 DqeGatewayError 类(自定义网关同样成立)。
          throw Object.assign(new Error(`分类 ${code} 的脱值消息`), { code });
        },
        async fetchDimensionValues() {
          return [];
        }
      };
      const pushes: PageDataSnapshots[] = [];
      const unsubscribe = orchestrate(document, gateway, filters).subscribe((value) =>
        pushes.push(value)
      );
      filters.write('region-filter', {
        type: 'dimension',
        dimension: 'region',
        values: [filterSentinel]
      });
      await flush();

      const snapshot = pushes.at(-1)?.get('sales');
      expect(snapshot).toEqual({
        status: 'error',
        error: { code, message: `分类 ${code} 的脱值消息` }
      });
      // 安全上下文:快照错误序列化检索不到筛选值。
      expect(JSON.stringify(snapshot)).not.toContain(filterSentinel);
      unsubscribe();
    }
  });

  it('封闭集之外的 code 与非 Error 抛出都兜底为 UNKNOWN', async () => {
    for (const [thrown, expectedMessage] of [
      [Object.assign(new Error('未知分类'), { code: 'SOMETHING_ELSE' }), '未知分类'],
      ['字符串异常', '字符串异常']
    ] as const) {
      const gateway: DataGateway = {
        async fetchData() {
          throw thrown;
        },
        async fetchDimensionValues() {
          return [];
        }
      };
      const filters = createFilterState();
      const pushes: PageDataSnapshots[] = [];
      const unsubscribe = orchestrate(page(), gateway, filters).subscribe((value) =>
        pushes.push(value)
      );
      filters.write('region-filter', {
        type: 'dimension',
        dimension: 'region',
        values: ['华东']
      });
      await flush();
      expect(pushes.at(-1)?.get('sales')).toEqual({
        status: 'error',
        error: { code: 'UNKNOWN', message: expectedMessage }
      });
      unsubscribe();
    }
  });

  it('查询分页写入 offset，越界时回查最后有效页，筛选变化回到第一页', async () => {
    const document = page();
    const sales = document.dataSources.sales;
    if (sales.source.type !== 'query') throw new Error('测试数据源必须为 query');
    sales.source.query.body.dsl_list[0].order = { offset: 0, limit: 10 };
    sales.source.initial = {
      capturedAt: '2026-08-04T00:00:00+08:00',
      rows: Array.from({ length: 10 }, (_, index) => ({
        region: `首屏${index + 1}`,
        revenue: index + 1
      })),
      totalCount: 25
    };
    const table = document.sections[0]!.components[1];
    if (table?.type !== 'table') throw new Error('测试组件必须为 table');
    table.props.pagination = { mode: 'query' };
    const received: EffectiveQuery[] = [];
    const gateway: DataGateway = {
      async fetchData(query) {
        received.push(query);
        const offset = query.pagination?.offset ?? 0;
        return offset >= 25
          ? { rows: [], totalCount: 25 }
          : { rows: [{ region: `第${offset / 10 + 1}页`, revenue: offset }], totalCount: 25 };
      },
      async fetchDimensionValues() {
        return [];
      }
    };
    const filters = createFilterState();
    const pushes: PageDataSnapshots[] = [];
    const stream = orchestrate(document, gateway, filters);
    const unsubscribe = stream.subscribe((value) => pushes.push(value));

    expect(received).toHaveLength(0);
    stream.setQueryPage('sales', 5);
    await flush();
    await flush();
    expect(received.map((query) => query.pagination?.offset)).toEqual([50, 20]);
    expect(pushes.at(-1)?.get('sales')).toEqual({
      status: 'ready',
      rows: [{ region: '第3页', revenue: 20 }],
      totalCount: 25
    });

    filters.write('region-filter', {
      type: 'dimension',
      dimension: 'region',
      values: ['华东']
    });
    await flush();
    expect(received.at(-1)?.pagination).toEqual({ offset: 0, limit: 10 });

    stream.setQueryPageSize('sales', 20);
    await flush();
    expect(received.at(-1)?.pagination).toEqual({ offset: 0, limit: 20 });

    stream.setQueryPage('sales', 1);
    await flush();
    expect(received.at(-1)?.pagination).toEqual({ offset: 20, limit: 20 });
    unsubscribe();
  });

  it('生效查询携带查询诊断上下文:页面、页面修订与去重后的全部数据源 id', async () => {
    const contexts: Array<QueryDiagnosticContext | undefined> = [];
    const gateway: DataGateway = {
      async fetchData(_query, diagnosticContext) {
        contexts.push(diagnosticContext);
        return { rows: [{ region: '华东', revenue: 42 }], totalCount: 1 };
      },
      async fetchDimensionValues() {
        return [];
      }
    };
    const document = page();
    // 复制一份完全相同的查询数据源:生效查询去重后仍应指认两个数据源。
    document.dataSources['sales-copy'] = JSON.parse(
      JSON.stringify(document.dataSources.sales)
    ) as Page['dataSources'][string];
    document.sections[0]!.components.push({
      id: 'sales-table-copy',
      type: 'table',
      layout: { span: 8 },
      data: { main: 'sales-copy' },
      props: {
        columns: [
          { field: 'region', title: '区域' },
          { field: 'revenue', title: '收入' }
        ]
      }
    });

    const unsubscribe = orchestrate(document, gateway, undefined, {
      pageRevisionId: 'rev-9'
    }).subscribe(() => {});
    await flush();

    expect(contexts).toEqual([
      {
        pageId: 'mixed-runtime',
        pageRevisionId: 'rev-9',
        dataSourceIds: ['sales', 'sales-copy']
      }
    ]);
    unsubscribe();
  });
});
