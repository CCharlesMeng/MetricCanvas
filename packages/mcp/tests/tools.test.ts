import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CatalogSnapshot } from '@metriccanvas/page';
import { createCatalogDiscovery } from '@metriccanvas/catalog-discovery';
import type { PageLifecycle } from '@metriccanvas/page-lifecycle';
import type { TemplateLibrary } from '@metriccanvas/template-library';
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

describe('MetricCanvas MCP 工具契约', () => {
  const closeCallbacks: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(closeCallbacks.splice(0).map((close) => close()));
  });

  it('通过 MCP client 发现页面管理工具并按业务名称检索指标', async () => {
    const server = createMetricCanvasMcpServer({
      catalog: createCatalogDiscovery({
        current: async () => ({ version: 'catalog-v1', snapshot })
      }),
      lifecycle: unusedLifecycle,
      templates,
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
    expect(promptText).toContain('\\"schemaVersion\\":\\"1.0\\"');
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
