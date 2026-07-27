import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CatalogSnapshot } from '@metriccanvas/page';
import { createCatalogDiscovery } from '@metriccanvas/catalog-discovery';
import type { DpCatalog } from '@metriccanvas/dp-catalog';
import type { PageLifecycle } from '@metriccanvas/page-lifecycle';
import type { TemplateLibrary } from '@metriccanvas/template-library';
import { createMemoryMetricFulfillment } from '@metriccanvas/metric-fulfillment';
import { createMetricCanvasMcpServer } from '@metriccanvas/mcp';

const snapshot: CatalogSnapshot = {
  formatVersion: '2.0',
  syncedAt: '2026-07-20T12:00:00.000Z',
  source: 'data-service-sim',
  metrics: [
    {
      code: 'gmv',
      name: '成交总额',
      valueType: 'decimal',
      availableDimensions: [],
      availableAggregations: ['sum']
    }
  ],
  dimensions: []
};

const unusedLifecycle: PageLifecycle = {
  saveRevision: async () => {
    throw new Error('本用例不应保存');
  },
  getRevision: async () => {
    throw new Error('本用例不应读取修订');
  },
  getPage: async () => {
    throw new Error('本用例不应读取页面');
  },
  listPages: async () => {
    throw new Error('本用例不应列出页面');
  },
  listRevisionHistory: async () => {
    throw new Error('本用例不应读取修订历史');
  },
  diffRevisions: async () => {
    throw new Error('本用例不应比较修订');
  },
  requestPublish: async () => {
    throw new Error('本用例不应申请发布');
  },
  getPublishRequest: async () => {
    throw new Error('本用例不应读取发布请求');
  },
  confirmPublish: async () => {
    throw new Error('MCP 不提供确认发布');
  },
  rejectPublish: async () => {
    throw new Error('MCP 不提供拒绝发布');
  },
  cancelPublish: async () => {
    throw new Error('本用例不应取消发布');
  },
  forceReleasePublish: async () => {
    throw new Error('MCP 不提供强制释放');
  },
  listPublishAudit: async () => {
    throw new Error('本用例不应读取发布审计');
  },
  rollbackRevision: async () => {
    throw new Error('本用例不应回滚');
  },
  getPublished: async () => {
    throw new Error('本用例不应读取已发布页面');
  },
  getPublishedRevision: async () => {
    throw new Error('本用例不应读取历史已发布页面修订');
  },
  close: async () => {}
};

const templates: Pick<TemplateLibrary, 'search'> = {
  search: async () => ({ matches: [] })
};

const dpCatalog: DpCatalog = {
  searchCandidates: async () => ({
    candidates: [
      {
        metric: {
          id: 'dp-metric-token-revenue',
          code: null,
          name: 'Tokens 总流水',
          definition: '统计 Tokens 使用产生的总流水。',
          dimensions: ['office', 'model'],
          aggregations: ['day', 'month'],
          status: 'draft',
          catalog: null,
          createdAt: '2026-07-22T00:00:00.000Z',
          updatedAt: '2026-07-22T00:00:00.000Z'
        },
        matchReasons: ['name_subsequence'],
        missingDimensions: [],
        missingAggregations: ['sum']
      }
    ]
  }),
  getMetric: async (id) =>
    id === 'dp-metric-token-revenue'
      ? {
          id,
          code: null,
          name: 'Tokens 总流水',
          definition: '统计 Tokens 使用产生的总流水。',
          dimensions: ['office', 'model'],
          aggregations: ['day', 'month'],
          status: 'draft',
          catalog: null,
          createdAt: '2026-07-22T00:00:00.000Z',
          updatedAt: '2026-07-22T00:00:00.000Z'
        }
      : null
};

describe('MetricCanvas MCP 工具契约', () => {
  const closeCallbacks: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(closeCallbacks.splice(0).map((close) => close()));
  });

  it('通过 MCP client 发现页面管理工具并按业务名称检索指标', async () => {
    const metricFulfillment = createMemoryMetricFulfillment();
    const blueprint = await metricFulfillment.saveBlueprint(
      {
        blueprintId: null,
        pageId: 'tokens-operations',
        baseRevisionId: null,
        goal: 'Tokens 消耗分析',
        modules: [],
        metricRequests: [
          {
            requestKey: 'tokens-consumption',
            name: 'Tokens 消耗量',
            definition: '输入与输出 Tokens 总量',
            requiredDimensions: ['office', 'model'],
            requiredAggregations: ['sum'],
            necessity: 'required',
            suggestedBy: 'user',
            contextSummary: '主指标'
          }
        ],
        idempotencyKey: 'save-blueprint'
      },
      { actorId: 'developer-1', clientId: 'workbench' }
    );
    if (!blueprint.ok) throw new Error(blueprint.error.message);
    const server = createMetricCanvasMcpServer({
      catalog: createCatalogDiscovery({
        current: async () => ({ version: 'catalog-v1', snapshot })
      }),
      dpCatalog,
      metricFulfillment,
      lifecycle: unusedLifecycle,
      templates,
      context: () => ({ actorId: 'developer-1', clientId: 'workbench' }),
      metricFulfillmentContext: () => ({
        actorId: 'developer-1',
        clientId: 'workbench'
      }),
      previewUrl: ({ pageId, revisionId }) =>
        `https://runtime.example/previews/${pageId}/${revisionId}`
    });
    const client = new Client({ name: 'contract-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    closeCallbacks.push(async () => {
      await client.close();
      await server.close();
    });

    const listed = await client.listTools();
    expect(listed.tools.map(({ name }) => name)).toEqual([
      'search_catalog',
      'search_metric_candidates',
      'get_metric_status',
      'record_metric_gap',
      'search_templates',
      'validate_page',
      'save_page',
      'list_pages',
      'get_page',
      'preview_page',
      'request_publish'
    ]);
    const prompt = await client.getPrompt({ name: 'build_dashboard_page' });
    const promptText = JSON.stringify(prompt);
    expect(promptText).toContain('\\"schemaVersion\\":\\"2.0\\"');
    expect(promptText).toContain('\\"dataSources\\"');
    expect(promptText).toContain('\\"sections\\"');
    expect(promptText).toContain('\\"components\\"');
    expect(promptText).toContain('\\"data\\":{\\"main\\":\\"main\\"}');
    expect(promptText).toContain('\\"type\\":\\"metricCard\\"');
    expect(promptText).not.toContain('\\"formatVersion\\"');
    expect(promptText).not.toContain('\\"widgets\\"');
    expect(promptText).toContain('get_page(selector=latest)');
    expect(promptText).toContain('不得再次请求页面 id 确认');
    expect(promptText).toContain('类别比较用 barChart');
    expect(promptText).toContain('时间变化用 lineChart');
    expect(promptText).toContain('mock 数据网关');
    expect(promptText).toContain('明确要求发布');
    expect(promptText).toContain('search_templates');
    expect(promptText).toContain('新的看板页面 id');
    expect(promptText).toContain('当前元数据重新校验');
    expect(promptText).toContain('严禁使用占位页面 id');
    expect(promptText).toContain('不得用普通文本询问页面 id');
    expect(promptText).toContain('先直接调用 validate_page');
    expect(promptText).toContain('只有校验结果指出元数据缺口');
    expect(promptText).toContain('search_metric_candidates');
    expect(promptText).toContain('不得自动选择');

    const resources = await client.listResources();
    expect(resources.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uri: 'metriccanvas://page/components' })
      ])
    );
    const componentResource = await client.readResource({
      uri: 'metriccanvas://page/components'
    });
    const componentText = componentResource.contents
      .map((content) => ('text' in content ? content.text : ''))
      .join('');
    expect(componentText).toContain('"type":"metricCard"');
    expect(componentText).toContain('"type":"lineChart"');
    expect(componentText).toContain('"type":"table"');

    const result = await client.callTool({
      name: 'search_catalog',
      arguments: { query: '成交总额', limit: 10 }
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({
      ok: true,
      metadataVersion: 'catalog-v1',
      matches: [
        {
          kind: 'metric',
          code: 'gmv',
          name: '成交总额',
          valueType: 'decimal',
          availableDimensions: [],
          availableAggregations: ['sum']
        }
      ]
    });

    const candidates = await client.callTool({
      name: 'search_metric_candidates',
      arguments: {
        query: 'Tokens消耗',
        requiredDimensions: ['office', 'model'],
        requiredAggregations: ['sum', 'day', 'month']
      }
    });
    expect(candidates.isError).not.toBe(true);
    expect(candidates.structuredContent).toEqual({
      ok: true,
      candidates: [
        expect.objectContaining({
          metric: expect.objectContaining({
            id: 'dp-metric-token-revenue',
            status: 'draft'
          }),
          missingAggregations: ['sum']
        })
      ]
    });

    const metric = await client.callTool({
      name: 'get_metric_status',
      arguments: { metricId: 'dp-metric-token-revenue' }
    });
    expect(metric.isError).not.toBe(true);
    expect(metric.structuredContent).toEqual({
      ok: true,
      metric: expect.objectContaining({
        id: 'dp-metric-token-revenue',
        code: null,
        status: 'draft'
      })
    });

    const recorded = await client.callTool({
      name: 'record_metric_gap',
      arguments: {
        blueprintId: blueprint.snapshot.blueprint.blueprintId,
        requestId: blueprint.snapshot.requests[0]?.requestId,
        reviewerId: 'reviewer-data-1',
        userConfirmed: true,
        idempotencyKey: 'record-gap-1'
      }
    });
    expect(recorded.isError).not.toBe(true);
    expect(recorded.structuredContent).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        requests: [
          expect.objectContaining({
            status: 'awaiting_data_development_confirmation',
            reviewerId: 'reviewer-data-1'
          })
        ]
      })
    });

    const templateResult = await client.callTool({
      name: 'search_templates',
      arguments: { query: '经营', limit: 5 }
    });
    expect(templateResult.isError).not.toBe(true);
    expect(templateResult.structuredContent).toEqual({
      ok: true,
      matches: []
    });
  });
});
