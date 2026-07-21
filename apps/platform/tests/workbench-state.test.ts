import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '@metriccanvas/agent-runner';
import { deriveWorkbenchState } from '../src/lib/workbench-state';

const pageDocument = {
  formatVersion: '1.0',
  id: 'sales-total',
  title: '成交总额',
  layout: { type: 'grid', columns: 12 },
  widgets: [
    {
      id: 'w-gmv',
      type: 'metricCard',
      position: { x: 0, y: 0, w: 3, h: 2 },
      query: { metrics: ['gmv'], aggregation: 'sum' }
    }
  ]
};

describe('页面搭建工作台状态', () => {
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
        currentFormatVersion: '1.0',
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
        currentFormatVersion: '1.0',
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
          formatVersion: '1.0',
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
