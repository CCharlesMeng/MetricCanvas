import { describe, expect, it } from 'vitest';
import type { McpClient } from '@metriccanvas/agent-runner';
import { createPageIdConfirmationMcpClient } from '@metriccanvas/mcp';

const pageDocument = {
  schemaVersion: '1.0',
  id: 'sales-total',
  dataSources: {},
  sections: [
    {
      id: 'overview',
      title: '成交总额',
      layout: { type: 'grid', columns: 12 },
      components: [
        {
          id: 'intro',
          type: 'text',
          layout: { span: 12 },
          props: { body: '成交总额' }
        }
      ]
    }
  ]
};

describe('页面 id 确认 MCP Client adapter', () => {
  it('合法页面校验完成后请求结构化页面 id 确认', async () => {
    const client = createPageIdConfirmationMcpClient({
      client: fakeClient({
        ok: true,
        valid: true,
        currentSchemaVersion: '1.0',
        metadataVersion: 'catalog-v1',
        errors: []
      }),
      confirmedPageIds: []
    });

    const result = await client.callTool({
      name: 'validate_page',
      arguments: { document: pageDocument }
    });

    expect(result.interaction).toEqual({
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
    });
  });

  it('拒绝保存尚未结构化确认的页面 id', async () => {
    const delegatedCalls: string[] = [];
    const baseClient: McpClient = {
      async listTools() {
        return [];
      },
      async callTool({ name }) {
        delegatedCalls.push(name);
        return { structuredContent: { ok: true }, isError: false };
      }
    };
    const client = createPageIdConfirmationMcpClient({
      client: baseClient,
      confirmedPageIds: []
    });

    const result = await client.callTool({
      name: 'save_page',
      arguments: {
        pageId: 'sales-total',
        baseRevisionId: null,
        document: pageDocument,
        idempotencyKey: 'save-1'
      }
    });

    expect(delegatedCalls).toEqual([]);
    expect(result).toEqual({
      isError: true,
      structuredContent: {
        ok: false,
        error: {
          code: 'PAGE_ID_CONFIRMATION_REQUIRED',
          message: '首次保存前必须确认页面 id sales-total'
        }
      }
    });
  });

  it('追加页面修订时不要求再次确认页面 id', async () => {
    const delegatedCalls: string[] = [];
    const client = createPageIdConfirmationMcpClient({
      client: {
        async listTools() {
          return [];
        },
        async callTool({ name }) {
          delegatedCalls.push(name);
          return {
            structuredContent: {
              ok: true,
              revision: { pageId: 'sales-total', revisionId: 'revision-2' }
            },
            isError: false
          };
        }
      },
      confirmedPageIds: []
    });

    const result = await client.callTool({
      name: 'save_page',
      arguments: {
        pageId: 'sales-total',
        baseRevisionId: 'revision-1',
        document: pageDocument,
        idempotencyKey: 'save-2'
      }
    });

    expect(delegatedCalls).toEqual(['save_page']);
    expect(result.structuredContent).toEqual({
      ok: true,
      revision: { pageId: 'sales-total', revisionId: 'revision-2' }
    });
  });

  it('页面 id 已确认时允许校验结果继续并委托保存', async () => {
    const delegatedCalls: string[] = [];
    const baseClient: McpClient = {
      async listTools() {
        return [];
      },
      async callTool({ name }) {
        delegatedCalls.push(name);
        return name === 'validate_page'
          ? {
              structuredContent: {
                ok: true,
                valid: true,
                metadataVersion: 'catalog-v1',
                errors: []
              },
              isError: false
            }
          : {
              structuredContent: {
                ok: true,
                revision: { pageId: 'sales-total', revisionId: 'revision-1' }
              },
              isError: false
            };
      }
    };
    const client = createPageIdConfirmationMcpClient({
      client: baseClient,
      confirmedPageIds: ['sales-total']
    });

    const validation = await client.callTool({
      name: 'validate_page',
      arguments: { document: pageDocument }
    });
    const saved = await client.callTool({
      name: 'save_page',
      arguments: {
        pageId: 'sales-total',
        baseRevisionId: null,
        document: pageDocument,
        idempotencyKey: 'save-1'
      }
    });

    expect(validation.interaction).toBeUndefined();
    expect(saved.structuredContent).toEqual({
      ok: true,
      revision: { pageId: 'sales-total', revisionId: 'revision-1' }
    });
    expect(delegatedCalls).toEqual(['validate_page', 'save_page']);
  });
});

function fakeClient(structuredContent: unknown): McpClient {
  return {
    async listTools() {
      return [];
    },
    async callTool() {
      return { structuredContent, isError: false };
    }
  };
}
