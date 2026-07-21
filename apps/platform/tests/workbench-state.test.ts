import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '@metriccanvas/agent-runner';
import { validate, type CatalogSnapshot } from '@metriccanvas/page';
import { createSingleMetricCardScriptedProvider } from '../src/lib/server/scripted-model.server';
import { deriveWorkbenchState } from '../src/lib/workbench-state';

const pageDocument = {
  schemaVersion: '1.0',
  id: 'sales-total',
  dataSources: {
    sales: {
      fields: {
        gmv: { type: 'number', role: 'metric' }
      },
      source: {
        type: 'query',
        query: { metrics: ['gmv'], aggregation: 'sum' }
      }
    }
  },
  sections: [
    {
      id: 'overview',
      title: '成交总额',
      layout: { type: 'grid', columns: 12 },
      components: [
        {
          id: 'w-gmv',
          type: 'metricCard',
          layout: { span: 3 },
          data: { main: 'sales' },
          props: {
            rows: [{ label: '成交总额', valueField: 'gmv' }]
          }
        }
      ]
    }
  ]
};

describe('页面搭建工作台状态', () => {
  it('脚本模型生成可由当前领域 DSL 校验的页面文档', async () => {
    const provider = createSingleMetricCardScriptedProvider('schema');
    const validation = await provider.complete({
      messages: [
        assistantCall('search-1', 'search_catalog', { query: '成交总额', limit: 10 }),
        toolResult('search-1', 'search_catalog', {
          ok: true,
          metadataVersion: 'catalog-v1',
          matches: [{ kind: 'metric', code: 'gmv', name: '成交总额' }]
        })
      ],
      tools: []
    });
    const input = validation.toolCalls[0]?.input as {
      document: Record<string, unknown>;
    };
    const catalog: CatalogSnapshot = {
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

    expect(validation.toolCalls).toEqual([
      expect.objectContaining({ name: 'validate_page' })
    ]);
    expect(validate(input.document, catalog)).toEqual([]);
    expect(input.document).toMatchObject({
      schemaVersion: '1.0',
      dataSources: {
        'summary-gmv': {
          source: { type: 'query' }
        }
      },
      sections: [
        {
          components: [
            expect.objectContaining({ type: 'reportHeader' }),
            expect.objectContaining({
              type: 'metricCard',
              data: { main: 'summary-gmv' }
            })
          ]
        }
      ]
    });
    expect(input.document).not.toHaveProperty('formatVersion');
    expect(input.document).not.toHaveProperty('widgets');
  });

  it('从浏览器会话恢复完整治理时间线与精确修订来源', () => {
    const messages: AgentMessage[] = [
      assistantCall('search-1', 'search_catalog', { query: '成交总额', limit: 10 }),
      toolResult('search-1', 'search_catalog', {
        ok: true,
        metadataVersion: 'catalog-v1',
        matches: [
          {
            kind: 'metric',
            code: 'gmv',
            name: '成交总额',
            availableAggregations: ['sum'],
            availableDimensions: []
          }
        ]
      }),
      assistantCall('validate-1', 'validate_page', { document: pageDocument }),
      toolResult('validate-1', 'validate_page', {
        ok: true,
        valid: true,
        currentSchemaVersion: '1.0',
        metadataVersion: 'catalog-v1',
        errors: []
      }),
      assistantCall('save-1', 'save_page', {
        pageId: 'sales-total',
        baseRevisionId: null,
        document: pageDocument,
        idempotencyKey: 'save-1'
      }),
      toolResult('save-1', 'save_page', {
        ok: true,
        revision: {
          pageId: 'sales-total',
          revisionId: 'revision-1',
          revisionNumber: 1,
          contentHash: 'content-hash-1',
          metadataVersion: 'catalog-v1',
          createdBy: 'developer-1',
          createdAt: '2026-07-20T12:30:00.000Z',
          document: pageDocument
        }
      }),
      assistantCall('preview-1', 'preview_page', {
        pageId: 'sales-total',
        revisionId: 'revision-1'
      }),
      toolResult('preview-1', 'preview_page', {
        ok: true,
        pageId: 'sales-total',
        revisionId: 'revision-1',
        previewUrl: 'http://localhost:5175/pages/sales-total?revision=revision-1'
      }),
      assistantCall('publish-1', 'request_publish', {
        pageId: 'sales-total',
        revisionId: 'revision-1',
        idempotencyKey: 'publish-1'
      }),
      toolResult('publish-1', 'request_publish', {
        ok: true,
        request: {
          requestId: 'request-1',
          pageId: 'sales-total',
          revisionId: 'revision-1',
          expiresAt: '2026-07-20T12:45:00.000Z',
          confirmationUrl:
            'http://localhost:5174/publish/request-1/confirm?token=secret'
        }
      })
    ];

    const state = deriveWorkbenchState({
      messages,
      confirmedPageIds: ['sales-total'],
      publishStatus: 'published'
    });

    expect(state.stages).toEqual([
      { key: 'catalog', status: 'complete' },
      { key: 'validation', status: 'complete' },
      { key: 'identity', status: 'complete' },
      { key: 'revision', status: 'complete' },
      { key: 'preview', status: 'complete' },
      { key: 'publish', status: 'complete' }
    ]);
    expect(state.catalog).toEqual({
      metadataVersion: 'catalog-v1',
      metric: {
        code: 'gmv',
        name: '成交总额',
        aggregation: 'sum',
        dimensions: []
      }
    });
    expect(state.identity).toEqual({
      pageId: 'sales-total',
      title: '成交总额',
      stablePath: '/pages/sales-total',
      confirmed: true,
      immutableAfterSave: true
    });
    expect(state.revision).toMatchObject({
      pageId: 'sales-total',
      revisionId: 'revision-1',
      revisionNumber: 1,
      contentHash: 'content-hash-1',
      metadataVersion: 'catalog-v1'
    });
    expect(state.preview).toEqual({
      pageId: 'sales-total',
      revisionId: 'revision-1',
      previewUrl: 'http://localhost:5175/pages/sales-total?revision=revision-1',
      matchesRevision: true
    });
    expect(state.publish).toEqual({
      requestId: 'request-1',
      pageId: 'sales-total',
      revisionId: 'revision-1',
      expiresAt: '2026-07-20T12:45:00.000Z',
      confirmationUrl: 'http://localhost:5174/publish/request-1/confirm?token=secret',
      status: 'published',
      matchesRevision: true
    });
  });

  it('把页面 id 结构化确认显示为治理时间线的人工门禁', () => {
    const messages: AgentMessage[] = [
      assistantCall('search-1', 'search_catalog', { query: '成交总额', limit: 10 }),
      toolResult('search-1', 'search_catalog', {
        ok: true,
        metadataVersion: 'catalog-v1',
        matches: [
          {
            kind: 'metric',
            code: 'gmv',
            name: '成交总额',
            availableAggregations: ['sum'],
            availableDimensions: []
          }
        ]
      }),
      assistantCall('validate-1', 'validate_page', { document: pageDocument }),
      toolResult('validate-1', 'validate_page', {
        ok: true,
        valid: true,
        currentSchemaVersion: '1.0',
        metadataVersion: 'catalog-v1',
        errors: []
      })
    ];

    const state = deriveWorkbenchState({
      messages,
      interaction: {
        id: 'confirm-page-id:sales-total',
        kind: 'confirm_page_id',
        payload: {
          pageId: 'sales-total',
          title: '成交总额',
          stablePath: '/pages/sales-total',
          immutableAfterSave: true,
          schemaVersion: '1.0',
          metadataVersion: 'catalog-v1'
        }
      }
    });

    expect(state.stages).toEqual([
      { key: 'catalog', status: 'complete' },
      { key: 'validation', status: 'complete' },
      { key: 'identity', status: 'action_required' },
      { key: 'revision', status: 'pending' },
      { key: 'preview', status: 'pending' },
      { key: 'publish', status: 'pending' }
    ]);
    expect(state.identity).toEqual({
      pageId: 'sales-total',
      title: '成交总额',
      stablePath: '/pages/sales-total',
      confirmed: false,
      immutableAfterSave: true
    });
  });

  it('编辑已有页面时保留 R1 基线并保存、预览精确的 R2', async () => {
    const r1 = {
      pageId: 'sales-total',
      revisionId: 'revision-1',
      revisionNumber: 1,
      contentHash: 'content-hash-1',
      metadataVersion: 'catalog-v1',
      createdBy: 'developer-1',
      createdAt: '2026-07-20T12:30:00.000Z',
      document: pageDocument
    };
    const provider = createSingleMetricCardScriptedProvider('existing-page');
    const loaded: AgentMessage[] = [
      assistantCall('get-page:revision-1', 'get_page', {
        pageId: 'sales-total',
        selector: { type: 'latest' }
      }),
      toolResult('get-page:revision-1', 'get_page', {
        ok: true,
        revision: r1,
        baseRevisionId: 'revision-1'
      })
    ];

    const validation = await provider.complete({ messages: loaded, tools: [] });
    expect(validation.toolCalls).toEqual([
      expect.objectContaining({ name: 'validate_page' })
    ]);
    const afterValidation: AgentMessage[] = [
      ...loaded,
      { role: 'assistant', content: validation.content, toolCalls: validation.toolCalls },
      toolResult('validate-existing-1', 'validate_page', {
        ok: true,
        valid: true,
        currentSchemaVersion: '1.0',
        metadataVersion: 'catalog-v1',
        errors: []
      })
    ];

    const save = await provider.complete({ messages: afterValidation, tools: [] });
    expect(save.toolCalls).toEqual([
      expect.objectContaining({
        name: 'save_page',
        input: expect.objectContaining({
          pageId: 'sales-total',
          baseRevisionId: 'revision-1'
        })
      })
    ]);
    const conflict = await provider.complete({
      messages: [
        ...afterValidation,
        { role: 'assistant', content: save.content, toolCalls: save.toolCalls },
        {
          ...toolResult('save-existing-1', 'save_page', {
            ok: false,
            error: { code: 'REVISION_CONFLICT', message: '当前最新修订为 revision-2' }
          }),
          isError: true
        }
      ],
      tools: []
    });
    expect(conflict.toolCalls).toEqual([]);
    const saveInput = save.toolCalls[0]?.input as { document: Record<string, unknown> };
    const r2 = {
      ...r1,
      revisionId: 'revision-2',
      revisionNumber: 2,
      contentHash: 'content-hash-2',
      document: saveInput.document
    };
    const afterSave: AgentMessage[] = [
      ...afterValidation,
      { role: 'assistant', content: save.content, toolCalls: save.toolCalls },
      toolResult('save-existing-1', 'save_page', { ok: true, revision: r2 })
    ];

    const preview = await provider.complete({ messages: afterSave, tools: [] });
    expect(preview.toolCalls).toEqual([
      expect.objectContaining({
        name: 'preview_page',
        input: { pageId: 'sales-total', revisionId: 'revision-2' }
      })
    ]);
    const messages: AgentMessage[] = [
      ...afterSave,
      { role: 'assistant', content: preview.content, toolCalls: preview.toolCalls },
      toolResult('preview-existing-1', 'preview_page', {
        ok: true,
        pageId: 'sales-total',
        revisionId: 'revision-2',
        previewUrl: 'http://localhost:5175/pages/sales-total?revision=revision-2'
      })
    ];

    const state = deriveWorkbenchState({
      messages,
      confirmedPageIds: ['sales-total']
    });
    expect(state.baseRevision).toMatchObject({
      pageId: 'sales-total',
      baseRevisionId: 'revision-1',
      revisionNumber: 1
    });
    expect(state.revision).toMatchObject({
      revisionId: 'revision-2',
      revisionNumber: 2
    });
    expect(state.preview).toEqual({
      pageId: 'sales-total',
      revisionId: 'revision-2',
      previewUrl: 'http://localhost:5175/pages/sales-total?revision=revision-2',
      matchesRevision: true
    });
  });

  it('保留结构化修订冲突以便显式重新加载当前页面修订', () => {
    const messages: AgentMessage[] = [
      assistantCall('save-2', 'save_page', {
        pageId: 'sales-total',
        baseRevisionId: 'revision-1',
        document: pageDocument,
        idempotencyKey: 'save-2'
      }),
      {
        ...toolResult('save-2', 'save_page', {
          ok: false,
          error: {
            code: 'REVISION_CONFLICT',
            message: '保存基线不是当前最新页面修订:revision-2',
            currentLatestRevision: {
              pageId: 'sales-total',
              revisionId: 'revision-2',
              revisionNumber: 2,
              contentHash: 'content-hash-2',
              metadataVersion: 'catalog-v1',
              createdBy: 'developer-2',
              createdAt: '2026-07-20T12:35:00.000Z',
              document: pageDocument
            }
          }
        }),
        isError: true
      }
    ];

    const state = deriveWorkbenchState({ messages });

    expect(state.revisionConflict).toMatchObject({
      pageId: 'sales-total',
      baseRevisionId: 'revision-1',
      currentLatestRevision: {
        revisionId: 'revision-2',
        revisionNumber: 2
      }
    });
    expect(state.stages.find((stage) => stage.key === 'revision')).toEqual({
      key: 'revision',
      status: 'failed'
    });
  });
});

function assistantCall(
  id: string,
  name: string,
  input: unknown
): Extract<AgentMessage, { role: 'assistant' }> {
  return {
    role: 'assistant',
    content: '',
    toolCalls: [{ id, name, input }]
  };
}

function toolResult(
  toolCallId: string,
  name: string,
  result: unknown
): Extract<AgentMessage, { role: 'tool' }> {
  return {
    role: 'tool',
    toolCallId,
    name,
    content: JSON.stringify(result),
    isError: false
  };
}
