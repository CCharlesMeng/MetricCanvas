import { describe, expect, it } from 'vitest';
import type { CatalogSnapshot, Page } from '@metriccanvas/page';
import { createCatalogDiscovery } from '@metriccanvas/catalog-discovery';
import type { PageLifecycle, PageRevision } from '@metriccanvas/page-lifecycle';
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

const pageRevision: PageRevision = {
  revisionId: 'revision-2',
  revisionNumber: 2,
  pageId: 'sales-total',
  baseRevisionId: 'revision-1',
  document: {} as Page,
  contentHash: 'content-hash',
  metadataVersion: 'catalog-v1',
  createdBy: 'developer-1',
  createdAt: '2026-07-21T02:00:00.000Z'
};

let listPagesQuery: { afterPageId?: string; limit?: number } | undefined;
let getPageReference: unknown;

const unusedLifecycle = {
  saveRevision: async () => {
    return {
      ok: false as const,
      error: {
        code: 'REVISION_CONFLICT' as const,
        message: '保存基线不是当前最新页面修订',
        currentLatestRevision: pageRevision
      }
    };
  },
  getRevision: async () => {
    throw new Error('未调用');
  },
  getPage: async (reference) => {
    getPageReference = reference;
    return { ok: true, revision: pageRevision };
  },
  listPages: async (query) => {
    listPagesQuery = query;
    return {
      pages: [
        {
          pageId: 'sales-total',
          latestRevision: { pageId: 'sales-total', revisionId: 'revision-2' },
          publishedRevision: { pageId: 'sales-total', revisionId: 'revision-1' },
          catalogVisibility: 'visible' as const
        }
      ],
      nextPageId: 'sales-total'
    };
  },
  listRevisionHistory: async ({ pageId }) => ({
    ok: true as const,
    history: { pageId, revisions: [pageRevision] }
  }),
  diffRevisions: async ({ pageId, fromRevisionId, toRevisionId }) => ({
    ok: true as const,
    diff: { pageId, fromRevisionId, toRevisionId, changes: [] }
  }),
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
  it('通过进程内 MCP 边界发现并调用只读页面管理工具', async () => {
    listPagesQuery = undefined;
    getPageReference = undefined;
    const server = createMetricCanvasMcpServer({
      catalog: createCatalogDiscovery({
        current: async () => ({ version: 'catalog-v1', snapshot })
      }),
      lifecycle: unusedLifecycle,
      context: () => ({ actorId: 'developer-1', clientId: 'workbench' }),
      previewUrl: () => 'https://runtime.example/preview'
    });
    const connection = await connectInProcessMetricCanvasMcp(server);

    const tools = await connection.client.listTools();
    const listed = await connection.client.callTool({
      name: 'list_pages',
      arguments: { cursor: 'sales-before', limit: 1 }
    });
    const fetched = await connection.client.callTool({
      name: 'get_page',
      arguments: {
        pageId: 'sales-total',
        selector: { type: 'exact', revisionId: 'revision-2' }
      }
    });
    const conflict = await connection.client.callTool({
      name: 'save_page',
      arguments: {
        pageId: 'sales-total',
        baseRevisionId: 'revision-1',
        document: {},
        idempotencyKey: 'stale-save'
      }
    });
    await connection.close();

    expect(tools.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'list_pages',
        'get_page'
      ])
    );
    expect(listPagesQuery).toEqual({ afterPageId: 'sales-before', limit: 1 });
    expect(listed.structuredContent).toEqual({
      ok: true,
      pages: [
        {
          pageId: 'sales-total',
          latestRevision: { pageId: 'sales-total', revisionId: 'revision-2' },
          publishedRevision: { pageId: 'sales-total', revisionId: 'revision-1' },
          catalogVisibility: 'visible'
        }
      ],
      nextCursor: 'sales-total'
    });
    expect(getPageReference).toEqual({
      pageId: 'sales-total',
      selector: { type: 'exact', revisionId: 'revision-2' }
    });
    expect(fetched.structuredContent).toEqual({ ok: true, revision: pageRevision });
    expect(conflict).toMatchObject({
      isError: true,
      structuredContent: {
        ok: false,
        error: {
          code: 'REVISION_CONFLICT',
          currentLatestRevision: pageRevision
        }
      }
    });
  });

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
