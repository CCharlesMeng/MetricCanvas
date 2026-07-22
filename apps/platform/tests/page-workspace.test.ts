import { describe, expect, it } from 'vitest';
import { validate, type CatalogSnapshot, type Page } from '@metriccanvas/page';
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
    'by-region': {
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
          data: { main: 'by-region' },
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
  it('新增指标卡和 query 页面数据源是一次可撤销的合法修改', () => {
    const initial = createPageWorkspace({
      document,
      baseRevisionId: 'revision-3',
      revisionNumber: 3
    });
    const inserted = reducePageWorkspace(initial, {
      type: 'insert_bound_component',
      component: {
        kind: 'metric_card',
        componentId: 'orders',
        title: '订单量',
        metricCode: 'order-count',
        span: 4
      },
      placement: {
        sectionId: 'overview',
        afterComponentId: 'gmv'
      },
      dataSource: {
        mode: 'create_query',
        dataSourceId: 'orders-summary',
        aggregation: 'sum'
      },
      catalog
    });

    expect(inserted.past).toHaveLength(1);
    expect(inserted.current.sections[0]?.components.map((component) => component.id)).toEqual([
      'gmv',
      'orders',
      'region'
    ]);
    expect(inserted.current.dataSources['orders-summary']).toEqual({
      fields: {
        'order-count': {
          type: 'number',
          role: 'metric',
          label: '订单量',
          format: 'number-grouped'
        }
      },
      source: {
        type: 'query',
        query: { metrics: ['order-count'], aggregation: 'sum' }
      }
    });
    expect(inserted.current.sections[0]?.components[1]).toEqual({
      id: 'orders',
      type: 'metricCard',
      layout: { span: 4 },
      data: { main: 'orders-summary' },
      props: {
        title: '订单量',
        rows: [{ label: '订单量', valueField: 'order-count' }]
      }
    });
    expect(validate(inserted.current, catalog)).toEqual([]);

    const undone = reducePageWorkspace(inserted, { type: 'undo' });
    expect(undone.current).toEqual(document);
    expect(undone.current.dataSources['orders-summary']).toBeUndefined();
  });

  it('删除指标卡时清理它独占的页面数据源，撤销同时恢复两者', () => {
    const initial = createPageWorkspace({
      document,
      baseRevisionId: 'revision-3',
      revisionNumber: 3
    });
    const inserted = reducePageWorkspace(initial, {
      type: 'insert_bound_component',
      component: {
        kind: 'metric_card',
        componentId: 'orders',
        title: '订单量',
        metricCode: 'order-count',
        span: 3
      },
      placement: { sectionId: 'overview' },
      dataSource: {
        mode: 'create_query',
        dataSourceId: 'orders-summary',
        aggregation: 'sum'
      },
      catalog
    });
    const removed = reducePageWorkspace(inserted, {
      type: 'remove_component',
      locator: { sectionId: 'overview', componentId: 'orders' }
    });

    expect(removed.current.sections[0]?.components.some((item) => item.id === 'orders')).toBe(
      false
    );
    expect(removed.current.dataSources['orders-summary']).toBeUndefined();
    expect(removed.past).toHaveLength(2);
    expect(validate(removed.current, catalog)).toEqual([]);

    const undone = reducePageWorkspace(removed, { type: 'undo' });
    expect(undone.current.dataSources['orders-summary']).toBeDefined();
    expect(undone.current.sections[0]?.components.some((item) => item.id === 'orders')).toBe(
      true
    );
  });

  it('可复用已有 query 页面数据源，删除其中一个组件不误删共享数据源', () => {
    const initial = createPageWorkspace({
      document,
      baseRevisionId: 'revision-3',
      revisionNumber: 3
    });
    const inserted = reducePageWorkspace(initial, {
      type: 'insert_bound_component',
      component: {
        kind: 'metric_card',
        componentId: 'gmv-secondary',
        title: '成交总额备用卡',
        metricCode: 'gmv',
        span: 3
      },
      placement: { sectionId: 'overview', afterComponentId: 'gmv' },
      dataSource: { mode: 'reuse', dataSourceId: 'summary' },
      catalog
    });
    const removed = reducePageWorkspace(inserted, {
      type: 'remove_component',
      locator: { sectionId: 'overview', componentId: 'gmv' }
    });

    expect(Object.keys(inserted.current.dataSources)).toEqual(['summary', 'by-region']);
    expect(removed.current.dataSources.summary).toBeDefined();
    expect(removed.current.sections[0]?.components[0]).toMatchObject({
      id: 'gmv-secondary',
      data: { main: 'summary' }
    });
    expect(validate(removed.current, catalog)).toEqual([]);
  });

  it('组件或页面数据源 id 冲突与非法时整条命令无副作用', () => {
    const initial = createPageWorkspace({
      document,
      baseRevisionId: 'revision-3',
      revisionNumber: 3
    });
    const input = {
      type: 'insert_bound_component' as const,
      component: {
        kind: 'metric_card' as const,
        componentId: 'gmv',
        title: '订单量',
        metricCode: 'order-count',
        span: 3
      },
      placement: { sectionId: 'overview' },
      dataSource: {
        mode: 'create_query' as const,
        dataSourceId: 'orders-summary',
        aggregation: 'sum'
      },
      catalog
    };

    expect(reducePageWorkspace(initial, input)).toBe(initial);
    expect(
      reducePageWorkspace(initial, {
        ...input,
        component: { ...input.component, componentId: 'orders' },
        dataSource: { ...input.dataSource, dataSourceId: 'orders_summary' }
      })
    ).toBe(initial);
  });

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
      dataSourceId: 'by-region',
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
    expect(edited.current.dataSources['by-region']).toEqual({
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
