import { describe, expect, it } from 'vitest';
import { createPageIdConfirmationMcpClient, type McpClient } from '../src';

const pageDocument = {
  schemaVersion: '4.0',
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
  it('在委托校验前拒绝占位页面 id 并要求模型拟定真实候选 id', async () => {
    const delegatedCalls: string[] = [];
    const client = createPageIdConfirmationMcpClient({
      client: {
        async listTools() {
          return [];
        },
        async callTool({ name }) {
          delegatedCalls.push(name);
          return {
            structuredContent: { ok: true, valid: true, errors: [] },
            isError: false
          };
        }
      },
      confirmedPageIds: []
    });

    const result = await client.callTool({
      name: 'validate_page',
      arguments: {
        document: {
          ...pageDocument,
          id: '__pending__'
        }
      }
    });

    expect(delegatedCalls).toEqual([]);
    expect(result).toEqual({
      structuredContent: {
        ok: true,
        valid: false,
        errors: [
          {
            code: 'PAGE_ID_PLACEHOLDER',
            path: '/id',
            message: '页面 id 必须是可读且唯一的真实候选值'
          }
        ]
      },
      isError: false
    });
  });

  it('合法页面校验完成后请求结构化页面 id 确认', async () => {
    const client = createPageIdConfirmationMcpClient({
      client: fakeClient({
        ok: true,
        valid: true,
        currentSchemaVersion: '4.0',
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
        schemaVersion: '4.0'
      }
    });
  });

  it('保存未确认的页面 id 时,把确认状态翻译为命令字段并委托给 lifecycle 强制', async () => {
    const delegatedCalls: Array<{ name: string; arguments: unknown }> = [];
    const baseClient: McpClient = {
      async listTools() {
        return [];
      },
      async callTool(request) {
        delegatedCalls.push({ name: request.name, arguments: request.arguments });
        // 模拟 page-lifecycle 的 SaveRevisionCommand.pageIdConfirmed 强制:
        // 装饰器自身不再判断"是否首次保存",只负责翻译确认状态。
        return {
          isError: true,
          structuredContent: {
            ok: false,
            error: {
              code: 'PAGE_ID_CONFIRMATION_REQUIRED',
              message: '首次保存前必须确认页面 id sales-total'
            }
          }
        };
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

    expect(delegatedCalls).toEqual([
      {
        name: 'save_page',
        arguments: {
          pageId: 'sales-total',
          baseRevisionId: null,
          document: pageDocument,
          idempotencyKey: 'save-1',
          pageIdConfirmed: false
        }
      }
    ]);
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

  it('追加页面修订时仍会附带确认状态,但结果由 lifecycle 忽略该字段决定', async () => {
    const delegatedCalls: Array<{ name: string; arguments: unknown }> = [];
    const client = createPageIdConfirmationMcpClient({
      client: {
        async listTools() {
          return [];
        },
        async callTool(request) {
          delegatedCalls.push({ name: request.name, arguments: request.arguments });
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

    expect(delegatedCalls).toEqual([
      {
        name: 'save_page',
        arguments: {
          pageId: 'sales-total',
          baseRevisionId: 'revision-1',
          document: pageDocument,
          idempotencyKey: 'save-2',
          pageIdConfirmed: false
        }
      }
    ]);
    expect(result.structuredContent).toEqual({
      ok: true,
      revision: { pageId: 'sales-total', revisionId: 'revision-2' }
    });
  });

  it('页面 id 已确认时允许校验结果继续,并把 pageIdConfirmed:true 传给保存命令', async () => {
    const delegatedCalls: Array<{ name: string; arguments: unknown }> = [];
    const baseClient: McpClient = {
      async listTools() {
        return [];
      },
      async callTool(request) {
        delegatedCalls.push({ name: request.name, arguments: request.arguments });
        return request.name === 'validate_page'
          ? {
              structuredContent: {
                ok: true,
                valid: true,
                currentSchemaVersion: '4.0',
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
    expect(delegatedCalls).toEqual([
      { name: 'validate_page', arguments: { document: pageDocument } },
      {
        name: 'save_page',
        arguments: {
          pageId: 'sales-total',
          baseRevisionId: null,
          document: pageDocument,
          idempotencyKey: 'save-1',
          pageIdConfirmed: true
        }
      }
    ]);
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
