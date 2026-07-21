import { describe, expect, it } from 'vitest';
import type { CatalogSnapshot } from '@metriccanvas/page';
import { createCatalogDiscovery } from '@metriccanvas/catalog-discovery';
import type { PageLifecycle } from '@metriccanvas/page-lifecycle';
import { createAgentRunner, createScriptedModelProvider } from '@metriccanvas/agent-runner';
import {
  connectInProcessMetricCanvasMcp,
  createMetricCanvasMcpServer
} from '@metriccanvas/mcp';

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

const unusedLifecycle = {
  saveRevision: async () => {
    throw new Error('未调用');
  },
  getRevision: async () => {
    throw new Error('未调用');
  },
  requestPublish: async () => {
    throw new Error('未调用');
  },
  getPublishRequest: async () => {
    throw new Error('未调用');
  },
  confirmPublish: async () => {
    throw new Error('未调用');
  },
  getPublished: async () => {
    throw new Error('未调用');
  },
  close: async () => {}
} satisfies PageLifecycle;

describe('内置 Agent Runner 的 MCP transport', () => {
  it('经完整 MCP client/server 契约调用工具,不直连目录发现模块', async () => {
    const server = createMetricCanvasMcpServer({
      catalog: createCatalogDiscovery({
        current: async () => ({ version: 'catalog-v1', snapshot })
      }),
      lifecycle: unusedLifecycle,
      context: () => ({ actorId: 'developer-1', clientId: 'workbench' }),
      previewUrl: () => 'https://runtime.example/preview'
    });
    const connection = await connectInProcessMetricCanvasMcp(server);
    const runner = createAgentRunner({
      mcp: connection.client,
      model: createScriptedModelProvider([
        {
          content: '',
          toolCalls: [
            {
              id: 'call-search',
              name: 'search_catalog',
              input: { query: '成交总额', limit: 10 }
            }
          ]
        },
        { content: '已找到指标 gmv。', toolCalls: [] }
      ])
    });

    const events = [];
    for await (const event of runner.run({
      messages: [{ role: 'user', content: '查找成交总额' }]
    })) {
      events.push(event);
    }
    await connection.close();

    const toolFinished = events.find((event) => event.type === 'tool_finished');
    expect(toolFinished).toEqual(
      expect.objectContaining({
        type: 'tool_finished',
        result: expect.objectContaining({
          isError: false,
          structuredContent: expect.objectContaining({
            ok: true,
            metadataVersion: 'catalog-v1'
          })
        })
      })
    );
  });
});
