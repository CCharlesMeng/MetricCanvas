import { describe, expect, it } from 'vitest';
import type { EffectiveQuery, Page } from '@metriccanvas/page';
import { createFilterState } from '../src/filter-state';
import { orchestrate, type PageDataSnapshots } from '../src/orchestrator';
import type { DataGateway } from '../src/ports';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function page(): Page {
  return {
    schemaVersion: '4.0',
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
      layout: { type: 'grid', columns: 12 },
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
        return [{ region: '华东', revenue: 42 }];
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
      rows: [{ region: '华东', revenue: 42 }]
    });
    unsubscribe();
  });

  it('只在显式筛选绑定变化时重新执行，并写入 queryField', async () => {
    const received: EffectiveQuery[] = [];
    const filters = createFilterState();
    const gateway: DataGateway = {
      async fetchData(query) {
        received.push(query);
        return [];
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
});
