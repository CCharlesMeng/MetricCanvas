import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CatalogSnapshot } from '@metriccanvas/page';
import { createCatalogDiscovery } from '@metriccanvas/catalog-discovery';
import type { PageLifecycle } from '@metriccanvas/page-lifecycle';
import { createMetricCanvasMcpServer } from '@metriccanvas/mcp';

const snapshot: CatalogSnapshot = {
  formatVersion: '1.0',
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
  requestPublish: async () => {
    throw new Error('本用例不应申请发布');
  },
  getPublishRequest: async () => {
    throw new Error('本用例不应读取发布请求');
  },
  confirmPublish: async () => {
    throw new Error('MCP 不提供确认发布');
  },
  getPublished: async () => {
    throw new Error('本用例不应读取已发布页面');
  },
  close: async () => {}
};

describe('MetricCanvas MCP 工具契约', () => {
  const closeCallbacks: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(closeCallbacks.splice(0).map((close) => close()));
  });

  it('通过 MCP client 发现切片一工具并按业务名称检索指标', async () => {
    const server = createMetricCanvasMcpServer({
      catalog: createCatalogDiscovery({
        current: async () => ({ version: 'catalog-v1', snapshot })
      }),
      lifecycle: unusedLifecycle,
      context: () => ({ actorId: 'developer-1', clientId: 'workbench' }),
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
      'validate_page',
      'save_page',
      'preview_page',
      'request_publish'
    ]);
    const prompt = await client.getPrompt({ name: 'build_dashboard_page' });
    expect(JSON.stringify(prompt)).toContain('\\"type\\":\\"metricCard\\"');

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
  });
});
