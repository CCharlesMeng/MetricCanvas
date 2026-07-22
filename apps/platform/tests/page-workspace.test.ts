import { describe, expect, it } from 'vitest';
import {
  navigateErrors,
  validate,
  type CatalogSnapshot,
  type Page
} from '@metriccanvas/page';
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

  it('一次命令可新增五类维度数据组件及其合法 query 页面数据源', () => {
    const scenarios = [
      {
        kind: 'bar_chart',
        type: 'barChart',
        props: {
          categoryField: 'region',
          series: [{ field: 'order-count', label: '订单量' }]
        },
        query: {
          orderBy: [{ field: 'order-count', direction: 'desc' }],
          limit: 10
        }
      },
      {
        kind: 'line_chart',
        type: 'lineChart',
        props: {
          xField: 'region',
          series: [{ field: 'order-count', label: '订单量' }]
        },
        query: {
          orderBy: [{ field: 'region', direction: 'asc' }],
          limit: 100
        }
      },
      {
        kind: 'pie_chart',
        type: 'pieChart',
        props: { categoryField: 'region', valueField: 'order-count' },
        query: {
          orderBy: [{ field: 'order-count', direction: 'desc' }],
          limit: 10
        }
      },
      {
        kind: 'ranking_card',
        type: 'rankingCard',
        props: { nameField: 'region', valueField: 'order-count' },
        query: {
          orderBy: [{ field: 'order-count', direction: 'desc' }],
          limit: 10
        }
      },
      {
        kind: 'table',
        type: 'table',
        props: {
          columns: [
            { field: 'region', title: '区域' },
            { field: 'order-count', title: '订单量', sortable: true, align: 'right' }
          ]
        },
        query: {
          orderBy: [{ field: 'order-count', direction: 'desc' }],
          limit: 100
        }
      }
    ] as const;

    for (const scenario of scenarios) {
      const initial = createPageWorkspace({
        document,
        baseRevisionId: 'revision-3',
        revisionNumber: 3
      });
      const componentId = `orders-${scenario.kind.replaceAll('_', '-')}`;
      const dataSourceId = `${componentId}-source`;
      const inserted = reducePageWorkspace(initial, {
        type: 'insert_bound_component',
        component: {
          kind: scenario.kind,
          componentId,
          title: `区域订单量${scenario.type}`,
          metricCode: 'order-count',
          dimensionCode: 'region',
          span: scenario.kind === 'table' ? 12 : 6
        },
        placement: { sectionId: 'overview' },
        dataSource: {
          mode: 'create_query',
          dataSourceId,
          aggregation: 'sum'
        },
        catalog
      });

      expect(inserted).not.toBe(initial);
      expect(inserted.past).toHaveLength(1);
      expect(inserted.current.dataSources[dataSourceId]).toMatchObject({
        fields: {
          region: { role: 'dimension', label: '区域' },
          'order-count': { role: 'metric', label: '订单量' }
        },
        source: {
          type: 'query',
          query: {
            metrics: ['order-count'],
            dimensions: ['region'],
            aggregation: 'sum',
            ...scenario.query
          }
        }
      });
      expect(inserted.current.sections[0]?.components.at(-1)).toMatchObject({
        id: componentId,
        type: scenario.type,
        data: { main: dataSourceId },
        props: scenario.props
      });
      expect(validate(inserted.current, catalog)).toEqual([]);

      const undone = reducePageWorkspace(inserted, { type: 'undo' });
      expect(undone.current).toEqual(document);
      const redone = reducePageWorkspace(undone, { type: 'redo' });
      expect(redone.current).toEqual(inserted.current);
    }
  });

  it('维度数据组件只接受兼容维度和同时供给指标与维度的 query 页面数据源', () => {
    const initial = createPageWorkspace({
      document,
      baseRevisionId: 'revision-3',
      revisionNumber: 3
    });
    const input = {
      type: 'insert_bound_component' as const,
      component: {
        kind: 'bar_chart' as const,
        componentId: 'orders-by-region',
        title: '区域订单量',
        metricCode: 'order-count',
        dimensionCode: 'region',
        span: 6
      },
      placement: { sectionId: 'overview' },
      dataSource: { mode: 'reuse' as const, dataSourceId: 'summary' },
      catalog
    };

    expect(reducePageWorkspace(initial, input)).toBe(initial);

    const reused = reducePageWorkspace(initial, {
      ...input,
      component: {
        ...input.component,
        componentId: 'gmv-by-region',
        metricCode: 'gmv'
      },
      dataSource: { mode: 'reuse', dataSourceId: 'by-region' }
    });
    expect(reused.current.dataSources).toEqual(document.dataSources);
    expect(reused.current.sections[0]?.components.at(-1)).toMatchObject({
      id: 'gmv-by-region',
      type: 'barChart',
      data: { main: 'by-region' }
    });

    const catalogWithUnsupportedDimension: CatalogSnapshot = {
      ...catalog,
      dimensions: [
        ...catalog.dimensions,
        { code: 'product', name: '产品', cardinality: 20 }
      ]
    };
    expect(
      reducePageWorkspace(initial, {
        ...input,
        component: {
          ...input.component,
          dimensionCode: 'product'
        },
        dataSource: {
          mode: 'create_query',
          dataSourceId: 'orders-by-product-source',
          aggregation: 'sum'
        },
        catalog: catalogWithUnsupportedDimension
      })
    ).toBe(initial);
  });

  it('分区新增、改名、排序和删除均通过同一历史且删除时清理独占页面数据源', () => {
    const initial = createPageWorkspace({
      document,
      baseRevisionId: 'revision-3',
      revisionNumber: 3
    });
    const added = reducePageWorkspace(initial, {
      type: 'add_section',
      sectionId: 'details',
      title: '经营明细',
      afterSectionId: 'overview',
      component: { sectionId: 'overview', componentId: 'region' }
    });
    const renamed = reducePageWorkspace(added, {
      type: 'edit_section',
      sectionId: 'details',
      title: '区域明细'
    });
    const inserted = reducePageWorkspace(renamed, {
      type: 'insert_bound_component',
      component: {
        kind: 'table',
        componentId: 'orders-table',
        title: '区域订单明细',
        metricCode: 'order-count',
        dimensionCode: 'region',
        span: 12
      },
      placement: { sectionId: 'details' },
      dataSource: {
        mode: 'create_query',
        dataSourceId: 'orders-details',
        aggregation: 'sum'
      },
      catalog
    });
    const moved = reducePageWorkspace(inserted, {
      type: 'move_section',
      sectionId: 'details',
      direction: -1
    });

    expect(moved.current.sections.map((section) => section.id)).toEqual([
      'details',
      'overview'
    ]);
    expect(moved.current.sections[0]).toMatchObject({ title: '区域明细' });
    expect(validate(moved.current, catalog)).toEqual([]);

    const removed = reducePageWorkspace(moved, {
      type: 'remove_section',
      sectionId: 'details'
    });
    expect(removed.current.sections.map((section) => section.id)).toEqual(['overview']);
    expect(removed.current.dataSources['orders-details']).toBeUndefined();
    expect(reducePageWorkspace(removed, { type: 'undo' }).current).toEqual(moved.current);
    expect(
      reducePageWorkspace(initial, { type: 'remove_section', sectionId: 'overview' })
    ).toBe(initial);
  });

  it('维度筛选器原子更新声明和 query 页面数据源订阅，移除时清理订阅与页内联动', () => {
    const initial = createPageWorkspace({
      document,
      baseRevisionId: 'revision-3',
      revisionNumber: 3
    });
    const filtered = reducePageWorkspace(initial, {
      type: 'upsert_dimension_filter',
      filterId: 'f-region',
      dimensionCode: 'region',
      label: '区域',
      display: 'tabs',
      subscriptions: ['summary', 'by-region'],
      catalog
    });
    expect(filtered.current.filters).toEqual([
      {
        id: 'f-region',
        type: 'dimension',
        dimension: 'region',
        label: '区域',
        display: 'tabs'
      }
    ]);
    expect(
      filtered.current.dataSources.summary?.source.type === 'query'
        ? filtered.current.dataSources.summary.source.query.filters
        : null
    ).toEqual({ subscribe: ['f-region'] });
    expect(
      filtered.current.dataSources['by-region']?.source.type === 'query'
        ? filtered.current.dataSources['by-region'].source.query.filters
        : null
    ).toEqual({ subscribe: ['f-region'] });

    const linked = reducePageWorkspace(filtered, {
      type: 'set_component_interaction',
      locator: { sectionId: 'overview', componentId: 'region' },
      interaction: { mode: 'write_filter', filterId: 'f-region', field: 'region' }
    });
    expect(linked.current.sections[0]?.components[1]).toMatchObject({
      props: {
        actions: [{ on: 'click', writeFilter: 'f-region', field: 'region' }]
      }
    });
    expect(validate(linked.current, catalog)).toEqual([]);

    const removed = reducePageWorkspace(linked, {
      type: 'remove_filter',
      filterId: 'f-region'
    });
    expect(removed.current.filters).toBeUndefined();
    expect(
      removed.current.dataSources['by-region']?.source.type === 'query'
        ? removed.current.dataSources['by-region'].source.query.filters
        : null
    ).toBeUndefined();
    expect(removed.current.sections[0]?.components[1]).not.toHaveProperty('props.actions');
    expect(validate(removed.current, catalog)).toEqual([]);
  });

  it('跨页下钻只接受目标页同维度筛选器，并生成可跨文档校验的 navigate action', () => {
    const sourcePage: Page = {
      ...structuredClone(document),
      filters: [
        {
          id: 'f-region',
          type: 'dimension',
          dimension: 'region',
          label: '当前区域',
          display: 'select'
        }
      ]
    };
    const targetPage: Page = {
      ...structuredClone(document),
      id: 'sales-detail',
      filters: [
        {
          id: 'f-region',
          type: 'dimension',
          dimension: 'region',
          label: '目标区域',
          display: 'tabs'
        }
      ]
    };
    const initial = createPageWorkspace({
      document: sourcePage,
      baseRevisionId: 'revision-3',
      revisionNumber: 3
    });
    const configured = reducePageWorkspace(initial, {
      type: 'set_component_interaction',
      locator: { sectionId: 'overview', componentId: 'region' },
      interaction: {
        mode: 'navigate',
        pageId: targetPage.id,
        carryFilters: ['f-region'],
        targetFilterId: 'f-region',
        field: 'region',
        targetFilters: targetPage.filters ?? []
      }
    });

    expect(configured.current.sections[0]?.components[1]).toMatchObject({
      props: {
        actions: [
          {
            on: 'click',
            navigate: {
              page: 'sales-detail',
              carryFilters: ['f-region'],
              setFilters: { 'f-region': 'region' }
            }
          }
        ]
      }
    });
    expect(validate(configured.current, catalog)).toEqual([]);
    expect(
      navigateErrors(
        configured.current,
        new Set([configured.current.id, targetPage.id]),
        new Map([
          [configured.current.id, configured.current],
          [targetPage.id, targetPage]
        ])
      )
    ).toEqual([]);

    expect(
      reducePageWorkspace(initial, {
        type: 'set_component_interaction',
        locator: { sectionId: 'overview', componentId: 'region' },
        interaction: {
          mode: 'navigate',
          pageId: targetPage.id,
          carryFilters: [],
          targetFilterId: 'f-channel',
          field: 'region',
          targetFilters: [
            { id: 'f-channel', type: 'dimension', dimension: 'channel' }
          ]
        }
      })
    ).toBe(initial);
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
