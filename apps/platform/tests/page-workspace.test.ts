import { describe, expect, it } from 'vitest';
import type { CatalogSnapshot, Page } from '@metriccanvas/page';
import {
  createPageWorkspace,
  reducePageWorkspace,
  workspaceIsDirty
} from '../src/lib/page-workspace';

const document: Page = {
  schemaVersion: '1.0',
  id: 'sales-overview',
  dataSources: {
    summary: {
      fields: { gmv: { type: 'number', role: 'metric', label: '成交总额' } },
      source: { type: 'query', query: { metrics: ['gmv'], aggregation: 'sum' } }
    },
    byRegion: {
      fields: {
        region: { type: 'string', role: 'dimension', label: '区域' },
        gmv: { type: 'number', role: 'metric', label: '成交总额' }
      },
      source: {
        type: 'query',
        query: {
          metrics: ['gmv'],
          dimensions: ['region'],
          aggregation: 'sum',
          orderBy: [{ field: 'gmv', direction: 'desc' }],
          limit: 8
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
          id: 'gmv',
          type: 'metricCard',
          layout: { span: 3 },
          data: { main: 'summary' },
          props: { title: '成交总额', rows: [{ label: '成交总额', valueField: 'gmv' }] }
        },
        {
          id: 'region',
          type: 'barChart',
          layout: { span: 9 },
          data: { main: 'byRegion' },
          props: {
            title: '区域成交对比',
            categoryField: 'region',
            series: [{ field: 'gmv', label: '成交总额' }]
          }
        }
      ]
    }
  ]
};

const catalog: CatalogSnapshot = {
  formatVersion: '1.0',
  syncedAt: '2026-07-21T00:00:00.000Z',
  source: 'page-workspace-test',
  metrics: [
    {
      code: 'gmv',
      name: '成交总额',
      valueType: 'decimal',
      availableDimensions: ['region', 'channel'],
      availableAggregations: ['sum', 'avg']
    },
    {
      code: 'order-count',
      name: '订单量',
      valueType: 'integer',
      availableDimensions: ['region', 'channel'],
      availableAggregations: ['sum']
    }
  ],
  dimensions: [
    { code: 'region', name: '区域', cardinality: 4 },
    { code: 'channel', name: '渠道', cardinality: 3 }
  ]
};

describe('页面搭建工作台的未保存工作副本', () => {
  it('人工编辑和 Agent 修改进入同一撤销历史，组件选择不污染历史', () => {
    const initial = createPageWorkspace({
      document,
      baseRevisionId: 'revision-3',
      revisionNumber: 3
    });
    const selected = reducePageWorkspace(initial, {
      type: 'select_component',
      locator: { sectionId: 'overview', componentId: 'gmv' }
    });
    const manuallyEdited = reducePageWorkspace(selected, {
      type: 'edit_component',
      locator: { sectionId: 'overview', componentId: 'gmv' },
      edit: { span: 5 }
    });
    const agentDocument = structuredClone(manuallyEdited.current);
    const agentComponent = agentDocument.sections[0]!.components[0]!;
    if (agentComponent.type !== 'metricCard') throw new Error('测试页面首组件应为指标卡');
    agentComponent.props.title = '核心成交额';
    const agentEdited = reducePageWorkspace(manuallyEdited, {
      type: 'apply_agent_document',
      document: agentDocument
    });

    expect(selected.past).toHaveLength(0);
    expect(agentEdited.past).toHaveLength(2);
    expect(agentEdited.current.sections[0]?.components[0]).toMatchObject({
      layout: { span: 5 },
      props: { title: '核心成交额' }
    });
    expect(workspaceIsDirty(agentEdited)).toBe(true);

    const undoAgent = reducePageWorkspace(agentEdited, { type: 'undo' });
    expect(undoAgent.current.sections[0]?.components[0]).toMatchObject({
      layout: { span: 5 },
      props: { title: '成交总额' }
    });
    const undoManual = reducePageWorkspace(undoAgent, { type: 'undo' });
    expect(undoManual.current.sections[0]?.components[0]?.layout.span).toBe(3);
    expect(workspaceIsDirty(undoManual)).toBe(false);
  });

  it('拖动排序和结构化编辑 query 页面数据源时同步字段契约与组件数据绑定', () => {
    const initial = createPageWorkspace({
      document,
      baseRevisionId: 'revision-3',
      revisionNumber: 3
    });
    const moved = reducePageWorkspace(initial, {
      type: 'move_component',
      locator: { sectionId: 'overview', componentId: 'region' },
      before: { sectionId: 'overview', componentId: 'gmv' }
    });
    const edited = reducePageWorkspace(moved, {
      type: 'edit_query_data_source',
      dataSourceId: 'byRegion',
      query: {
        metrics: ['order-count'],
        dimensions: ['channel'],
        aggregation: 'sum',
        orderBy: [{ field: 'order-count', direction: 'desc' }],
        limit: 5
      },
      catalog
    });

    expect(edited.current.sections[0]?.components.map((component) => component.id)).toEqual([
      'region',
      'gmv'
    ]);
    expect(edited.current.dataSources.byRegion).toEqual({
      fields: {
        channel: { type: 'string', role: 'dimension', label: '渠道' },
        'order-count': {
          type: 'number',
          role: 'metric',
          label: '订单量',
          format: 'number-grouped'
        }
      },
      source: {
        type: 'query',
        query: {
          metrics: ['order-count'],
          dimensions: ['channel'],
          aggregation: 'sum',
          orderBy: [{ field: 'order-count', direction: 'desc' }],
          limit: 5
        }
      }
    });
    expect(edited.current.sections[0]?.components[0]).toMatchObject({
      props: {
        categoryField: 'channel',
        series: [{ field: 'order-count', label: '订单量' }]
      }
    });
    expect(edited.past).toHaveLength(2);
  });
});
